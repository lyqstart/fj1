package com.fj.recommend.repository;

import com.fj.recommend.entity.StandardClause;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 标准条款 Repository（支持按 keywords / category / clause_number 检索）。
 */
@Repository
public interface StandardClauseRepository extends JpaRepository<StandardClause, Long> {

    /** 按所属文档查询条款 */
    List<StandardClause> findByDocumentId(Long documentId);

    /** 按问题分类查询条款 */
    List<StandardClause> findByCategory(String category);

    /** 按条款号精确查询 */
    StandardClause findByClauseNumber(String clauseNumber);

    /**
     * 关键词模糊检索（keyword_tags / content 命中关键词）。
     */
    @Query("SELECT c FROM StandardClause c WHERE " +
            "LOWER(c.keywordTags) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "OR LOWER(c.content) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    List<StandardClause> searchByKeyword(@Param("keyword") String keyword);
}
