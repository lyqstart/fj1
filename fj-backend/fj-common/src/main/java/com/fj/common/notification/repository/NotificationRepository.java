package com.fj.common.notification.repository;

import com.fj.common.notification.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 通知仓储（V4 notifications 表）。
 */
@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    /** 查询某用户的全部未读通知 */
    List<Notification> findByRecipientIdAndIsReadFalse(Long recipientId);

    /** 按接收时间倒序查询某用户的通知列表 */
    List<Notification> findByRecipientIdOrderByReceivedAtDesc(Long recipientId);

    /** 统计某用户的未读通知数（用于待办红点） */
    long countByRecipientIdAndIsReadFalse(Long recipientId);
}
