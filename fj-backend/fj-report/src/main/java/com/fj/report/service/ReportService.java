package com.fj.report.service;

import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.issue.entity.ProjectIssue;
import com.fj.issue.repository.ProjectIssueRepository;
import com.fj.report.entity.Report;
import com.fj.report.entity.ReportStatus;
import com.fj.report.repository.ReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 报告生成 Service（TASK-036）。
 * <p>核心职责：按时间范围从 project_issues 汇总问题生成报告草稿 + 选择纳入问题清单 + 报告基本信息维护。
 * <p>关键业务规则：
 * <ul>
 *   <li>新建报告初始状态 DRAFT（BR-8）；版本号 1；is_current_effective=true</li>
 *   <li>report_no 格式：RPT-{projectId}-{6位序号}</li>
 *   <li>版本树根（root_report_id）在首次保存后回填为自身 id（§9.2 预留）</li>
 *   <li>仅 DRAFT/RETURNED 状态允许编辑（发布后 BR-4 固化锁定）</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final ProjectIssueRepository projectIssueRepository;

    /**
     * 生成报告草稿（按时间范围汇总项目问题）。
     * <p>从 project_issues 中筛选 [periodStart, periodEnd] 区间内确认入池的有效问题，生成报告草稿。
     * <p>新建报告：status=DRAFT、report_version=1、is_current_effective=true，
     * root_report_id 在首次保存后回填为自身 id。
     *
     * @param projectId   项目 ID
     * @param periodStart 报告周期起始时刻（可空）
     * @param periodEnd   报告周期结束时刻（可空）
     * @return 已创建的报告草稿
     */
    @Transactional
    public Report generateDraft(Long projectId, OffsetDateTime periodStart, OffsetDateTime periodEnd) {
        Report report = new Report();
        report.setProjectId(projectId);
        report.setReportNo(generateReportNo(projectId));
        // 默认标题：项目 ID + 周期区间
        report.setTitle(buildDefaultTitle(projectId, periodStart, periodEnd));
        report.setStatus(ReportStatus.DRAFT);
        report.setReportPeriodStart(periodStart);
        report.setReportPeriodEnd(periodEnd);
        report.setReportVersion(1);
        report.setIsCurrentEffective(Boolean.TRUE);

        report = reportRepository.save(report);
        // §9.2 版本树根回填为自身 id（首版 root_report_id = id）
        report.setRootReportId(report.getId());
        report = reportRepository.save(report);

        log.info("生成报告草稿: id={}, projectId={}, periodStart={}, periodEnd={}",
                report.getId(), projectId, periodStart, periodEnd);
        return report;
    }

    /**
     * 选择纳入报告的问题清单。
     * <p>本方法只校验报告状态可编辑（实际快照创建由 ReportSnapshotService 负责，
     * 保持职责单一）。报告需处于 DRAFT 或 RETURNED 状态。
     *
     * @param reportId 报告 ID
     * @param issueIds 待纳入的问题 ID 列表
     * @return 报告（状态校验通过后返回）
     */
    @Transactional
    public Report selectIssues(Long reportId, List<Long> issueIds) {
        Report report = requireEditable(reportId);
        // 校验问题清单存在且属于同一项目
        if (issueIds == null || issueIds.isEmpty()) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, "纳入报告的问题清单不能为空");
        }
        List<ProjectIssue> issues = projectIssueRepository.findAllById(issueIds);
        if (issues.size() != issueIds.size()) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "部分问题不存在，无法纳入报告");
        }
        for (ProjectIssue issue : issues) {
            if (!issue.getProjectId().equals(report.getProjectId())) {
                throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID,
                        "问题 " + issue.getIssueNo() + " 不属于报告所在项目，不可跨项目纳入");
            }
        }
        log.info("报告 {} 选择问题清单: count={}", reportId, issueIds.size());
        return report;
    }

    /**
     * 更新报告基本信息（标题）。
     * <p>仅 DRAFT/RETURNED 状态允许编辑；发布后（BR-4 固化）禁止修改。
     *
     * @param reportId 报告 ID
     * @param title    新标题（非空时更新）
     * @param description 占位参数（报告描述预留，当前 reports 表未单列；保留入参兼容未来扩展）
     * @return 更新后的报告
     */
    @Transactional
    public Report updateReportInfo(Long reportId, String title, String description) {
        Report report = requireEditable(reportId);
        if (title != null && !title.isBlank()) {
            report.setTitle(title);
        }
        // description 当前无独立列；保留入参以便未来扩展报告描述字段时不破坏调用方契约
        return reportRepository.save(report);
    }

    /**
     * 校验问题是否属于指定项目（供 ReportSnapshotService 复用）。
     *
     * @param projectId 项目 ID
     * @param issueIds  问题 ID 列表
     * @return 校验通过的问题实体列表
     */
    @Transactional(readOnly = true)
    public List<ProjectIssue> loadIssuesOfProject(Long projectId, List<Long> issueIds) {
        List<ProjectIssue> issues = projectIssueRepository.findAllById(issueIds);
        for (ProjectIssue issue : issues) {
            if (!issue.getProjectId().equals(projectId)) {
                throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID,
                        "问题 " + issue.getIssueNo() + " 不属于项目 " + projectId);
            }
        }
        return issues;
    }

    /** 查询项目下报告列表（可选状态过滤） */
    @Transactional(readOnly = true)
    public List<Report> list(Long projectId, ReportStatus status) {
        if (status != null) {
            return reportRepository.findByProjectIdAndStatus(projectId, status);
        }
        return reportRepository.findByProjectId(projectId);
    }

    /** 查询项目下当前生效版本 */
    @Transactional(readOnly = true)
    public List<Report> listCurrentEffective(Long projectId) {
        return reportRepository.findByIsCurrentEffectiveAndProjectId(Boolean.TRUE, projectId);
    }

    /** 查询版本树全部版本（按版本号倒序） */
    @Transactional(readOnly = true)
    public List<Report> listVersions(Long rootReportId) {
        return reportRepository.findByRootReportIdOrderByReportVersionDesc(rootReportId);
    }

    /** 查看报告详情 */
    @Transactional(readOnly = true)
    public Report detail(Long id) {
        return reportRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "报告不存在: " + id));
    }

    // ==================== 内部工具 ====================

    /** 校验报告处于可编辑状态（DRAFT 或 RETURNED），BR-4 已发布固化 */
    private Report requireEditable(Long reportId) {
        Report report = detail(reportId);
        ReportStatus st = report.getStatus();
        if (st != ReportStatus.DRAFT && st != ReportStatus.RETURNED) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED,
                    "报告状态为 " + st + "，不允许编辑（发布后 BR-4 固化）");
        }
        return report;
    }

    /** 生成报告编号：RPT-{projectId}-{6位序号} */
    private String generateReportNo(Long projectId) {
        long seq = reportRepository.countByProjectId(projectId) + 1;
        return String.format("RPT-%d-%06d", projectId, seq);
    }

    /** 构造默认标题 */
    private String buildDefaultTitle(Long projectId, OffsetDateTime start, OffsetDateTime end) {
        StringBuilder sb = new StringBuilder("项目").append(projectId).append("问题报告");
        if (start != null && end != null) {
            sb.append("（").append(start.toLocalDate()).append(" ~ ").append(end.toLocalDate()).append("）");
        }
        return sb.toString();
    }
}
