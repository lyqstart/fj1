package com.fj.common.concurrent.repository;

import com.fj.common.concurrent.entity.EditLock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * 编辑锁仓储（V4 edit_locks 表）。
 */
@Repository
public interface EditLockRepository extends JpaRepository<EditLock, Long> {

    /** 按资源类型+ID 查询锁（受唯一约束 uk_edit_locks_resource 保证最多一条） */
    Optional<EditLock> findByResourceTypeAndResourceId(String resourceType, Long resourceId);

    /** 按锁令牌查询 */
    Optional<EditLock> findByLockToken(String lockToken);

    /** 删除所有过期锁（expires_at < 指定时间），返回删除行数 */
    @Modifying
    @Query("delete from EditLock e where e.expiresAt < :threshold")
    int deleteByExpiresAtBefore(@Param("threshold") OffsetDateTime threshold);
}
