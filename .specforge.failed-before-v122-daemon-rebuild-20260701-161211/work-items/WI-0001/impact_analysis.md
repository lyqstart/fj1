# WI-0001 影响分析

## 现有代码影响
无。本项目为 greenfield，当前无现有代码库。

## 新建模块

| 模块 | 职责 | 核心对象 |
|---|---|---|
| auth | 认证与授权骨架 | User, JWT, BCrypt |
| user | 用户管理 | User |
| role | 角色与权限 | Role, Permission |
| organization | 组织机构 | Organization |
| project | 项目管理 | Project, ProjectOrganization, UserProjectRole |

## 对象依赖关系

```
User ──┬── UserProjectRole ──── Role
       │                        │
       └── organization_id ── Organization
                              │
Project ── ProjectOrganization ┘
        │
        └── UserProjectRole ──── User
```

关键依赖链：
1. Role + Permission 必须先于 UserProjectRole
2. Organization 可与 User 并行
3. Project 依赖 Organization（通过 ProjectOrganization）
4. UserProjectRole 是 User × Project × Role 的三方关联表
5. 初始化种子数据（默认角色、权限点）必须最后执行

## 风险识别

| 风险 | 等级 | 缓解措施 |
|---|---|---|
| RBAC 权限模型设计不完整 | 中 | 严格遵循 v1.14 权限三分类（基础/业务/流程），在 design 阶段定义完整权限点矩阵 |
| UUID 主键性能 | 低 | PostgreSQL 原生 uuid 类型 + 索引优化 |
| 多对多关系数据一致性 | 低 | 数据库外键约束 + 应用层事务 |
| 种子数据可重复执行 | 低 | Flyway 迁移脚本，幂等设计 |
| 密码安全 | 低 | BCrypt(strength=12)，Spring Security 标准实现 |
| 项目级权限隔离 | 中 | 所有项目数据查询强制 project_id 过滤，在 design 阶段定义数据访问层约定 |

## 对后续 WI 的影响

WI-0001 是所有后续 WI 的基础：
- WI-0002 需要 Role/Permission/Project
- WI-0003 需要 Organization/Project/UserProjectRole
- WI-0004 需要全部 7 个对象
- 后续所有 WI 的权限校验依赖本 WI 的 RBAC 实现

## 技术约束
- 后端：Java 17 + Spring Boot 3.x + Spring Data JPA + Flyway
- 数据库：PostgreSQL 15
- 安全：Spring Security + BCrypt + JWT
- 审计：OperationLog 含 log_hash（v1.14 裁决，本 WI 预留模型）