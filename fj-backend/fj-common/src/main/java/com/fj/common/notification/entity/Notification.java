package com.fj.common.notification.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;
import java.time.OffsetDateTime;

/**
 * 应用内通知实体（对应 V4 notifications 表，§101.27）。
 * <p>P0 仅 App 内通知，无外部推送（BR-2）。
 */
@Entity
@Table(name = "notifications")
@Getter
@Setter
public class Notification extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 接收用户 ID */
    @Column(name = "recipient_id", nullable = false)
    private Long recipientId;

    /** 项目 ID，可空（系统级通知无项目） */
    @Column(name = "project_id")
    private Long projectId;

    /** 通知类型：日报退回/审批结果/任务派发/重大问题/系统公告 */
    @Column(name = "notification_type", nullable = false, length = 64)
    private String notificationType;

    /** 标题 */
    @Column(name = "title", nullable = false, length = 255)
    private String title;

    /** 内容 */
    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    /** 关联业务实体类型，用于点击跳转（daily_report/project_issue/inspection_task ...） */
    @Column(name = "related_entity_type", length = 64)
    private String relatedEntityType;

    /** 关联业务实体 ID */
    @Column(name = "related_entity_id")
    private Long relatedEntityId;

    /** 是否已读 */
    @Column(name = "is_read", nullable = false)
    private Boolean isRead = Boolean.FALSE;

    /** 接收时间（由数据库 DEFAULT NOW() 写入，JPA 只读） */
    @Column(name = "received_at", insertable = false, updatable = false)
    private OffsetDateTime receivedAt;

    /** 已读时间 */
    @Column(name = "read_at")
    private OffsetDateTime readAt;
}
