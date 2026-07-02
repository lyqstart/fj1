package com.fj.approval.repository;

import com.fj.approval.entity.ApprovalRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 审批记录 Repository（§7.4 只写留痕）。
 * <p><b>注意</b>：本 Repository 仅支持 {@link #save(Object)}（INSERT）和查询方法。
 * <p>禁止调用 {@link #saveAndFlush(Object)} 对已存在记录执行 UPDATE（数据库触发器会阻断），
 * 也不应调用 {@link #deleteById(Object)} / {@link #delete(Object)}（触发器阻断 DELETE）。
 */
@Repository
public interface ApprovalRecordRepository extends JpaRepository<ApprovalRecord, Long> {

    /** 按审批实例 ID 查询所有记录，按创建时间升序（链式哈希校验需按写入顺序遍历） */
    List<ApprovalRecord> findByInstanceIdOrderByCreatedAtAsc(Long instanceId);
}
