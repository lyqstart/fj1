package com.fj.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 刷新令牌请求 DTO。
 */
public record RefreshRequest(@NotBlank(message = "refresh_token 不能为空") String refreshToken) {
}
