package com.fj.recommend.controller;

import com.fj.common.response.ApiResponse;
import com.fj.recommend.entity.StandardRecommendationResult;
import com.fj.recommend.service.StandardRecommendationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * 标准推荐 REST API（DD-11）。
 * <ul>
 *   <li>{@code POST /api/v1/recommendations/generate} — 生成并持久化推荐结果（创建问题 / 字段变更触发）。</li>
 *   <li>{@code GET  /api/v1/recommendations?issueId=}  — 查询已缓存的推荐结果。</li>
 *   <li>{@code GET  /api/v1/recommendations/preview}   — 不落库的离线推荐预览。</li>
 * </ul>
 */
@RestController
@RequiredArgsConstructor
public class RecommendationController {

    private final StandardRecommendationService recommendationService;

    /**
     * 生成并持久化推荐结果。
     *
     * @param issueId       问题 ID
     * @param projectId     项目 ID
     * @param checkItemId   检查项 ID（可空）
     * @param issueCategory 问题分类（可空）
     * @param issueKeywords 问题关键词（逗号分隔，可空）
     */
    @PostMapping("/api/v1/recommendations/generate")
    public ApiResponse<List<StandardRecommendationResult>> generate(
            @RequestParam Long issueId,
            @RequestParam Long projectId,
            @RequestParam(required = false) Long checkItemId,
            @RequestParam(required = false) String issueCategory,
            @RequestParam(required = false) String issueKeywords) {
        List<String> keywords = parseKeywords(issueKeywords);
        return ApiResponse.ok(recommendationService.generateAndSave(
                issueId, checkItemId, issueCategory, keywords, projectId));
    }

    /**
     * 查询已缓存的推荐结果（按得分降序）。
     */
    @GetMapping("/api/v1/recommendations")
    public ApiResponse<List<StandardRecommendationResult>> list(@RequestParam Long issueId) {
        return ApiResponse.ok(recommendationService.getByIssueId(issueId));
    }

    /**
     * 离线推荐预览（不落库，可用于推荐缓存接口调试）。
     */
    @GetMapping("/api/v1/recommendations/preview")
    public ApiResponse<List<StandardRecommendationResult>> preview(
            @RequestParam Long projectId,
            @RequestParam(required = false) Long checkItemId,
            @RequestParam(required = false) String issueCategory,
            @RequestParam(required = false) String issueKeywords) {
        List<String> keywords = parseKeywords(issueKeywords);
        return ApiResponse.ok(recommendationService.recommend(
                checkItemId, issueCategory, keywords, projectId));
    }

    /** 逗号分隔关键词 → 列表 */
    private List<String> parseKeywords(String raw) {
        if (raw == null || raw.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
