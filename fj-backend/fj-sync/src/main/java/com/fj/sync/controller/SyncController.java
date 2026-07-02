package com.fj.sync.controller;

import com.fj.common.response.ApiResponse;
import com.fj.sync.dto.SyncPullResponse;
import com.fj.sync.dto.SyncPushRequest;
import com.fj.sync.dto.SyncPushResponse;
import com.fj.sync.service.SyncPullService;
import com.fj.sync.service.SyncPushService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * 同步协议 REST API（§6.2 / §6.3）。
 * <ul>
 *   <li>{@code POST /api/v1/sync/push} — 客户端推送变更（client_batch_uuid 幂等）。</li>
 *   <li>{@code GET  /api/v1/sync/pull}  — 增量拉取变更（since=last_server_seq）。</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/sync")
@RequiredArgsConstructor
public class SyncController {

    private final SyncPushService syncPushService;
    private final SyncPullService syncPullService;

    /**
     * 推送变更。userId 暂由请求头 {@code X-User-Id} 注入（认证中间件接入后替换为 SecurityContext）。
     */
    @PostMapping("/push")
    public ApiResponse<SyncPushResponse> push(@RequestHeader("X-User-Id") Long userId,
                                              @RequestBody SyncPushRequest request) {
        return ApiResponse.ok(syncPushService.push(userId, request));
    }

    /**
     * 增量拉取。示例：
     * {@code GET /api/v1/sync/pull?projectId=1&since=12345&limit=200&entityTypes=daily_reports,project_issues}
     */
    @GetMapping("/pull")
    public ApiResponse<SyncPullResponse> pull(@RequestParam(required = false) Long projectId,
                                              @RequestParam(required = false) Long since,
                                              @RequestParam(required = false, defaultValue = "200") Integer limit,
                                              @RequestParam(required = false) String entityTypes) {
        List<String> types = entityTypes == null || entityTypes.isBlank()
                ? Collections.emptyList()
                : Arrays.stream(entityTypes.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        return ApiResponse.ok(syncPullService.pull(projectId, since, limit, types));
    }
}
