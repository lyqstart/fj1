package com.fj.system.repository;

import com.fj.system.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 角色 Repository。
 */
@Repository
public interface RoleRepository extends JpaRepository<Role, Long> {

    /** 按角色编码查询（如 ROLE_INSPECTOR） */
    Optional<Role> findByCode(String code);
}
