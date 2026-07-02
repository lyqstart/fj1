package com.fj.approval.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;

/**
 * 审批流配置实体（对应 V3 approval_flow_configs 表）。
 * <p>config_json 存储审批节点列表 JSON，例如：
 * <pre>[{"node":1,"approverRoleId":101,"name":"项目负责人确认"}]</pre>
 * <br>V1 仅配置；审批运行引擎在 TASK-030。
 */
@Entity
@Table(name = "approval_flow_configs")
@Getter
@Setter
public class ApprovalFlowConfig extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Enumerated(EnumType.STRING)
    @Column(name = "flow_type", nullable = false, length = 32)
    private ApprovalFlowType flowType;

    /** 审批节点列表 JSON */
    @Column(name = "config_json", nullable = false, columnDefinition = "jsonb")
    private String configJson;

    /** 状态：ACTIVE 生效 / INACTIVE 停用 */
    @Column(name = "status", nullable = false, length = 32)
    private String status = "ACTIVE";

    @Column(name = "version", nullable = false)
    private Integer version = 1;
}
