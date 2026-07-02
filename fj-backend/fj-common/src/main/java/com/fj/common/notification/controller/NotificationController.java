package com.fj.common.notification.controller;

import com.fj.common.notification.entity.Notification;
import com.fj.common.notification.service.NotificationService;
import com.fj.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

/**
 * 通知接口（§101.27）。
 * <p>当前用户 ID 取自认证主体（JWT subject = userId）。
 */
@RestController
@RequestMapping("/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    /** 当前用户通知列表（按接收时间倒序） */
    @GetMapping
    public ApiResponse<List<Notification>> list(Principal principal) {
        Long userId = currentUserId(principal);
        return ApiResponse.ok(notificationService.listByRecipient(userId));
    }

    /** 当前用户未读通知数（用于待办红点） */
    @GetMapping("/unread-count")
    public ApiResponse<Long> unreadCount(Principal principal) {
        Long userId = currentUserId(principal);
        return ApiResponse.ok(notificationService.getUnreadCount(userId));
    }

    /** 标记指定通知为已读 */
    @PostMapping("/{id}/read")
    public ApiResponse<Void> markAsRead(@PathVariable("id") Long id) {
        notificationService.markAsRead(id);
        return ApiResponse.ok();
    }

    /** 从认证主体解析当前用户 ID（JWT subject） */
    private Long currentUserId(Principal principal) {
        if (principal == null || principal.getName() == null) {
            return null;
        }
        return Long.valueOf(principal.getName());
    }
}
