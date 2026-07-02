package com.fj.system.dto;

import com.fj.system.entity.User;

import java.util.List;
import java.util.stream.Collectors;

/**
 * {@link User} 实体 → {@link UserResponseDTO} 转换器（G1 安全修复）。
 * <p>统一过滤敏感密码字段，确保哈希不进入响应体。
 */
public final class UserResponseConverter {

    private UserResponseConverter() {
    }

    /**
     * 单个实体转 DTO（不复制密码哈希）。
     */
    public static UserResponseDTO toDTO(User user) {
        UserResponseDTO dto = new UserResponseDTO();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setRealName(user.getRealName());
        dto.setPhone(user.getPhone());
        dto.setEmail(user.getEmail());
        dto.setStatus(user.getStatus());
        dto.setLastLoginAt(user.getLastLoginAt());
        dto.setCreatedAt(user.getCreatedAt());
        dto.setUpdatedAt(user.getUpdatedAt());
        return dto;
    }

    /**
     * 列表批量转 DTO。
     */
    public static List<UserResponseDTO> toDTOList(List<User> users) {
        return users.stream().map(UserResponseConverter::toDTO).collect(Collectors.toList());
    }
}
