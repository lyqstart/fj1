package com.fj.auth.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

/**
 * JWT 令牌签发与解析（jjwt 0.12.x，HS256，DD-4）。
 * <p>access_token 默认 30 分钟，refresh_token 默认 7 天。密钥从配置读取，不硬编码。
 * claim 携带 userId / username，jti 用于黑名单撤销。
 */
@Slf4j
@Component
public class JwtTokenProvider {

    /** 默认 access_token 有效期（分钟） */
    private static final long DEFAULT_ACCESS_MINUTES = 30;

    /** 默认 refresh_token 有效期（天） */
    private static final long DEFAULT_REFRESH_DAYS = 7;

    @Value("${fj.security.jwt.secret}")
    private String secret;

    @Value("${fj.security.jwt.expire-minutes:" + DEFAULT_ACCESS_MINUTES + "}")
    private long expireMinutes;

    @Value("${fj.security.jwt.refresh-expire-days:" + DEFAULT_REFRESH_DAYS + "}")
    private long refreshExpireDays;

    private SecretKey key;

    @PostConstruct
    void init() {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException("fj.security.jwt.secret 必须至少 32 字节（HS256 要求）");
        }
        this.key = Keys.hmacShaKeyFor(keyBytes);
    }

    /** 生成 access_token + refresh_token 令牌对 */
    public TokenPair generateTokenPair(Long userId, String username) {
        String accessToken = build(userId, username, expireMinutes * 60_000L);
        String refreshToken = build(userId, username, refreshExpireDays * 24 * 60 * 60_000L);
        return new TokenPair(accessToken, refreshToken);
    }

    private String build(Long userId, String username, long ttlMillis) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(String.valueOf(userId))
                .claim("userId", userId)
                .claim("username", username)
                .issuedAt(new Date(now))
                .expiration(new Date(now + ttlMillis))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    /** 解析令牌的 claims（签名/有效期校验失败抛 JwtException） */
    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /** 令牌是否有效（签名正确且未过期） */
    public boolean isValid(String token) {
        try {
            parse(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("JWT 校验失败: {}", e.getMessage());
            return false;
        }
    }

    /** 提取令牌 jti（唯一标识） */
    public String getJti(Claims claims) {
        return claims.getId();
    }

    /** 提取令牌中的 userId */
    public Long getUserId(Claims claims) {
        Object value = claims.get("userId");
        return value == null ? null : Long.valueOf(value.toString());
    }

    /** 提取令牌中的 username */
    public String getUsername(Claims claims) {
        return claims.get("username", String.class);
    }

    /** 提取令牌过期时间戳（毫秒） */
    public long getExpirationMillis(Claims claims) {
        return claims.getExpiration().getTime();
    }

    /** 令牌对 */
    public record TokenPair(String accessToken, String refreshToken) {
    }
}
