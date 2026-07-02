package com.fj.system.repository;

import com.fj.system.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 用户 Repository（Spring Data JPA 自动实现）。
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /** 按用户名精确查询（登录鉴权用） */
    Optional<User> findByUsername(String username);

    /** 判断用户名是否已存在（创建时唯一性预检） */
    boolean existsByUsername(String username);
}
