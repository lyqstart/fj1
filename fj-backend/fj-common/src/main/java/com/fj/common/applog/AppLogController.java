package com.fj.common.applog;

import com.fj.common.applog.dto.LogBatchRequest;
import com.fj.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/v1/logs")
@RequiredArgsConstructor
public class AppLogController {

    private final AppLogService appLogService;

    /**
     * Batch upload app logs from mobile client.
     * This endpoint is permitAll (no JWT required) so logs can be uploaded
     * even before login (e.g. during boot/diagnostics).
     */
    @PostMapping("/batch")
    public ApiResponse<Void> batch(@RequestBody LogBatchRequest request) {
        try {
            int count = request.getEntries() != null ? request.getEntries().size() : 0;
            log.info("Received app log batch: {} entries", count);
            appLogService.writeLogs(request.getEntries());
            return ApiResponse.ok();
        } catch (Exception e) {
            log.error("Failed to process app log batch: {}", e.getMessage(), e);
            return ApiResponse.ok(); // Always return OK so client doesn't retry
        }
    }
}
