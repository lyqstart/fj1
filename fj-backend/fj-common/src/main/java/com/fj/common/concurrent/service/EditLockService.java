package com.fj.common.concurrent.service;

import com.fj.common.concurrent.entity.EditLock;
import com.fj.common.concurrent.repository.EditLockRepository;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * 编辑锁服务（§101.20 / DD-8，防止日报等资源并发编辑）。
 *
 * <p>锁生命周期：
 * <ul>
 *   <li>获取：TTL 30 分钟（{@link #LOCK_TTL}）</li>
 *   <li>续期：客户端每 5 分钟心跳一次（{@link #RENEW_INTERVAL}），续期后 TTL 重置为 30 分钟</li>
 *   <li>释放：主动释放或超时自动过期（由 {@code EditLockCleanupJob} 清理）</li>
 * </ul>
 *
 * <p>§10.1 权限先于锁：即使资源被锁，有 manage 权限的用户可通过 {@link #forceRelease} 强制释放。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EditLockService {

    /** 锁 TTL（获取/续期后有效期）：30 分钟 */
    static final Duration LOCK_TTL = Duration.ofMinutes(30);

    /** 客户端心跳续期间隔建议值：5 分钟（仅作为约定常量，服务端不做频率强制） */
    static final Duration RENEW_INTERVAL = Duration.ofMinutes(5);

    private final EditLockRepository editLockRepository;

    /**
     * 获取（或续期）资源编辑锁。
     *
     * @param resourceType 资源类型
     * @param resourceId   资源 ID
     * @param userId       当前用户 ID
     * @return 锁令牌（UUID）
     * @throws BusinessException 资源被他人锁定时抛出
     */
    @Transactional
    public String acquireLock(String resourceType, Long resourceId, Long userId) {
        Optional<EditLock> existing = editLockRepository.findByResourceTypeAndResourceId(resourceType, resourceId);
        OffsetDateTime now = OffsetDateTime.now();

        if (existing.isPresent()) {
            EditLock lock = existing.get();
            boolean valid = lock.getExpiresAt() != null && lock.getExpiresAt().isAfter(now);

            if (valid) {
                // 有效锁存在
                if (!userId.equals(lock.getLockedByUserId())) {
                    // 被他人锁定 → 拒绝
                    throw new BusinessException(ErrorCode.DATA_CONCURRENT_MODIFICATION,
                            "资源被他人锁定，无法编辑");
                }
                // 自己持锁 → 续期（复用原 token，重置 TTL 30 分钟）
                lock.setExpiresAt(now.plus(LOCK_TTL));
                editLockRepository.save(lock);
                return lock.getLockToken();
            }
            // 锁已过期 → 删除旧锁后新建（规避唯一约束 uk_edit_locks_resource）
            editLockRepository.delete(lock);
            editLockRepository.flush();
        }

        // 创建新锁，TTL 30 分钟
        EditLock newLock = new EditLock();
        newLock.setResourceType(resourceType);
        newLock.setResourceId(resourceId);
        newLock.setLockedByUserId(userId);
        newLock.setLockToken(UUID.randomUUID().toString());
        newLock.setExpiresAt(now.plus(LOCK_TTL));
        editLockRepository.save(newLock);
        return newLock.getLockToken();
    }

    /**
     * 心跳续期锁。校验令牌有效且属于当前用户。
     *
     * @param lockToken 锁令牌
     * @param userId    当前用户 ID
     * @throws BusinessException 令牌不存在/已过期/不属于该用户时抛出
     */
    @Transactional
    public void renewLock(String lockToken, Long userId) {
        EditLock lock = editLockRepository.findByLockToken(lockToken)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "锁不存在或已过期"));
        if (!userId.equals(lock.getLockedByUserId())) {
            throw new BusinessException(ErrorCode.AUTHZ_NO_PERMISSION, "无权续期他人持有的锁");
        }
        OffsetDateTime now = OffsetDateTime.now();
        if (lock.getExpiresAt() != null && !lock.getExpiresAt().isAfter(now)) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "锁已过期，请重新获取");
        }
        // 续期：TTL 重置为 30 分钟
        lock.setExpiresAt(now.plus(LOCK_TTL));
        editLockRepository.save(lock);
    }

    /** 主动释放锁（仅持锁人可释放） */
    @Transactional
    public void releaseLock(String lockToken, Long userId) {
        EditLock lock = editLockRepository.findByLockToken(lockToken)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "锁不存在"));
        if (!userId.equals(lock.getLockedByUserId())) {
            throw new BusinessException(ErrorCode.AUTHZ_NO_PERMISSION, "无权释放他人持有的锁");
        }
        editLockRepository.delete(lock);
    }

    /**
     * 强制释放锁（§10.1 权限先于锁）。
     * <p>调用方需自行校验 manage 权限，本方法不做权限判断。
     */
    @Transactional
    public void forceRelease(String resourceType, Long resourceId) {
        editLockRepository.findByResourceTypeAndResourceId(resourceType, resourceId)
                .ifPresent(editLockRepository::delete);
    }
}
