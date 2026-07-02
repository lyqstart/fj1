package com.fj.issue.service;

import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.issue.entity.IssueRelation;
import com.fj.issue.entity.RelationType;
import com.fj.issue.repository.IssueRelationRepository;
import com.fj.issue.repository.ProjectIssueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 问题关联 Service（TASK-032）。
 * <p>核心职责：维护两个 ProjectIssue 之间的关联（重复 / 相似）。
 * <p>关键规则：
 * <ul>
 *   <li>禁止自关联（sourceId == targetId 抛异常）</li>
 *   <li>禁止重复关联（同 source/target/type 已存在则抛异常）</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IssueRelationService {

    private final IssueRelationRepository issueRelationRepository;
    private final ProjectIssueRepository projectIssueRepository;

    /**
     * 关联为重复问题（DUPLICATE）。
     *
     * @param sourceIssueId 源问题 ID
     * @param targetIssueId 目标问题 ID
     * @return 创建的关联记录
     */
    @Transactional
    public IssueRelation linkAsDuplicate(Long sourceIssueId, Long targetIssueId) {
        return link(sourceIssueId, targetIssueId, RelationType.DUPLICATE);
    }

    /**
     * 关联为相似问题（SIMILAR）。
     *
     * @param sourceIssueId 源问题 ID
     * @param targetIssueId 目标问题 ID
     * @return 创建的关联记录
     */
    @Transactional
    public IssueRelation linkAsSimilar(Long sourceIssueId, Long targetIssueId) {
        return link(sourceIssueId, targetIssueId, RelationType.SIMILAR);
    }

    /**
     * 取消关联。
     *
     * @param relationId 关联记录 ID
     */
    @Transactional
    public void unlink(Long relationId) {
        if (!issueRelationRepository.existsById(relationId)) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "问题关联不存在: " + relationId);
        }
        issueRelationRepository.deleteById(relationId);
        log.info("问题关联 {} 已取消", relationId);
    }

    // ==================== 内部工具 ====================

    private IssueRelation link(Long sourceIssueId, Long targetIssueId, RelationType relationType) {
        // 1. 防止自关联
        if (sourceIssueId != null && sourceIssueId.equals(targetIssueId)) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID,
                    "问题不可与自身建立关联（sourceIssueId == targetIssueId == " + sourceIssueId + "）");
        }
        requireIssueExists(sourceIssueId, "sourceIssueId");
        requireIssueExists(targetIssueId, "targetIssueId");

        // 2. 防止重复关联
        if (issueRelationRepository.existsBySourceIssueIdAndTargetIssueIdAndRelationType(
                sourceIssueId, targetIssueId, relationType)) {
            throw new BusinessException(ErrorCode.DATA_ALREADY_EXISTS,
                    "关联已存在：source=" + sourceIssueId + ", target=" + targetIssueId + ", type=" + relationType);
        }

        IssueRelation relation = new IssueRelation();
        relation.setSourceIssueId(sourceIssueId);
        relation.setTargetIssueId(targetIssueId);
        relation.setRelationType(relationType);
        IssueRelation saved = issueRelationRepository.save(relation);

        log.info("问题关联已创建：{} {} {}（{}）",
                sourceIssueId, relationType, targetIssueId, saved.getId());
        return saved;
    }

    private void requireIssueExists(Long issueId, String fieldName) {
        if (issueId == null) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, fieldName + " 不能为空");
        }
        if (!projectIssueRepository.existsById(issueId)) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "问题不存在: " + issueId);
        }
    }
}
