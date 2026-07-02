package com.fj.recommend.repository;

import com.fj.recommend.entity.StandardRecommendationResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 标准推荐结果 Repository。
 */
@Repository
public interface StandardRecommendationResultRepository
        extends JpaRepository<StandardRecommendationResult, Long> {

    /** 按问题查询推荐结果（按得分降序） */
    List<StandardRecommendationResult> findByIssueIdOrderByScoreDesc(Long issueId);

    /** 按项目查询推荐结果 */
    List<StandardRecommendationResult> findByProjectId(Long projectId);

    /** 删除某问题的全部推荐结果（字段变更触发重新推荐时先清后写） */
    void deleteByIssueId(Long issueId);

    /** 判断某问题是否已有推荐结果（缓存命中判断） */
    boolean existsByIssueId(Long issueId);
}
