package com.fj.common.audit;

import com.fj.common.audit.aspect.OperationLogAspect;
import com.fj.common.audit.service.OperationLogService;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.reflect.MethodSignature;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * OperationLogAspect 单元测试 — 验证 G2 修复（越权留痕）。
 *
 * <p>聚焦 {@link OperationLogAspect#logPermissionDenied(JoinPoint, Throwable)} advice：
 * <ul>
 *   <li>权限拒绝异常（错误码 2xxx）→ 记录一条 ACCESS_DENIED 审计日志</li>
 *   <li>非权限类异常（认证 / 业务 / 非业务）→ 不记录</li>
 *   <li>审计写入失败 → 降级为 WARN，不影响业务主流程</li>
 * </ul>
 *
 * <p>注：{@code @RequirePermission} 位于 fj-auth 模块，fj-common 测试类路径上不存在该类型
 * （依赖方向 fj-auth → fj-common），故 {@code describeDeniedPermission} 反射查不到该注解，
 * content 退化为 "权限拒绝"。注解元数据读取需在 fj-auth 集成测试中覆盖；本测试仅验证
 * G2 的留痕动作与降级语义。
 */
@ExtendWith(MockitoExtension.class)
class OperationLogAspectTest {

    @Mock
    private OperationLogService operationLogService;

    @InjectMocks
    private OperationLogAspect aspect;

    /** 占位方法，用于构造 MethodSignature.getMethod() 所需的真实 Method 对象。 */
    public void interceptedControllerMethod() {
        // no-op：仅供反射读取
    }

    // ==================== 场景 1：权限拒绝异常 → 记录 ACCESS_DENIED ====================

    @Test
    @DisplayName("权限拒绝异常(错误码2001) → 记录一条 ACCESS_DENIED 审计日志")
    void testPermissionDenied_LogsAccessDenied() {
        JoinPoint joinPoint = mockJoinPoint();
        Throwable ex = new BusinessException(ErrorCode.AUTHZ_NO_PERMISSION); // 2001 权限类

        aspect.logPermissionDenied(joinPoint, ex);

        // 验证：写入了 action=ACCESS_DENIED 的审计记录，operatorId/targetId 为 null
        verify(operationLogService).log(
                isNull(),
                eq("ACCESS_DENIED"),
                eq("OperationLogAspectTest"),
                isNull(),
                eq("权限拒绝"));
    }

    @Test
    @DisplayName("数据权限越权(错误码2004) → 同样记录 ACCESS_DENIED")
    void testPermissionDenied_DataScope_LogsAccessDenied() {
        JoinPoint joinPoint = mockJoinPoint();
        Throwable ex = new BusinessException(ErrorCode.AUTHZ_DATA_SCOPE_DENIED); // 2004

        aspect.logPermissionDenied(joinPoint, ex);

        verify(operationLogService).log(
                isNull(), eq("ACCESS_DENIED"), anyString(), isNull(), anyString());
    }

    // ==================== 场景 2：非权限异常 → 不记录 ====================

    @Test
    @DisplayName("业务类异常(错误码3001) → 不记录")
    void testNonPermissionException_DoesNotLog() {
        JoinPoint joinPoint = mock(JoinPoint.class);
        Throwable ex = new BusinessException(ErrorCode.BIZ_RESOURCE_NOT_FOUND); // 3001 业务类

        aspect.logPermissionDenied(joinPoint, ex);

        verifyNoInteractions(operationLogService);
    }

    @Test
    @DisplayName("认证类异常(错误码1002) → 不记录（不属于权限段）")
    void testAuthException_DoesNotLog() {
        JoinPoint joinPoint = mock(JoinPoint.class);
        Throwable ex = new BusinessException(ErrorCode.AUTH_TOKEN_INVALID); // 1002 认证类

        aspect.logPermissionDenied(joinPoint, ex);

        verifyNoInteractions(operationLogService);
    }

    @Test
    @DisplayName("非 BusinessException(普通 RuntimeException) → 不记录")
    void testNonBusinessException_DoesNotLog() {
        JoinPoint joinPoint = mock(JoinPoint.class);
        Throwable ex = new IllegalStateException("普通异常");

        aspect.logPermissionDenied(joinPoint, ex);

        verifyNoInteractions(operationLogService);
    }

    // ==================== 场景 3：审计写入失败 → 降级不 throw ====================

    @Test
    @DisplayName("审计日志写入失败 → 降级为 WARN，不影响业务主流程")
    void testLogWriteFailure_DoesNotThrow() {
        JoinPoint joinPoint = mockJoinPoint();
        Throwable ex = new BusinessException(ErrorCode.AUTHZ_NO_PERMISSION); // 2001
        doThrow(new RuntimeException("数据库不可用"))
                .when(operationLogService)
                .log(any(), anyString(), any(), any(), anyString());

        // 切面必须吞掉日志异常，绝不向业务抛出
        assertDoesNotThrow(() -> aspect.logPermissionDenied(joinPoint, ex));
    }

    // ==================== 辅助方法 ====================

    /**
     * 构造一个携带真实 Method 的 JoinPoint mock。
     * declaringType 设为测试类本身，故 targetType 将为 "OperationLogAspectTest"。
     */
    private JoinPoint mockJoinPoint() {
        JoinPoint joinPoint = mock(JoinPoint.class);
        MethodSignature signature = mock(MethodSignature.class);
        try {
            Method method = OperationLogAspectTest.class.getMethod("interceptedControllerMethod");
            when(signature.getMethod()).thenReturn(method);
        } catch (NoSuchMethodException e) {
            throw new IllegalStateException("占位方法不存在", e);
        }
        when(signature.getDeclaringType()).thenReturn(OperationLogAspectTest.class);
        when(joinPoint.getSignature()).thenReturn(signature);
        return joinPoint;
    }
}
