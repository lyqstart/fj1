package com.fj.sync.repository;

import com.fj.sync.entity.ClientSyncState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 客户端同步状态 Repository。
 * <p>按 用户+设备+项目 唯一查询增量拉取游标。
 */
@Repository
public interface ClientSyncStateRepository extends JpaRepository<ClientSyncState, Long> {

    /** 按用户+设备+项目查询同步状态（唯一约束 uk_client_sync_state） */
    Optional<ClientSyncState> findByUserIdAndDeviceIdAndProjectId(Long userId, String deviceId, Long projectId);
}
