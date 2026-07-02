package com.fj.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 飞检现场管理系统 — 启动入口。
 * <p>扫描所有 com.fj 子包，聚合全部业务模块的 Controller / Service / Repository。
 * {@code @EnableScheduling} 激活定时任务（如 EditLockCleanupJob 过期锁清理）。
 */
@SpringBootApplication(scanBasePackages = "com.fj")
@EnableJpaRepositories(basePackages = {
    "com.fj.common.audit.repository",
    "com.fj.common.concurrent.repository",
    "com.fj.common.notification.repository",
    "com.fj.auth.repository",
    "com.fj.system.repository",
    "com.fj.project.repository",
    "com.fj.inspection.repository",
    "com.fj.issue.repository",
    "com.fj.report.repository",
    "com.fj.approval.repository",
    "com.fj.export.repository",
    "com.fj.sync.repository",
    "com.fj.recommend.repository"
})
@EntityScan(basePackages = "com.fj")
@EnableScheduling
public class FjApplication {

    public static void main(String[] args) {
        SpringApplication.run(FjApplication.class, args);
    }
}
