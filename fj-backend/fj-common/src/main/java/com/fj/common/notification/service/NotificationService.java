package com.fj.common.notification.service;

import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.common.notification.entity.Notification;
import com.fj.common.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 应用内通知服务（§101.27，BR-2 仅 App 内通知）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    /**
     * 创建通知（仅 App 内，无外部推送）。
     *
     * @param recipientId       接收用户 ID
     * @param projectId         项目 ID，可空（系统级通知）
     * @param type              通知类型
     * @param title             标题
     * @param content           内容
     * @param relatedEntityType 关联业务实体类型（可空）
     * @param relatedEntityId   关联业务实体 ID（可空）
     * @return 已保存的通知实体
     */
    @Transactional
    public Notification createNotification(Long recipientId, Long projectId, String type,
                                           String title, String content,
                                           String relatedEntityType, Long relatedEntityId) {
        Notification n = new Notification();
        n.setRecipientId(recipientId);
        n.setProjectId(projectId);
        n.setNotificationType(type);
        n.setTitle(title);
        n.setContent(content);
        n.setRelatedEntityType(relatedEntityType);
        n.setRelatedEntityId(relatedEntityId);
        n.setIsRead(Boolean.FALSE);
        return notificationRepository.save(n);
    }

    /** 标记指定通知为已读 */
    @Transactional
    public void markAsRead(Long notificationId) {
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "通知不存在"));
        if (Boolean.TRUE.equals(n.getIsRead())) {
            return;
        }
        n.setIsRead(Boolean.TRUE);
        n.setReadAt(OffsetDateTime.now());
        notificationRepository.save(n);
    }

    /** 获取用户未读通知数（用于待办红点） */
    @Transactional(readOnly = true)
    public long getUnreadCount(Long recipientId) {
        return notificationRepository.countByRecipientIdAndIsReadFalse(recipientId);
    }

    /** 获取用户未读通知列表 */
    @Transactional(readOnly = true)
    public List<Notification> getUnread(Long recipientId) {
        return notificationRepository.findByRecipientIdAndIsReadFalse(recipientId);
    }

    /** 获取用户全部通知（按接收时间倒序） */
    @Transactional(readOnly = true)
    public List<Notification> listByRecipient(Long recipientId) {
        return notificationRepository.findByRecipientIdOrderByReceivedAtDesc(recipientId);
    }
}
