package com.fj.issue.controller;

import com.fj.common.enume.IssueSeverity;
import com.fj.common.response.ApiResponse;
import com.fj.issue.entity.IssueRelation;
import com.fj.issue.entity.ProjectIssue;
import com.fj.issue.entity.RelationType;
import com.fj.issue.service.IssueRelationService;
import com.fj.issue.service.IssueReviewService;
import com.fj.issue.service.ReviewAction;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 问题复核 / 关联管理 REST API（TASK-032）。
 * <p>组长复核操作（PASS/RETURN/ADJUST/VOID/CORRECT）与问题关联（重复 / 相似）管理。
 */
@RestController
@RequestMapping("/api/v1/issues")
@RequiredArgsConstructor
public class IssueReviewController {

    private final IssueReviewService issueReviewService;
    private final IssueRelationService issueRelationService;

    /**
     * 组长复核问题。
     * <p>请求体示例：{@code { "action": "PASS", "comment": "复核通过", "newSeverity": "MAJOR" }}
     * <p>{@code newSeverity} 仅 action=ADJUST 时生效。
     *
     * @param id      问题 ID
     * @param request 复核请求
     */
    @PostMapping("/{id}/review")
    public ApiResponse<ProjectIssue> review(@PathVariable Long id, @RequestBody ReviewRequest request) {
        return ApiResponse.ok(issueReviewService.review(
                id, request.action(), request.comment(), request.newSeverity()));
    }

    /**
     * 创建问题关联（重复 / 相似）。
     * <p>请求体示例：{@code { "targetIssueId": 456, "relationType": "DUPLICATE" }}
     * <p>{@code relationType}：{@code DUPLICATE} 或 {@code SIMILAR}。
     *
     * @param id      源问题 ID
     * @param request 关联请求
     */
    @PostMapping("/{id}/relations")
    public ApiResponse<IssueRelation> createRelation(@PathVariable Long id, @RequestBody RelationRequest request) {
        IssueRelation relation;
        if (request.relationType() == RelationType.DUPLICATE) {
            relation = issueRelationService.linkAsDuplicate(id, request.targetIssueId());
        } else if (request.relationType() == RelationType.SIMILAR) {
            relation = issueRelationService.linkAsSimilar(id, request.targetIssueId());
        } else {
            throw new IllegalArgumentException("不支持的关联类型: " + request.relationType());
        }
        return ApiResponse.ok(relation);
    }

    /**
     * 取消问题关联。
     *
     * @param id         源问题 ID（路径占位，关联记录由 relationId 唯一定位）
     * @param relationId 关联记录 ID
     */
    @DeleteMapping("/{id}/relations/{relationId}")
    public ApiResponse<Void> deleteRelation(@PathVariable Long id, @PathVariable Long relationId) {
        issueRelationService.unlink(relationId);
        return ApiResponse.ok();
    }

    /** 复核请求体 */
    public record ReviewRequest(ReviewAction action, String comment, IssueSeverity newSeverity) {
    }

    /** 关联请求体 */
    public record RelationRequest(Long targetIssueId, RelationType relationType) {
    }
}
