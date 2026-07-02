package com.fj.system.controller;

import com.fj.common.dto.PageRequest;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.common.response.ApiResponse;
import com.fj.common.response.PageResponse;
import com.fj.system.dto.UserResponseConverter;
import com.fj.system.dto.UserResponseDTO;
import com.fj.system.entity.User;
import com.fj.system.entity.UserStatus;
import com.fj.system.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 用户管理 REST API。
 * <p>统一响应 {@link ApiResponse}，分页用 {@link PageResponse}。
 */
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /** 分页查询用户列表 */
    @GetMapping
    public ApiResponse<PageResponse<UserResponseDTO>> list(@Valid PageRequest pageRequest) {
        PageResponse<User> page = userService.list(pageRequest);
        return ApiResponse.ok(PageResponse.of(
                UserResponseConverter.toDTOList(page.getItems()),
                page.getTotal(), page.getPage(), page.getPageSize()));
    }

    /** 查看用户详情 */
    @GetMapping("/{id}")
    public ApiResponse<UserResponseDTO> detail(@PathVariable Long id) {
        return ApiResponse.ok(UserResponseConverter.toDTO(userService.detail(id)));
    }

    /** 创建用户（passwordHash 字段传明文，Service 层 BCrypt 编码） */
    @PostMapping
    public ApiResponse<UserResponseDTO> create(@Valid @RequestBody User user) {
        return ApiResponse.ok(UserResponseConverter.toDTO(userService.create(user)));
    }

    /** 更新用户基本信息（不修改密码） */
    @PutMapping("/{id}")
    public ApiResponse<UserResponseDTO> update(@PathVariable Long id, @RequestBody User user) {
        return ApiResponse.ok(UserResponseConverter.toDTO(userService.update(id, user)));
    }

    /** 切换用户状态，body: {"status": "ACTIVE" | "LOCKED" | "DISABLED"} */
    @PatchMapping("/{id}/status")
    public ApiResponse<Void> updateStatus(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Object statusObj = body.get("status");
        if (statusObj == null) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, "status 字段必填");
        }
        UserStatus status;
        try {
            status = UserStatus.valueOf(String.valueOf(statusObj).toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, "status 取值非法: " + statusObj);
        }
        userService.updateStatus(id, status);
        return ApiResponse.ok();
    }
}
