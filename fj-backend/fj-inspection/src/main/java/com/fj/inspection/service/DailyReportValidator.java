package com.fj.inspection.service;

import com.fj.common.enume.CorrectionStatus;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.inspection.entity.DailyReport;
import com.fj.inspection.entity.DailyReportIssue;
import com.fj.inspection.entity.DailyReportStatus;
import com.fj.inspection.entity.GpsStatus;
import com.fj.inspection.entity.Photo;
import com.fj.inspection.repository.DailyReportIssueRepository;
import com.fj.inspection.repository.DailyReportRepository;
import com.fj.inspection.repository.PhotoRepository;
import com.fj.project.entity.ProjectConfig;
import com.fj.project.repository.ProjectConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 日报三层校验器（§9.1 三层状态联动）。
 * <p>三层校验语义：
 * <ol>
 *   <li><b>硬阻断</b>（hard block）：必填字段缺失 / 至少一条问题。阻断提交，抛 {@link ErrorCode#BIZ_PARAMS_INVALID}。</li>
 *   <li><b>配置阻断</b>（config block）：项目配置要求的字段（ProjectConfig.enforce_required_items 等）。阻断提交。</li>
 *   <li><b>强提醒</b>（soft warning）：照片不足 / GPS 缺失 / 描述字数不够。不阻断，返回提醒列表供前端确认。</li>
 * </ol>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DailyReportValidator {

    private final DailyReportRepository dailyReportRepository;
    private final DailyReportIssueRepository dailyReportIssueRepository;
    private final PhotoRepository photoRepository;
    private final ProjectConfigRepository projectConfigRepository;

    /**
     * 执行三层校验，返回强提醒列表（硬阻断/配置阻断会抛异常）。
     *
     * @param report 待校验日报
     * @return 强提醒消息列表（仅 soft warning，硬/配置阻断已抛异常）
     */
    public List<String> validate(DailyReport report) {
        List<String> warnings = new ArrayList<>();

        // ===== 第 1 层：硬阻断 =====
        validateHardBlock(report);

        // ===== 第 2 层：配置阻断 =====
        ProjectConfig config = getConfig(report.getProjectId());
        validateConfigBlock(report, config);

        // ===== 第 3 层：强提醒（不阻断） =====
        collectWarnings(report, config, warnings);

        return warnings;
    }

    /**
     * 仅执行硬阻断校验（用于保存草稿前的轻量校验）。
     */
    public void validateHardBlock(DailyReport report) {
        if (report.getProjectId() == null) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, "项目 ID 不能为空");
        }
        if (report.getReportDate() == null) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, "日报日期不能为空");
        }
        if (report.getInspectorId() == null) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, "检查人员不能为空");
        }
    }

    /**
     * 提交时的硬阻断：至少一条问题。
     */
    public void validateSubmitHardBlock(DailyReport report) {
        validateHardBlock(report);
        long issueCount = dailyReportIssueRepository.countByDailyReportId(report.getId());
        if (issueCount == 0) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, "日报至少需要包含一条问题");
        }
        // 校验每条问题的必填字段
        List<DailyReportIssue> issues = dailyReportIssueRepository.findByDailyReportId(report.getId());
        for (DailyReportIssue issue : issues) {
            if (issue.getDescription() == null || issue.getDescription().isBlank()) {
                throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID,
                        "问题 #" + issue.getSeqNo() + " 描述不能为空");
            }
            if (issue.getSeverity() == null) {
                throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID,
                        "问题 #" + issue.getSeqNo() + " 严重程度不能为空");
            }
        }
    }

    /**
     * 配置阻断：根据 ProjectConfig 校验。
     */
    private void validateConfigBlock(DailyReport report, ProjectConfig config) {
        List<DailyReportIssue> issues = dailyReportIssueRepository.findByDailyReportId(report.getId());
        for (DailyReportIssue issue : issues) {
            // 描述字数下限（配置阻断）
            if (config.getMinDescriptionLength() != null && config.getMinDescriptionLength() > 0) {
                int descLen = issue.getDescription() == null ? 0 : issue.getDescription().length();
                if (descLen < config.getMinDescriptionLength()) {
                    throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID,
                            "问题 #" + issue.getSeqNo() + " 描述字数不足，至少 "
                                    + config.getMinDescriptionLength() + " 字（当前 " + descLen + " 字）");
                }
            }
        }
    }

    /**
     * 收集强提醒（不阻断）：照片不足 / GPS 缺失。
     */
    private void collectWarnings(DailyReport report, ProjectConfig config, List<String> warnings) {
        List<DailyReportIssue> issues = dailyReportIssueRepository.findByDailyReportId(report.getId());
        int photoMin = config.getPhotoMinCount() == null ? 1 : config.getPhotoMinCount();

        for (DailyReportIssue issue : issues) {
            long photoCount = photoRepository.countByDailyReportIssueId(issue.getId());
            if (photoCount < photoMin) {
                warnings.add("问题 #" + issue.getSeqNo() + " 照片不足，建议至少 "
                        + photoMin + " 张（当前 " + photoCount + " 张）");
            }
            // GPS 缺失强提醒
            List<Photo> photos = photoRepository.findByDailyReportIssueId(issue.getId());
            for (Photo photo : photos) {
                if (photo.getGpsStatus() == GpsStatus.MISSING || photo.getGpsStatus() == GpsStatus.UNKNOWN) {
                    warnings.add("问题 #" + issue.getSeqNo() + " 照片 " + photo.getClientPhotoUuid()
                            + " GPS 缺失（" + photo.getGpsStatus() + "）");
                }
            }
        }
    }

    /**
     * 状态流转守卫：仅允许从期望的当前状态提交。
     */
    public void guardTransition(DailyReport report, DailyReportStatus expectedFrom, DailyReportStatus target) {
        if (report.getStatus() != expectedFrom) {
            throw new BusinessException(ErrorCode.BIZ_STATE_INVALID_TRANSITION,
                    "日报状态流转不合法：" + report.getStatus() + " → " + target
                            + "（需从 " + expectedFrom + " 迁移）");
        }
    }

    private ProjectConfig getConfig(Long projectId) {
        return projectConfigRepository.findByProjectId(projectId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND,
                        "项目配置不存在，projectId=" + projectId));
    }
}
