package com.fj.system.dto;

import com.fj.system.entity.UserStatus;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * 用户响应 DTO（脱敏）。
 * <p>用于 Controller 出参，<b>刻意排除密码哈希字段</b>，避免敏感凭证外泄（G1 安全修复）。
 * <p>覆盖 {@link com.fj.system.entity.User} 的所有非敏感用户可见字段。
 */
@Data
public class UserResponseDTO implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键 */
    private Long id;

    /** 用户名 */
    private String username;

    /** 真实姓名 */
    private String realName;

    /** 手机号 */
    private String phone;

    /** 邮箱 */
    private String email;

    /** 用户状态 */
    private UserStatus status;

    /** 最后登录时间 */
    private OffsetDateTime lastLoginAt;

    /** 创建时间 */
    private OffsetDateTime createdAt;

    /** 更新时间 */
    private OffsetDateTime updatedAt;
}
