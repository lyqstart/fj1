package com.fj.common.response;

import com.fj.common.exception.ErrorCode;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.slf4j.MDC;

import java.io.Serial;
import java.io.Serializable;

/**
 * 统一 API 响应体（§5.1 契约规范）。
 * <pre>
 * { "code": 0, "message": "ok", "data": {...}, "trace_id": "xxx" }
 * </pre>
 *
 * @param <T> data 载荷类型
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 业务状态码：0 表示成功，非 0 对应 {@link ErrorCode#getCode()} */
    private int code;

    /** 提示信息 */
    private String message;

    /** 业务数据 */
    private T data;

    /** 链路追踪 ID（来自 MDC） */
    private String traceId;

    /** 成功响应（无数据） */
    public static <T> ApiResponse<T> ok() {
        return ok(null);
    }

    /** 成功响应（带数据） */
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(0, "ok", data, MDC.get("traceId"));
    }

    /** 失败响应（指定错误码） */
    public static <T> ApiResponse<T> fail(ErrorCode errorCode) {
        return new ApiResponse<>(errorCode.getCode(), errorCode.getDescription(), null, MDC.get("traceId"));
    }

    /** 失败响应（指定错误码 + 自定义消息） */
    public static <T> ApiResponse<T> fail(ErrorCode errorCode, String message) {
        return new ApiResponse<>(errorCode.getCode(), message, null, MDC.get("traceId"));
    }

    /** 是否成功 */
    public boolean isSuccess() {
        return code == 0;
    }
}
