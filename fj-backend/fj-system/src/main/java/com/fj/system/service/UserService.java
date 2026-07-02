package com.fj.system.service;

import com.fj.common.dto.PageRequest;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.common.response.PageResponse;
import com.fj.system.entity.User;
import com.fj.system.entity.UserStatus;
import com.fj.system.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 用户管理 Service（基础 CRUD + BCrypt 密码编码）。
 * <p>密码哈希统一使用 BCrypt(cost=12)（DD-4 / §7.1）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    /** BCrypt 成本因子（DD-4 安全基线） */
    private static final int BCRYPT_COST = 12;

    private final UserRepository userRepository;

    /** BCrypt 编码器实例（cost=12），无状态可复用 */
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(BCRYPT_COST);

    /**
     * 创建用户。密码经 BCrypt 编码后存储，明文不留痕。
     */
    @Transactional
    public User create(User user) {
        if (userRepository.existsByUsername(user.getUsername())) {
            throw new BusinessException(ErrorCode.DATA_ALREADY_EXISTS, "用户名已存在: " + user.getUsername());
        }
        user.setPasswordHash(passwordEncoder.encode(user.getPasswordHash()));
        if (user.getStatus() == null) {
            user.setStatus(UserStatus.ACTIVE);
        }
        return userRepository.save(user);
    }

    /**
     * 更新用户（部分字段），不修改密码哈希。改密走独立流程。
     */
    @Transactional
    public User update(Long id, User patch) {
        User existing = requireUser(id);
        if (patch.getRealName() != null) {
            existing.setRealName(patch.getRealName());
        }
        if (patch.getPhone() != null) {
            existing.setPhone(patch.getPhone());
        }
        if (patch.getEmail() != null) {
            existing.setEmail(patch.getEmail());
        }
        if (patch.getStatus() != null) {
            existing.setStatus(patch.getStatus());
        }
        return userRepository.save(existing);
    }

    /**
     * 切换用户状态（启用/锁定/禁用）。
     */
    @Transactional
    public void updateStatus(Long id, UserStatus status) {
        User existing = requireUser(id);
        existing.setStatus(status);
        userRepository.save(existing);
    }

    /**
     * 更新最后登录时间（登录成功后调用）。
     */
    @Transactional
    public void updateLastLoginAt(Long id) {
        userRepository.findById(id).ifPresent(u -> {
            u.setLastLoginAt(OffsetDateTime.now());
            userRepository.save(u);
        });
    }

    /**
     * 查看用户详情。
     */
    @Transactional(readOnly = true)
    public User detail(Long id) {
        return requireUser(id);
    }

    /**
     * 按用户名查询（登录鉴权用），找不到抛业务异常。
     */
    @Transactional(readOnly = true)
    public User findByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_ACCOUNT_NOT_FOUND, "账号不存在"));
    }

    /**
     * 分页查询用户列表。
     */
    @Transactional(readOnly = true)
    public PageResponse<User> list(PageRequest pageRequest) {
        pageRequest.normalize();
        Sort sort = Sort.by(
                "desc".equalsIgnoreCase(pageRequest.getSortOrder()) ? Sort.Direction.DESC : Sort.Direction.ASC,
                pageRequest.getSortBy() == null ? "id" : pageRequest.getSortBy());
        Page<User> page = userRepository.findAll(
                org.springframework.data.domain.PageRequest.of(pageRequest.getPage() - 1, pageRequest.getPageSize(), sort));
        List<User> items = page.getContent();
        return PageResponse.of(items, page.getTotalElements(), pageRequest.getPage(), pageRequest.getPageSize());
    }

    private User requireUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "用户不存在: " + id));
    }
}
