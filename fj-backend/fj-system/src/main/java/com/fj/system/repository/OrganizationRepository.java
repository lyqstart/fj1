package com.fj.system.repository;

import com.fj.system.entity.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 组织机构 Repository。
 */
@Repository
public interface OrganizationRepository extends JpaRepository<Organization, Long> {

    /** 查询某父组织下的直接子组织（构建组织树） */
    List<Organization> findByParentId(Long parentId);
}
