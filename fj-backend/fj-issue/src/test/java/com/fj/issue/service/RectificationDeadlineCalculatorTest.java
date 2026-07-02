package com.fj.issue.service;

import com.fj.common.enume.IssueSeverity;
import com.fj.project.entity.ProjectConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * {@link RectificationDeadlineCalculator} 单元测试（TASK-W02-040）。
 *
 * <p>聚焦决策 D1-A：CRITICAL 级别 {@code major_issue_deadline_hours} 小时起算语义。
 * 截止时间从 {@code confirmed_at} 精确时刻起算（非自然日截断），跨日场景自动推进。
 *
 * <p>覆盖 3 个场景：
 * <ul>
 *   <li>hours=24：confirmed_at 14:30 → 次日 14:30（精确起算 +24h）</li>
 *   <li>hours=0：走 BR-1 默认规则 = 当日 23:59:59（hours ≤ 0 不覆盖）</li>
 *   <li>hours=8：confirmed_at 22:00 → 次日 06:00（跨日推进）</li>
 * </ul>
 *
 * <p>统一使用 Asia/Shanghai 时区（+08:00），断言精确到秒。
 */
@ExtendWith(MockitoExtension.class)
class RectificationDeadlineCalculatorTest {

    /** Asia/Shanghai 时区偏移（+08:00） */
    private static final ZoneOffset SHANGHAI = ZoneOffset.ofHours(8);

    /** 被测对象（无外部依赖，直接实例化走真实路径） */
    private final RectificationDeadlineCalculator calculator = new RectificationDeadlineCalculator();

    @Mock
    private ProjectConfig config;

    /**
     * 场景 1：hours=24，confirmedAt=14:30 → deadline=次日 14:30。
     *
     * <p>验证 D1-A 核心语义：截止时间 = {@code confirmed_at} 精确时刻 + 24h，
     * 即从确认时刻起算而非当日截断——14:30 起算则次日同为 14:30。
     */
    @Test
    @DisplayName("CRITICAL hours=24：confirmedAt 14:30 → 次日 14:30（精确起算）")
    void testCriticalDeadline_24Hours_FromConfirmedAt() {
        // given：2026-07-01 14:30 确认，配置 24 小时
        OffsetDateTime confirmedAt = OffsetDateTime.of(2026, 7, 1, 14, 30, 0, 0, SHANGHAI);
        OffsetDateTime expected = OffsetDateTime.of(2026, 7, 2, 14, 30, 0, 0, SHANGHAI);
        when(config.getMajorIssueDeadlineHours()).thenReturn(24);

        // when：通过公开入口走真实 CRITICAL 分支
        OffsetDateTime actual = calculator.calculateDeadline(IssueSeverity.CRITICAL, confirmedAt, config);

        // then：精确到秒等于次日同一时刻（D1-A：从 confirmed_at 起算，非当日截断）
        assertThat(actual)
                .as("hours=24 时截止时间应等于 confirmed_at + 24h")
                .isEqualTo(expected);
    }

    /**
     * 场景 2：hours=0，confirmedAt=14:30 → deadline=当日 23:59:59。
     *
     * <p>验证 BR-1 默认兜底：当 {@code major_issue_deadline_hours ≤ 0} 时，
     * 走 CRITICAL 当日 23:59:59 规则（而非 +0h 的同一时刻 14:30）。
     */
    @Test
    @DisplayName("CRITICAL hours=0：confirmedAt 14:30 → 当日 23:59:59（BR-1 默认）")
    void testCriticalDeadline_ZeroHours_DefaultEndOfDay() {
        // given：配置 hours=0（无效覆盖值，应走默认规则）
        OffsetDateTime confirmedAt = OffsetDateTime.of(2026, 7, 1, 14, 30, 0, 0, SHANGHAI);
        OffsetDateTime expected = OffsetDateTime.of(2026, 7, 1, 23, 59, 59, 0, SHANGHAI);
        when(config.getMajorIssueDeadlineHours()).thenReturn(0);

        // when
        OffsetDateTime actual = calculator.calculateDeadline(IssueSeverity.CRITICAL, confirmedAt, config);

        // then：走当日 23:59:59 默认规则（不是 14:30 + 0h）
        assertThat(actual)
                .as("hours=0 时应走 BR-1 当日 23:59:59 默认规则")
                .isEqualTo(expected);
    }

    /**
     * 场景 3：hours=8，confirmedAt=22:00 → 跨日 deadline=次日 06:00。
     *
     * <p>验证跨日自动推进：22:00 + 8h 通过 {@code plusHours} 自然滚到次日 06:00。
     */
    @Test
    @DisplayName("CRITICAL hours=8：confirmedAt 22:00 → 次日 06:00（跨日）")
    void testCriticalDeadline_8Hours_CrossDay() {
        // given：夜间确认，配置 8 小时
        OffsetDateTime confirmedAt = OffsetDateTime.of(2026, 7, 1, 22, 0, 0, 0, SHANGHAI);
        OffsetDateTime expected = OffsetDateTime.of(2026, 7, 2, 6, 0, 0, 0, SHANGHAI);
        when(config.getMajorIssueDeadlineHours()).thenReturn(8);

        // when
        OffsetDateTime actual = calculator.calculateDeadline(IssueSeverity.CRITICAL, confirmedAt, config);

        // then：跨日到次日 06:00（精确到秒）
        assertThat(actual)
                .as("22:00 + 8h 应跨日到次日 06:00")
                .isEqualTo(expected);
    }
}
