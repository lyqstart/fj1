package com.fj.project.repository;

import com.fj.project.entity.CheckItemStandardBinding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 检查项-标准条款绑定 Repository。
 */
@Repository
public interface CheckItemStandardBindingRepository extends JpaRepository<CheckItemStandardBinding, Long> {

    /** 按检查项 ID 查询绑定列表 */
    List<CheckItemStandardBinding> findByCheckItemId(Long checkItemId);

    /** 按标准条款 ID 查询绑定列表 */
    List<CheckItemStandardBinding> findByStandardClauseId(Long standardClauseId);

    /** 判断检查项-条款绑定是否已存在 */
    boolean existsByCheckItemIdAndStandardClauseId(Long checkItemId, Long standardClauseId);
}
