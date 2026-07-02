package com.fj.auth.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fj.system.entity.User;

/**
 * 登录成功响应 DTO（DD-4 Token 机制）。
 * <p>返回令牌对 + 用户基本信息，不泄露密码哈希。
 */
public record LoginResponse(String accessToken, String refreshToken, UserInfo user) {

    public static LoginResponse of(String accessToken, String refreshToken, User user) {
        return new LoginResponse(accessToken, refreshToken, UserInfo.from(user));
    }

    /** 用户基本信息（脱敏） */
    public record UserInfo(Long id, String username, String realName) {

        public static UserInfo from(User user) {
            return new UserInfo(user.getId(), user.getUsername(), user.getRealName());
        }

        @JsonIgnore
        @Override
        public String toString() {
            return "UserInfo{id=" + id + ", username=" + username + "}";
        }
    }
}
