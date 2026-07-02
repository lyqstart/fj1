package com.fj.auth.rbac;

import com.fj.system.entity.Permission;
import com.fj.system.entity.Role;
import com.fj.system.entity.UserProjectRole;
import com.fj.system.repository.UserProjectRoleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 权限校验器（§7.2 项目级 RBAC）。
 * <p>校验链：userId → UserProjectRole（按 projectId 过滤）→ Role → Permission（resource+action 匹配）。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PermissionChecker {

    private final UserProjectRoleRepository userProjectRoleRepository;

    /**
     * 校验用户是否拥有指定权限。
     *
     * @param userId    用户 ID
     * @param projectId 项目 ID（null 表示全局/跨项目校验）
     * @param resource  资源标识
     * @param action    操作类型
     * @return true=有权限
     */
    public boolean hasPermission(Long userId, Long projectId, String resource, String action) {
        if (userId == null) {
            return false;
        }
        List<UserProjectRole> bindings = (projectId == null)
                ? userProjectRoleRepository.findByUserId(userId)
                : userProjectRoleRepository.findByUserIdAndProjectId(userId, projectId);

        for (UserProjectRole binding : bindings) {
            Role role = binding.getRole();
            if (role == null || role.getPermissions() == null) {
                continue;
            }
            for (Permission p : role.getPermissions()) {
                if (resource.equals(p.getResource()) && action.equals(p.getAction())) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 校验用户是否能访问指定项目（在该项目有任意角色绑定）。
     */
    public boolean hasProjectAccess(Long userId, Long projectId) {
        if (userId == null || projectId == null) {
            return false;
        }
        return !userProjectRoleRepository.findByUserIdAndProjectId(userId, projectId).isEmpty();
    }
}
