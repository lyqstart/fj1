package com.fj.issue.repository;

import com.fj.issue.entity.IssueRelation;
import com.fj.issue.entity.RelationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 问题关联 Repository。
 */
@Repository
public interface IssueRelationRepository extends JpaRepository<IssueRelation, Long> {

    /** 按源问题 ID 查询所有关联 */
    List<IssueRelation> findBySourceIssueId(Long sourceIssueId);

    /** 按目标问题 ID 查询所有关联（反向查询） */
    List<IssueRelation> findByTargetIssueId(Long targetIssueId);

    /** 校验是否已存在相同源/目标/类型的关联（防止重复关联） */
    boolean existsBySourceIssueIdAndTargetIssueIdAndRelationType(
            Long sourceIssueId, Long targetIssueId, RelationType relationType);
}
