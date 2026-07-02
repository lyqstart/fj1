package com.fj.auth.service;

import com.fj.auth.dto.LoginRequest;
import com.fj.auth.dto.LoginResponse;
import com.fj.auth.jwt.JwtTokenProvider;
import com.fj.auth.jwt.TokenBlacklistService;
import com.fj.auth.security.RateLimiter;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.system.entity.User;
import com.fj.system.entity.UserStatus;
import com.fj.system.service.UserService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 认证 Service（登录 / 刷新 / 登出）。
 * <p>密码校验使用 BCrypt(cost=12)；登录失败不区分「用户不存在」与「密码错误」（REQ-1.2）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    /** BCrypt 成本因子（DD-4 安全基线） */
    private static final int BCRYPT_COST = 12;

    /** 统一的登录失败提示（不泄露账号是否存在） */
    private static final String LOGIN_FAILED_MSG = "用户名或密码错误";

    private final UserService userService;
    private final JwtTokenProvider jwtTokenProvider;
    private final TokenBlacklistService tokenBlacklistService;
    private final RateLimiter rateLimiter;

    /** BCrypt 编码器（cost=12），用于登录时校验密码 */
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(BCRYPT_COST);

    /**
     * 登录：校验密码 → 限流检查 → 签发令牌对。
     *
     * @param request  登录请求
     * @param clientIp 客户端 IP（限流 key）
     */
    @Transactional
    public LoginResponse login(LoginRequest request, String clientIp) {
        if (rateLimiter.isLocked(clientIp)) {
            throw new BusinessException(ErrorCode.AUTH_ACCOUNT_LOCKED, "登录尝试过于频繁，请 5 分钟后再试");
        }

        User user;
        try {
            user = userService.findByUsername(request.username());
        } catch (BusinessException ex) {
            // 账号不存在：统一按密码错误处理，不泄露账号是否存在（REQ-1.2）
            rateLimiter.recordFailure(clientIp);
            log.warn("登录失败（账号不存在）: username={}, ip={}", request.username(), clientIp);
            throw new BusinessException(ErrorCode.AUTH_LOGIN_FAILED, LOGIN_FAILED_MSG);
        }

        if (user.getStatus() == UserStatus.DISABLED) {
            throw new BusinessException(ErrorCode.AUTH_ACCOUNT_DISABLED);
        }
        if (user.getStatus() == UserStatus.LOCKED) {
            throw new BusinessException(ErrorCode.AUTH_ACCOUNT_LOCKED);
        }

        // BCrypt 密码校验
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            rateLimiter.recordFailure(clientIp);
            log.warn("登录失败（密码错误）: username={}, ip={}", request.username(), clientIp);
            throw new BusinessException(ErrorCode.AUTH_LOGIN_FAILED, LOGIN_FAILED_MSG);
        }

        rateLimiter.reset(clientIp);
        userService.updateLastLoginAt(user.getId());

        JwtTokenProvider.TokenPair pair = jwtTokenProvider.generateTokenPair(user.getId(), user.getUsername());
        log.info("登录成功: userId={}, username={}", user.getId(), user.getUsername());
        return LoginResponse.of(pair.accessToken(), pair.refreshToken(), user);
    }

    /**
     * 刷新令牌：校验 refresh_token 有效性 → 签发新令牌对（V1 refresh_token 不滑动续期）。
     */
    public LoginResponse refresh(String refreshToken) {
        if (!jwtTokenProvider.isValid(refreshToken)) {
            throw new BusinessException(ErrorCode.AUTH_TOKEN_EXPIRED, "refresh_token 无效或已过期，请重新登录");
        }
        Claims claims = jwtTokenProvider.parse(refreshToken);
        if (tokenBlacklistService.isRevoked(jwtTokenProvider.getJti(claims))) {
            throw new BusinessException(ErrorCode.AUTH_TOKEN_INVALID, "令牌已撤销，请重新登录");
        }
        Long userId = jwtTokenProvider.getUserId(claims);
        User user = userService.detail(userId);
        if (user.getStatus() == UserStatus.DISABLED) {
            throw new BusinessException(ErrorCode.AUTH_ACCOUNT_DISABLED);
        }

        JwtTokenProvider.TokenPair pair = jwtTokenProvider.generateTokenPair(user.getId(), user.getUsername());
        return LoginResponse.of(pair.accessToken(), pair.refreshToken(), user);
    }

    /**
     * 登出：将当前 access_token 加入黑名单。
     */
    public void logout(String accessToken) {
        if (accessToken == null || accessToken.isBlank()) {
            return;
        }
        if (jwtTokenProvider.isValid(accessToken)) {
            Claims claims = jwtTokenProvider.parse(accessToken);
            tokenBlacklistService.revoke(jwtTokenProvider.getJti(claims), jwtTokenProvider.getExpirationMillis(claims));
            log.info("令牌已撤销: userId={}", jwtTokenProvider.getUserId(claims));
        }
    }
}
