package com.fj.project.repository;

import com.fj.project.entity.InspectionFormItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 检查表条目 Repository。
 */
@Repository
public interface InspectionFormItemRepository extends JpaRepository<InspectionFormItem, Long> {

    /** 按检查表 ID 查询条目（按 sort_order 排序） */
    List<InspectionFormItem> findByFormIdOrderBySortOrderAsc(Long formId);

    /** 判断检查表下是否存在条目 */
    boolean existsByFormId(Long formId);
}
