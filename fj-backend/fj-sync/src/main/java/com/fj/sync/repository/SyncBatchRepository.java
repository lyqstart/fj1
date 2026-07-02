package com.fj.sync.repository;

import com.fj.sync.entity.SyncBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 同步批次 Repository。
 * <p>{@code client_batch_uuid} 为幂等键，重复 push 据此命中已有记录。
 */
@Repository
public interface SyncBatchRepository extends JpaRepository<SyncBatch, Long> {

    /** 按客户端批次 UUID 查询（幂等命中） */
    Optional<SyncBatch> findByClientBatchUuid(String clientBatchUuid);

    /** 判断批次 UUID 是否已存在 */
    boolean existsByClientBatchUuid(String clientBatchUuid);
}
