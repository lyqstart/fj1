package com.fj.issue.service;

import com.fj.common.enume.CorrectionStatus;
import com.fj.common.enume.IssueSeverity;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.issue.dto.DailyReportIssueImport;
import com.fj.issue.entity.IssueStatus;
import com.fj.issue.entity.ProjectIssue;
import com.fj.issue.repository.ProjectIssueRepository;
import com.fj.project.entity.ProjectConfig;
import com.fj.project.repository.ProjectConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 问题池 Service（TASK-026）。
 * <p>核心职责：日报确认时将 DailyReportIssue 映射为 ProjectIssue（通过 DTO 规避循环依赖）。
 * <p>关键业务规则：
 * <ul>
 *   <li>同事务设置 confirmed_at / locked_at（DD-8 确认即锁定）</li>
 *   <li>生成 issue_no（格式 ISS-{projectId}-{6位序号}）</li>
 *   <li>计算 rectification_deadline（BR-1，始终非空）</li>
 * </ul>
 * <p><b>循环依赖说明</b>：fj-inspection 依赖 fj-issue，因此本 Service 不直接接收
 * DailyReport / DailyReportIssue 类型参数，而是通过 {@link DailyReportIssueImport} DTO 解耦。
 * 调用方负责实体 → DTO 转换。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IssuePoolService {

    private final ProjectIssueRepository projectIssueRepository;
    private final ProjectConfigRepository projectConfigRepository;
    private final RectificationDeadlineCalculator deadlineCalculator;

    /**
     * 从日报问题生成项目问题池条目（TASK-026 核心）。
     * <p>日报确认流程调用：将每条 DailyReportIssueImport 映射为 ProjectIssue，同事务完成：
     * <ol>
     *   <li>生成 issue_no（ISS-{projectId}-{6位序号}）</li>
     *   <li>计算 rectification_deadline（BR-1，基于 severity + confirmedAt）</li>
     *   <li>设置 confirmed_at / locked_at（DD-8 确认即锁定）</li>
     *   <li>初始状态 status=VALID、correction_status=PENDING</li>
     * </ol>
     *
     * @param projectId     项目 ID
     * @param sourceReportId 来源日报 ID
     * @param confirmedAt   业务确认时刻（DD-8；null 则取当前时刻）
     * @param issues        日报问题导入列表
     * @return 生成的 ProjectIssue 列表
     */
    @Transactional
    public List<ProjectIssue> generateFromDailyReport(Long projectId, Long sourceReportId,
                                                       OffsetDateTime confirmedAt,
                                                       List<DailyReportIssueImport> issues) {
        if (issues == null || issues.isEmpty()) {
            log.warn("日报 {} 问题列表为空，跳过问题池生成", sourceReportId);
            return List.of();
        }

        OffsetDateTime confirmTime = confirmedAt != null ? confirmedAt : OffsetDateTime.now();
        // DD-8：确认即锁定，同事务写入 confirmed_at + locked_at
        OffsetDateTime lockedAt = confirmTime;

        ProjectConfig config = projectConfigRepository.findByProjectId(projectId).orElse(null);
        if (config == null) {
            log.warn("项目 {} 配置不存在，整改期限按默认规则计算", projectId);
        }

        // issue_no 序号起点：当前项目已有问题数 + 1
        long baseSeq = projectIssueRepository.countByProjectId(projectId);

        List<ProjectIssue> generated = new ArrayList<>(issues.size());
        for (int i = 0; i < issues.size(); i++) {
            DailyReportIssueImport item = issues.get(i);
            ProjectIssue issue = new ProjectIssue();
            issue.setProjectId(projectId);
            issue.setSourceReportId(sourceReportId);
            issue.setSourceIssueId(item.sourceIssueId());
            issue.setCreatedFromReportId(sourceReportId);
            issue.setIssueNo(generateIssueNo(projectId, baseSeq + i + 1));
            issue.setDescription(item.description());
            issue.setSeverity(item.severity());
            issue.setCategory(item.category());
            issue.setResponsiblePartyId(item.responsiblePartyId());

            // 状态初始化
            issue.setStatus(IssueStatus.VALID);
            issue.setCorrectionStatus(CorrectionStatus.PENDING);

            // BR-1：计算整改期限（始终非空）
            issue.setRectificationDeadline(
                    deadlineCalculator.calculateDeadline(item.severity(), confirmTime, config));

            // DD-8：确认即锁定
            issue.setConfirmedAt(confirmTime);
            issue.setLockedAt(lockedAt);

            generated.add(issue);
        }

        List<ProjectIssue> saved = projectIssueRepository.saveAll(generated);
        log.info("日报 {} 确认完成，生成 {} 条项目问题（projectId={}）", sourceReportId, saved.size(), projectId);
        return saved;
    }

    /** 生成问题编号：ISS-{projectId}-{6位序号} */
    private String generateIssueNo(Long projectId, long seq) {
        return String.format("ISS-%d-%06d", projectId, seq);
    }

    // ==================== 查询 / 编辑 ====================

    /** 按项目 + 状态 + 严重程度分页查询（多条件筛选） */
    @Transactional(readOnly = true)
    public Page<ProjectIssue> findByProjectIdAndStatusAndSeverity(Long projectId, IssueStatus status,
                                                                    IssueSeverity severity, Pageable pageable) {
        return projectIssueRepository.findByProjectIdAndStatusAndSeverity(projectId, status, severity, pageable);
    }

    /** 按项目 + 状态分页查询 */
    @Transactional(readOnly = true)
    public Page<ProjectIssue> findByProjectIdAndStatus(Long projectId, IssueStatus status, Pageable pageable) {
        return projectIssueRepository.findByProjectIdAndStatus(projectId, status, pageable);
    }

    /** 按项目分页查询 */
    @Transactional(readOnly = true)
    public Page<ProjectIssue> findByProjectId(Long projectId, Pageable pageable) {
        return projectIssueRepository.findByProjectId(projectId, pageable);
    }

    /** 查看问题详情 */
    @Transactional(readOnly = true)
    public ProjectIssue detail(Long id) {
        return projectIssueRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "问题不存在: " + id));
    }

    /**
     * 编辑问题描述 / 等级（仅允许编辑部分字段）。
     *
     * @param id      问题 ID
     * @param patch   包含待更新字段的载体（description / severity / category）
     * @return 更新后的问题
     */
    @Transactional
    public ProjectIssue edit(Long id, ProjectIssue patch) {
        ProjectIssue existing = detail(id);
        if (patch.getDescription() != null && !patch.getDescription().isBlank()) {
            existing.setDescription(patch.getDescription());
        }
        if (patch.getSeverity() != null) {
            existing.setSeverity(patch.getSeverity());
        }
        if (patch.getCategory() != null) {
            existing.setCategory(patch.getCategory());
        }
        return projectIssueRepository.save(existing);
    }
}
