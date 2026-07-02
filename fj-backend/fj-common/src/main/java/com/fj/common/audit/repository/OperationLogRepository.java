package com.fj.common.audit.repository;

import com.fj.common.audit.entity.OperationLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 操作日志仓储（V1 operation_logs 表）。
 *
 * <p><b>只写不可改删</b>：本接口仅继承查询/插入能力，不声明任何 update/delete 派生方法，
 * 以保证审计日志的不可变性（§7.4）。如需归档清理，应通过独立运维流程处理。
 */
@Repository
public interface OperationLogRepository extends JpaRepository<OperationLog, Long> {

    /** 获取链尾最新一条记录（用于计算下一条的 prev_hash） */
    Optional<OperationLog> findTopByOrderByCreatedAtDesc();
}
