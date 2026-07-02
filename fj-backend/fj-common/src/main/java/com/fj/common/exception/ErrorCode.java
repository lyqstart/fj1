package com.fj.common.exception;

import com.fj.common.enume.BaseEnum;
import lombok.Getter;

/**
 * 系统统一错误码枚举（§5.3 错误码规范）。
 * <p>五段制编码：
 * <ul>
 *   <li>1000-1999 认证类（Authentication）</li>
 *   <li>2000-2999 权限类（Authorization）</li>
 *   <li>3000-3999 业务类（Business）</li>
 *   <li>4000-4999 数据类（Data）</li>
 *   <li>5000-5999 系统类（System）</li>
 * </ul>
 */
@Getter
public enum ErrorCode implements BaseEnum {

    // ==================== 认证类 1000-1999 ====================
    AUTH_TOKEN_MISSING(1001, "未提供认证令牌"),
    AUTH_TOKEN_INVALID(1002, "认证令牌无效或已过期"),
    AUTH_TOKEN_EXPIRED(1003, "认证令牌已过期，请重新登录"),
    AUTH_LOGIN_FAILED(1004, "用户名或密码错误"),
    AUTH_ACCOUNT_DISABLED(1005, "账号已被禁用"),
    AUTH_ACCOUNT_LOCKED(1006, "账号已被锁定"),
    AUTH_ACCOUNT_NOT_FOUND(1007, "账号不存在"),
    AUTH_PASSWORD_INCORRECT(1008, "原密码不正确"),

    // ==================== 权限类 2000-2999 ====================
    AUTHZ_NO_PERMISSION(2001, "无操作权限"),
    AUTHZ_NO_ROLE(2002, "未分配角色"),
    AUTHZ_PROJECT_NO_ACCESS(2003, "无该项目访问权限"),
    AUTHZ_DATA_SCOPE_DENIED(2004, "超出数据权限范围"),

    // ==================== 业务类 3000-3999 ====================
    BIZ_RESOURCE_NOT_FOUND(3001, "资源不存在"),
    BIZ_RESOURCE_DUPLICATED(3002, "资源已存在，不可重复创建"),
    BIZ_STATE_INVALID_TRANSITION(3003, "状态流转不合法"),
    BIZ_OPERATION_NOT_ALLOWED(3004, "当前状态不允许此操作"),
    BIZ_DATA_IN_USE(3005, "数据被引用，不可删除"),
    BIZ_PARAMS_INVALID(3006, "业务参数校验失败"),
    BIZ_APPROVAL_REJECTED(3007, "审批被驳回"),

    // ==================== 数据类 4000-4999 ====================
    DATA_NOT_FOUND(4001, "数据不存在"),
    DATA_ALREADY_EXISTS(4002, "数据已存在"),
    DATA_CONCURRENT_MODIFICATION(4003, "数据已被他人修改，请刷新后重试"),
    DATA_SERVER_SEQ_CONFLICT(4004, "数据同步版本冲突"),
    DATA_VALIDATION_FAILED(4005, "数据格式校验失败"),

    // ==================== 系统类 5000-5999 ====================
    SYS_INTERNAL_ERROR(5001, "系统内部错误"),
    SYS_SERVICE_UNAVAILABLE(5002, "服务暂不可用"),
    SYS_DB_ERROR(5003, "数据库操作失败"),
    SYS_CACHE_ERROR(5004, "缓存操作失败"),
    SYS_EXTERNAL_API_ERROR(5005, "外部接口调用失败");

    /** 错误码 */
    private final int code;

    /** 错误描述 */
    private final String description;

    ErrorCode(int code, String description) {
        this.code = code;
        this.description = description;
    }
}
