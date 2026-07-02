package com.fj.common.exception;

import com.fj.common.response.ApiResponse;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.stream.Collectors;

/**
 * 全局异常处理器（§5.2）。
 * <p>统一拦截 Controller 层抛出的异常，转换为 {@link ApiResponse} 标准格式返回。
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 业务异常：返回 200 + 业务错误码（HTTP 层成功，业务层失败）。
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException ex) {
        log.warn("业务异常: code={}, message={}", ex.getErrorCode().getCode(), ex.getMessage());
        return ResponseEntity.ok(ApiResponse.fail(ex.getErrorCode(), ex.getMessage()));
    }

    /**
     * 参数校验失败（@Valid RequestBody）：返回 400。
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(this::formatFieldError)
                .collect(Collectors.joining("; "));
        log.warn("参数校验失败: {}", message);
        return ResponseEntity.badRequest()
                .body(ApiResponse.fail(ErrorCode.BIZ_PARAMS_INVALID, message));
    }

    /**
     * 参数绑定失败（表单）：返回 400。
     */
    @ExceptionHandler(BindException.class)
    public ResponseEntity<ApiResponse<Void>> handleBindException(BindException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(this::formatFieldError)
                .collect(Collectors.joining("; "));
        log.warn("参数绑定失败: {}", message);
        return ResponseEntity.badRequest()
                .body(ApiResponse.fail(ErrorCode.BIZ_PARAMS_INVALID, message));
    }

    /**
     * 约束校验失败（@Validated 路径/查询参数）：返回 400。
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraintViolation(ConstraintViolationException ex) {
        String message = ex.getConstraintViolations().stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .collect(Collectors.joining("; "));
        log.warn("约束校验失败: {}", message);
        return ResponseEntity.badRequest()
                .body(ApiResponse.fail(ErrorCode.BIZ_PARAMS_INVALID, message));
    }

    /**
     * 参数类型不匹配：返回 400。
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        String message = "参数 " + ex.getName() + " 类型不合法";
        log.warn("参数类型不匹配: {}", message);
        return ResponseEntity.badRequest()
                .body(ApiResponse.fail(ErrorCode.BIZ_PARAMS_INVALID, message));
    }

    /**
     * 请求体不可读（JSON 格式错误）：返回 400。
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleHttpMessageNotReadable(HttpMessageNotReadableException ex) {
        log.warn("请求体解析失败: {}", ex.getMessage());
        return ResponseEntity.badRequest()
                .body(ApiResponse.fail(ErrorCode.BIZ_PARAMS_INVALID, "请求体格式错误"));
    }

    /**
     * 兜底未知异常：返回 500。
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnknownException(Exception ex) {
        log.error("未捕获异常", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.fail(ErrorCode.SYS_INTERNAL_ERROR));
    }

    private String formatFieldError(FieldError error) {
        return error.getField() + ": " + error.getDefaultMessage();
    }
}
