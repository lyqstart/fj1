package com.fj.recommend.repository;

import com.fj.recommend.entity.StandardIssueTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 标准问题模板 Repository。
 */
@Repository
public interface StandardIssueTemplateRepository extends JpaRepository<StandardIssueTemplate, Long> {

    /** 按分类查询模板 */
    List<StandardIssueTemplate> findByCategory(String category);
}
