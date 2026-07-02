package com.fj.approval.dto;

/**
 * 审批节点配置 DTO（解析自 {@code ApprovalFlowConfig.config_json}）。
 * <p>{@code config_json} 示例：
 * <pre>[{"node":1,"approverRoleId":101,"approverId":5,"name":"项目负责人确认"}]</pre>
 *
 * @param node           节点序号（从 1 开始，决定审批顺序）
 * @param name           节点名称（写入 approval_tasks.node_name）
 * @param approverRoleId 审批角色 ID（角色→用户解析由上层注入，可选）
 * @param approverId     具体审批人用户 ID（引擎直接用作任务 assignee，推荐配置此字段）
 */
public record ApprovalNodeConfig(
        Integer node,
        String name,
        Long approverRoleId,
        Long approverId
) {
}
