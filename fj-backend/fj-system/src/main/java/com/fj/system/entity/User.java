package com.fj.system.entity;

import com.fj.common.jpa.BaseEntity;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;
import java.time.OffsetDateTime;

/**
 * 用户实体（对应 V1 users 表）。
 * <p>密码字段 {@code passwordHash} 存储 BCrypt(cost=12) 哈希值，不存明文。
 */
@Entity
@Table(name = "users")
@Getter
@Setter
public class User extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "username", nullable = false, length = 64)
    private String username;

    /** BCrypt 哈希值，由 Service 层编码后写入 */
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "real_name", length = 64)
    private String realName;

    @Column(name = "phone", length = 20)
    private String phone;

    @Column(name = "email", length = 128)
    private String email;

    @Convert(converter = UserStatusConverter.class)
    @Column(name = "status", nullable = false)
    private UserStatus status;

    @Column(name = "last_login_at")
    private OffsetDateTime lastLoginAt;
}
