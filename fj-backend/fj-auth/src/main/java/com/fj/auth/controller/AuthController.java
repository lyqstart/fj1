package com.fj.auth.controller;

import com.fj.auth.dto.LoginRequest;
import com.fj.auth.dto.LoginResponse;
import com.fj.auth.dto.RefreshRequest;
import com.fj.auth.service.AuthService;
import com.fj.common.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 认证 REST API（DD-4）。
 * <ul>
 *   <li>POST /api/v1/auth/login — 登录，返回令牌对</li>
 *   <li>POST /api/v1/auth/refresh — 刷新令牌</li>
 *   <li>POST /api/v1/auth/logout — 登出（撤销令牌）</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String BEARER_PREFIX = "Bearer ";

    private final AuthService authService;

    /** 登录 */
    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        return ApiResponse.ok(authService.login(request, http.getRemoteAddr()));
    }

    /** 刷新令牌 */
    @PostMapping("/refresh")
    public ApiResponse<LoginResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ApiResponse.ok(authService.refresh(request.refreshToken()));
    }

    /** 登出（撤销当前令牌） */
    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (StringUtils.hasText(authHeader) && authHeader.startsWith(BEARER_PREFIX)) {
            authService.logout(authHeader.substring(BEARER_PREFIX.length()).trim());
        }
        return ApiResponse.ok();
    }
}
