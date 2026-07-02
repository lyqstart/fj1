package com.fj.system.entity;

import com.fj.common.enume.BaseEnum;
import lombok.Getter;

/**
 * 用户状态枚举（对应 users.status SMALLINT）。
 * <p>兼容 V1 注释「1启用 0禁用」，新增 LOCKED=2（登录限流触发）。
 */
@Getter
public enum UserStatus implements BaseEnum {

    DISABLED(0, "禁用"),
    ACTIVE(1, "启用"),
    LOCKED(2, "锁定");

    private final int code;
    private final String description;

    UserStatus(int code, String description) {
        this.code = code;
        this.description = description;
    }
}
