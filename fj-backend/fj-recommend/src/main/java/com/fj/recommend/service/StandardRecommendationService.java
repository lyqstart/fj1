package com.fj.recommend.service;

import com.fj.project.entity.CheckItemStandardBinding;
import com.fj.project.repository.CheckItemStandardBindingRepository;
import com.fj.recommend.entity.StandardClause;
import com.fj.recommend.entity.StandardDocument;
import com.fj.recommend.entity.StandardRecommendationResult;
import com.fj.recommend.repository.StandardClauseRepository;
import com.fj.recommend.repository.StandardDocumentRepository;
import com.fj.recommend.repository.StandardRecommendationResultRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 标准推荐 Service（DD-11 / §69 三层规则匹配）。
 *
 * <h3>三层评分规则（§69.1-69.3）</h3>
 * <ol>
 *   <li><b>检查项绑定</b>（+50 分，可配置）：CheckItemStandardBinding 中固定的检查项-条款绑定，
 *       取 {@code scoreWeight}（默认 50）。</li>
 *   <li><b>分类匹配</b>（+15 或 +10 分）：问题 category 命中 StandardClause.category。
 *       精确匹配 +15；包含匹配（子串，忽略大小写）+10。</li>
 *   <li><b>关键词匹配</b>（+5 分/词，最多 +20 分）：问题关键词命中 clause.keywordTags / content。</li>
 * </ol>
 *
 * <p>各层得分累加，按总分降序返回。V1 仅做规则匹配，不做 AI/RAG（§107.6）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StandardRecommendationService {

    /** 关键词层得分上限（§69.3：最多 +20 分） */
    private static final int KEYWORD_SCORE_CAP = 20;
    /** 单个关键词命中得分 */
    private static final int KEYWORD_SCORE_PER_HIT = 5;
    /** 分类精确匹配得分 */
    private static final int CATEGORY_EXACT_SCORE = 15;
    /** 分类包含匹配得分 */
    private static final int CATEGORY_CONTAIN_SCORE = 10;

    private final CheckItemStandardBindingRepository bindingRepository;
    private final StandardClauseRepository clauseRepository;
    private final StandardDocumentRepository documentRepository;
    private final StandardRecommendationResultRepository resultRepository;

    /**
     * 三层规则推荐（不落库，适用于离线推荐缓存接口 / 手动预览）。
     *
     * @param checkItemId    检查项 ID（可空：无绑定时跳过第一层）
     * @param issueCategory  问题分类（可空）
     * @param issueKeywords  问题关键词（可空 / 可为空列表）
     * @param projectId      项目 ID（用于结果归属）
     * @return 按得分降序排列的推荐结果（不含 issueId）
     */
    @Transactional(readOnly = true)
    public List<StandardRecommendationResult> recommend(Long checkItemId,
                                                        String issueCategory,
                                                        List<String> issueKeywords,
                                                        Long projectId) {
        // 收集候选条款与三层得分
        Map<Long, ScoreAccumulator> scores = new HashMap<>();

        // ===== 第一层：检查项绑定（+scoreWeight，默认 50） =====
        applyBindingLayer(checkItemId, scores);

        // ===== 第二层：分类匹配（+15 / +10） =====
        applyCategoryLayer(issueCategory, scores);

        // ===== 第三层：关键词匹配（+5/词，上限 +20） =====
        applyKeywordLayer(issueKeywords, scores);

        // 汇总为结果列表
        return buildResults(scores, projectId, null);
    }

    /**
     * 生成并持久化推荐结果（创建问题 / 字段变更触发时调用）。
     * <p>若该 issueId 已有结果，先删除再重新生成（保证快照为最新）。
     *
     * @param issueId        问题 ID
     * @param checkItemId    检查项 ID（可空）
     * @param issueCategory  问题分类（可空）
     * @param issueKeywords  问题关键词（可空）
     * @param projectId      项目 ID
     * @return 持久化后的推荐结果（按得分降序）
     */
    @Transactional
    public List<StandardRecommendationResult> generateAndSave(Long issueId,
                                                              Long checkItemId,
                                                              String issueCategory,
                                                              List<String> issueKeywords,
                                                              Long projectId) {
        // 字段变更触发重新推荐：先清后写
        resultRepository.deleteByIssueId(issueId);

        List<StandardRecommendationResult> results = recommend(checkItemId, issueCategory, issueKeywords, projectId);
        for (StandardRecommendationResult r : results) {
            r.setIssueId(issueId);
        }
        return resultRepository.saveAll(results);
    }

    /**
     * 查询某问题已缓存的推荐结果（离线推荐缓存命中）。
     */
    @Transactional(readOnly = true)
    public List<StandardRecommendationResult> getByIssueId(Long issueId) {
        return resultRepository.findByIssueIdOrderByScoreDesc(issueId);
    }

    // ==================== 三层规则实现 ====================

    /** 第一层：检查项绑定 → +binding.scoreWeight（默认 50） */
    private void applyBindingLayer(Long checkItemId, Map<Long, ScoreAccumulator> scores) {
        if (checkItemId == null) {
            return;
        }
        List<CheckItemStandardBinding> bindings = bindingRepository.findByCheckItemId(checkItemId);
        for (CheckItemStandardBinding b : bindings) {
            int weight = b.getScoreWeight() == null ? 50 : b.getScoreWeight();
            scores.computeIfAbsent(b.getStandardClauseId(), k -> new ScoreAccumulator())
                    .add(weight, "检查项绑定+" + weight);
        }
    }

    /** 第二层：分类匹配 → 精确 +15 / 包含 +10 */
    private void applyCategoryLayer(String issueCategory, Map<Long, ScoreAccumulator> scores) {
        if (issueCategory == null || issueCategory.isBlank()) {
            return;
        }
        List<StandardClause> candidates = clauseRepository.findAll();
        String target = issueCategory.trim().toLowerCase();
        for (StandardClause c : candidates) {
            if (c.getCategory() == null || c.getCategory().isBlank()) {
                continue;
            }
            String clauseCat = c.getCategory().trim().toLowerCase();
            if (clauseCat.equals(target)) {
                scores.computeIfAbsent(c.getId(), k -> new ScoreAccumulator())
                        .add(CATEGORY_EXACT_SCORE, "分类匹配+" + CATEGORY_EXACT_SCORE);
            } else if (clauseCat.contains(target) || target.contains(clauseCat)) {
                scores.computeIfAbsent(c.getId(), k -> new ScoreAccumulator())
                        .add(CATEGORY_CONTAIN_SCORE, "分类匹配+" + CATEGORY_CONTAIN_SCORE);
            }
        }
    }

    /** 第三层：关键词匹配 → +5/词，上限 +20 */
    private void applyKeywordLayer(List<String> issueKeywords, Map<Long, ScoreAccumulator> scores) {
        if (issueKeywords == null || issueKeywords.isEmpty()) {
            return;
        }
        // 标准化关键词
        Set<String> normKeywords = issueKeywords.stream()
                .filter(k -> k != null && !k.isBlank())
                .map(k -> k.trim().toLowerCase())
                .collect(Collectors.toCollection(HashSet::new));
        if (normKeywords.isEmpty()) {
            return;
        }

        // 候选条款：已有得分的 + 全部（关键词可能命中未在候选中的条款）
        Set<Long> candidateIds = new HashSet<>(scores.keySet());
        List<StandardClause> allClauses = clauseRepository.findAll();
        for (StandardClause c : allClauses) {
            if (!candidateIds.contains(c.getId())) {
                candidateIds.add(c.getId());
            }
        }

        for (StandardClause c : allClauses) {
            String tags = c.getKeywordTags() == null ? "" : c.getKeywordTags().toLowerCase();
            String content = c.getContent() == null ? "" : c.getContent().toLowerCase();
            int hits = 0;
            int gained = 0;
            for (String kw : normKeywords) {
                if (gained >= KEYWORD_SCORE_CAP) {
                    break;
                }
                if (tags.contains(kw) || content.contains(kw)) {
                    hits++;
                    gained += KEYWORD_SCORE_PER_HIT;
                }
            }
            if (gained > 0) {
                int capped = Math.min(gained, KEYWORD_SCORE_CAP);
                scores.computeIfAbsent(c.getId(), k -> new ScoreAccumulator())
                        .add(capped, "关键词+" + capped + "(命中" + hits + "词)");
            }
        }
    }

    /** 汇总得分 → 推荐结果（按得分降序） */
    private List<StandardRecommendationResult> buildResults(Map<Long, ScoreAccumulator> scores,
                                                            Long projectId, Long issueId) {
        // 预加载条款与文档版本
        Map<Long, StandardClause> clauseMap = new HashMap<>();
        Map<Long, String> docVersionMap = new HashMap<>();
        for (Long clauseId : scores.keySet()) {
            clauseRepository.findById(clauseId).ifPresent(c -> {
                clauseMap.put(clauseId, c);
                if (c.getDocumentId() != null) {
                    documentRepository.findById(c.getDocumentId()).ifPresent(d ->
                            docVersionMap.put(clauseId, d.getVersion()));
                }
            });
        }

        List<StandardRecommendationResult> results = new ArrayList<>();
        for (Map.Entry<Long, ScoreAccumulator> e : scores.entrySet()) {
            Long clauseId = e.getKey();
            ScoreAccumulator acc = e.getValue();
            if (!clauseMap.containsKey(clauseId)) {
                continue; // 条款不存在（数据不一致），跳过
            }
            StandardRecommendationResult r = new StandardRecommendationResult();
            r.setProjectId(projectId);
            r.setIssueId(issueId);
            r.setClauseId(clauseId);
            r.setScore(acc.total);
            r.setReasonSnapshot(String.join(";", acc.reasons));
            r.setStandardLibraryVersion(docVersionMap.get(clauseId));
            results.add(r);
        }
        results.sort((a, b) -> Integer.compare(b.getScore(), a.getScore()));
        return results;
    }

    /** 得分累加器 */
    private static class ScoreAccumulator {
        int total = 0;
        final List<String> reasons = new ArrayList<>();

        void add(int delta, String reason) {
            total += delta;
            reasons.add(reason);
        }
    }
}
