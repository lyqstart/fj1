package com.fj.issue.service;

import com.fj.common.enume.IssueSeverity;
import com.fj.project.entity.ProjectConfig;
import org.springframework.stereotype.Component;

import java.time.LocalTime;
import java.time.OffsetDateTime;

/**
 * 整改期限计算器（BR-1 P0 共识，TASK-027）。
 * <p>根据问题严重程度和确认时刻计算整改截止期限，写入 project_issues.rectification_deadline（始终非空）。
 * <p>BR-1 规则：
 * <ul>
 *   <li>{@link IssueSeverity#GENERAL} 一般：confirmed_at + 7 天</li>
 *   <li>{@link IssueSeverity#MAJOR} 较大：confirmed_at + 3 天</li>
 *   <li>{@link IssueSeverity#CRITICAL} 重大：confirmed_at 当日 23:59:59；
 *       若 major_issue_deadline_hours 配置存在且 > 0，则用 confirmed_at + hours 覆盖</li>
 * </ul>
 * <p>major_issue_deadline_hours 从 {@link ProjectConfig} 读取（默认 24 小时）。
 */
@Component
public class RectificationDeadlineCalculator {

    /** GENERAL 整改默认天数（BR-1） */
    public static final int GENERAL_DEADLINE_DAYS = 7;

    /** MAJOR 整改默认天数（BR-1） */
    public static final int MAJOR_DEADLINE_DAYS = 3;

    /** CRITICAL 当日截止时刻（23:59:59） */
    public static final LocalTime END_OF_DAY = LocalTime.of(23, 59, 59); // 23:59:59

    /**
     * 计算整改期限（rectification_deadline，始终非空）。
     *
     * @param severity    问题严重程度
     * @param confirmedAt 业务确认时刻（confirmed_at，整改期限计算起点；若为 null 则取当前时刻）
     * @param config      项目配置（读取 major_issue_deadline_hours 覆盖值；可为 null）
     * @return 整改截止时刻（非空）
     */
    public OffsetDateTime calculateDeadline(IssueSeverity severity, OffsetDateTime confirmedAt, ProjectConfig config) {
        OffsetDateTime base = confirmedAt != null ? confirmedAt : OffsetDateTime.now();
        if (severity == null) {
            severity = IssueSeverity.GENERAL;
        }
        return switch (severity) {
            case GENERAL -> base.plusDays(GENERAL_DEADLINE_DAYS);
            case MAJOR -> base.plusDays(MAJOR_DEADLINE_DAYS);
            case CRITICAL -> calculateCriticalDeadline(base, config);
        };
    }

    /**
     * 计算 CRITICAL 级别问题的整改截止时间。
     *
     * <p><b>决策 D1-A（已确认）</b>：
     * <ul>
     *   <li>当 {@code majorIssueDeadlineHours > 0} 时，截止时间 = {@code confirmedAt（精确到秒）+ hours 小时}</li>
     *   <li>当 {@code majorIssueDeadlineHours ≤ 0 或未配置} 时，走 BR-1 默认规则 = confirmedAt 当日 23:59:59</li>
     *   <li>跨日场景自动处理（如 22:00 + 8h = 次日 06:00）</li>
     *   <li>已确认问题的 deadline 不回溯重算（配置变更仅对新确认的问题生效）</li>
     * </ul>
     *
     * <p>覆盖逻辑：{@code confirmed_at + major_issue_deadline_hours} 小时
     * （hours 从 {@link ProjectConfig#getMajorIssueDeadlineHours()} 读取，从 {@code confirmedAt} 精确时刻起算）。
     *
     * @param confirmedAt 确认时间（精确到秒，整改期限计算起点）
     * @param config      项目配置（读取 {@link ProjectConfig#getMajorIssueDeadlineHours()} 覆盖值；
     *                    为 null 或 hours ≤ 0 时走 BR-1 默认规则）
     * @return 整改截止时间
     */
    private OffsetDateTime calculateCriticalDeadline(OffsetDateTime confirmedAt, ProjectConfig config) {
        // 若 major_issue_deadline_hours 配置存在且有效，用 hours 覆盖（覆盖 confirmed_at 基准）
        if (config != null && config.getMajorIssueDeadlineHours() != null
                && config.getMajorIssueDeadlineHours() > 0) {
            return confirmedAt.plusHours(config.getMajorIssueDeadlineHours());
        }
        // 默认：当日 23:59:59（BR-1 CRITICAL 规则）
        return confirmedAt.toLocalDate().atTime(END_OF_DAY).atOffset(confirmedAt.getOffset());
    }
}
