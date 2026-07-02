package com.fj.system.repository;

import com.fj.system.entity.UserProjectRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 用户-项目-角色关联 Repository（项目级 RBAC 校验用，TASK-008 依赖）。
 */
@Repository
public interface UserProjectRoleRepository extends JpaRepository<UserProjectRole, Long> {

    /** 查询某用户在某项目的所有角色绑定 */
    List<UserProjectRole> findByUserIdAndProjectId(Long userId, Long projectId);

    /** 查询某用户的所有角色绑定（跨项目，用于全局权限校验） */
    List<UserProjectRole> findByUserId(Long userId);
}
