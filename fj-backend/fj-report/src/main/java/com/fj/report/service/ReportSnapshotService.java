package com.fj.report.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.issue.entity.ProjectIssue;
import com.fj.report.entity.Report;
import com.fj.report.entity.ReportIssueSnapshot;
import com.fj.report.repository.ReportIssueSnapshotRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 问题快照 + 快照编辑 Service（TASK-037）。
 * <p>核心职责：从 ProjectIssue 创建快照 + 快照编辑（左右对照不覆盖原文）+ 手工增减问题。
 * <p><b>§103 快照独立性原则</b>：
 * <ul>
 *   <li>createSnapshots / addSnapshot：从 ProjectIssue 复制当前值到 *_snapshot 字段（一次性快照）</li>
 *   <li>editSnapshot：只修改快照的 *_snapshot 字段，<b>绝不回写</b> source_issue 原文</li>
 *   <li>移除快照只删快照行，不影响 ProjectIssue 原文</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportSnapshotService {

    private final ReportIssueSnapshotRepository snapshotRepository;
    private final ReportService reportService;
    // G4：通过 EntityManager 原生查询 photos 表（fj-report 不依赖 fj-inspection，无法注入 PhotoRepository）
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;

    /**
     * 从 ProjectIssue 创建快照（批量，报告选择问题时调用）。
     * <p>从当前 ProjectIssue 复制 *_snapshot 字段；已纳入的问题跳过（避免重复）。
     *
     * @param reportId 报告 ID
     * @param issueIds 源问题 ID 列表
     * @return 新建的快照列表（已存在的会被跳过）
     */
    @Transactional
    public List<ReportIssueSnapshot> createSnapshots(Long reportId, List<Long> issueIds) {
        Report report = reportService.detail(reportId);
        if (issueIds == null || issueIds.isEmpty()) {
            return List.of();
        }
        List<ProjectIssue> issues = reportService.loadIssuesOfProject(report.getProjectId(), issueIds);

        long baseSeq = snapshotRepository.countByReportId(reportId);
        List<ReportIssueSnapshot> created = new ArrayList<>();
        int idx = 0;
        for (ProjectIssue issue : issues) {
            // 同一报告下同一源问题不重复纳入
            if (snapshotRepository.findByReportIdAndSourceIssueId(reportId, issue.getId()).isPresent()) {
                log.debug("报告 {} 已纳入问题 {}，跳过", reportId, issue.getIssueNo());
                continue;
            }
            ReportIssueSnapshot snapshot = buildSnapshotFromIssue(reportId, issue, (int) (baseSeq + idx));
            created.add(snapshot);
            idx++;
        }
        List<ReportIssueSnapshot> saved = snapshotRepository.saveAll(created);
        log.info("报告 {} 创建问题快照: 新增 {} 条（请求 {} 条）", reportId, saved.size(), issueIds.size());
        return saved;
    }

    /**
     * 编辑快照（左右对照，不覆盖原文 source_issue）。
     * <p>仅修改 *_snapshot 字段；调用方可改写 description / severity / category / responsibleParty /
     * photoReference / sortOrder，<b>绝不回写 ProjectIssue 原文</b>。
     *
     * @param snapshotId 快照 ID
     * @param editFields 待更新字段（key: 字段名，value: 新值；null 值跳过该字段）
     * @return 更新后的快照
     */
    @Transactional
    public ReportIssueSnapshot editSnapshot(Long snapshotId, Map<String, Object> editFields) {
        ReportIssueSnapshot snapshot = requireSnapshot(snapshotId);
        if (editFields == null || editFields.isEmpty()) {
            return snapshot;
        }
        // 逐字段部分更新（null 跳过）
        applyIfPresent(editFields, "description", v -> snapshot.setDescriptionSnapshot(asString(v)));
        applyIfPresent(editFields, "severity", v -> snapshot.setSeveritySnapshot(asString(v)));
        applyIfPresent(editFields, "category", v -> snapshot.setCategorySnapshot(asString(v)));
        applyIfPresent(editFields, "responsibleParty",
                v -> snapshot.setResponsiblePartySnapshot(asString(v)));
        applyIfPresent(editFields, "photoReference",
                v -> snapshot.setPhotoReferenceSnapshot(asString(v)));
        applyIfPresent(editFields, "sortOrder",
                v -> snapshot.setSortOrder(asInt(v)));
        // §103 关键：source_issue_id 不在此处修改；快照编辑绝不回写 ProjectIssue 原文
        ReportIssueSnapshot updated = snapshotRepository.save(snapshot);
        log.info("快照 {} 编辑完成（§103 不覆盖原文 source_issue={}）",
                snapshotId, updated.getSourceIssueId());
        return updated;
    }

    /**
     * 手动增加单个问题到报告。
     * <p>从指定 ProjectIssue 复制当前值生成单条快照；已纳入则抛业务异常。
     *
     * @param reportId 报告 ID
     * @param issueId  源问题 ID
     * @return 新建的快照
     */
    @Transactional
    public ReportIssueSnapshot addSnapshot(Long reportId, Long issueId) {
        Report report = reportService.detail(reportId);
        if (snapshotRepository.findByReportIdAndSourceIssueId(reportId, issueId).isPresent()) {
            throw new BusinessException(ErrorCode.DATA_ALREADY_EXISTS,
                    "问题 " + issueId + " 已纳入报告 " + reportId);
        }
        List<ProjectIssue> issues = reportService.loadIssuesOfProject(report.getProjectId(), List.of(issueId));
        if (issues.isEmpty()) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "问题不存在: " + issueId);
        }
        int sortOrder = (int) snapshotRepository.countByReportId(reportId);
        ReportIssueSnapshot snapshot = buildSnapshotFromIssue(reportId, issues.get(0), sortOrder);
        ReportIssueSnapshot saved = snapshotRepository.save(snapshot);
        log.info("报告 {} 手动增加问题快照: snapshotId={}, issueId={}", reportId, saved.getId(), issueId);
        return saved;
    }

    /**
     * 从报告中移除问题（只删快照，不影响 ProjectIssue 原文）。
     *
     * @param snapshotId 快照 ID
     */
    @Transactional
    public void removeSnapshot(Long snapshotId) {
        ReportIssueSnapshot snapshot = requireSnapshot(snapshotId);
        snapshotRepository.delete(snapshot);
        log.info("报告 {} 移除问题快照: snapshotId={}, source_issue={}",
                snapshot.getReportId(), snapshotId, snapshot.getSourceIssueId());
    }

    /** 查询报告下全部快照（按 sort_order 升序） */
    @Transactional(readOnly = true)
    public List<ReportIssueSnapshot> listByReport(Long reportId) {
        return snapshotRepository.findByReportIdOrderBySortOrder(reportId);
    }

    /** 查看快照详情 */
    @Transactional(readOnly = true)
    public ReportIssueSnapshot detail(Long snapshotId) {
        return requireSnapshot(snapshotId);
    }

    // ==================== 内部工具 ====================

    /** 从 ProjectIssue 构建快照（复制当前值到 *_snapshot 字段） */
    private ReportIssueSnapshot buildSnapshotFromIssue(Long reportId, ProjectIssue issue, int sortOrder) {
        ReportIssueSnapshot snapshot = new ReportIssueSnapshot();
        snapshot.setReportId(reportId);
        snapshot.setSourceIssueId(issue.getId());
        // §103：复制当前值到快照字段
        snapshot.setIssueNoSnapshot(issue.getIssueNo());
        snapshot.setDescriptionSnapshot(issue.getDescription());
        snapshot.setSeveritySnapshot(issue.getSeverity() == null ? null : issue.getSeverity().name());
        snapshot.setCategorySnapshot(issue.getCategory());
        // responsiblePartySnapshot：ProjectIssue 存 responsible_party_id（BIGINT），
        // 快照需展示名；此处先存 ID 字符串，后续可由组织/用户名解析增强（保持 §103 独立性）
        snapshot.setResponsiblePartySnapshot(
                issue.getResponsiblePartyId() == null ? null : String.valueOf(issue.getResponsiblePartyId()));
        // 照片引用快照（G4 修复）：从源日报问题关联的 Photo 提取压缩照片信息，序列化为 JSONB
        snapshot.setPhotoReferenceSnapshot(buildPhotoReferenceSnapshot(issue.getSourceIssueId()));
        snapshot.setSortOrder(sortOrder);
        return snapshot;
    }

    private ReportIssueSnapshot requireSnapshot(Long snapshotId) {
        return snapshotRepository.findById(snapshotId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND,
                        "问题快照不存在: " + snapshotId));
    }

    // ==================== 照片引用快照（G4 修复） ====================

    /**
     * 构建照片引用快照 JSON（G4 修复）。
     * <p>从源日报问题（{@code ProjectIssue.sourceIssueId} = DailyReportIssue.id）关联的 Photo
     * 提取压缩照片信息，序列化为 JSONB 字符串。
     * <p>关键规则：
     * <ul>
     *   <li>无照片时存空数组 JSON（{@code {"photos":[],"photoCount":0,"snapshotAt":"..."}}），<b>非 null</b></li>
     *   <li>快照创建后不可修改（PUBLISHED 后冻结，依赖 BR-4 固化）</li>
     *   <li>序列化失败降级为空数组 JSON，保证快照可创建</li>
     * </ul>
     *
     * @param dailyReportIssueId 源日报问题 ID（ProjectIssue.sourceIssueId，可为空）
     * @return 照片引用快照 JSON 字符串
     */
    private String buildPhotoReferenceSnapshot(Long dailyReportIssueId) {
        List<Map<String, Object>> photos = loadPhotoRefs(dailyReportIssueId);
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("photos", photos);
        root.put("photoCount", photos.size());
        root.put("snapshotAt", nowIso());
        try {
            return objectMapper.writeValueAsString(root);
        } catch (JsonProcessingException e) {
            log.warn("照片引用快照序列化失败，降级为空数组 JSON: dailyReportIssueId={}, err={}",
                    dailyReportIssueId, e.getMessage());
            return emptyPhotoSnapshotJson();
        }
    }

    /**
     * 查询源日报问题关联的压缩照片清单（按 id 升序，保证快照确定性）。
     * <p>fj-report 不依赖 fj-inspection，无法注入 PhotoRepository，故用 EntityManager 原生查询
     * photos 表；关联键为 {@code daily_report_issue_id} = {@code ProjectIssue.sourceIssueId}。
     * 查询异常时返回空列表（不阻断快照创建）。
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> loadPhotoRefs(Long dailyReportIssueId) {
        if (dailyReportIssueId == null) {
            return List.of();
        }
        List<Map<String, Object>> result = new ArrayList<>();
        try {
            List<Object[]> rows = entityManager.createNativeQuery(
                            "SELECT id, compressed_file_path, compressed_file_hash, gps_status, taken_at "
                                    + "FROM photos WHERE daily_report_issue_id = :issueId ORDER BY id")
                    .setParameter("issueId", dailyReportIssueId)
                    .getResultList();
            for (Object[] row : rows) {
                Map<String, Object> photo = new LinkedHashMap<>();
                photo.put("photoId", row[0] instanceof Number n ? n.longValue() : row[0]);
                photo.put("filePath", row[1]);
                photo.put("fileHash", row[2]);
                photo.put("capturedAt", toIsoString(row[4]));
                photo.put("gpsStatus", row[3]);
                result.add(photo);
            }
        } catch (PersistenceException e) {
            log.warn("查询照片快照失败，返回空列表: dailyReportIssueId={}, err={}",
                    dailyReportIssueId, e.getMessage());
        }
        return result;
    }

    /** 序列化失败时的降级空数组 JSON（仍含 snapshotAt）。 */
    private String emptyPhotoSnapshotJson() {
        return "{\"photos\":[],\"photoCount\":0,\"snapshotAt\":\"" + nowIso() + "\"}";
    }

    /** 当前时刻（截断到秒）的 ISO-8601 字符串，用作 snapshotAt。 */
    private String nowIso() {
        return OffsetDateTime.now().truncatedTo(ChronoUnit.SECONDS).toString();
    }

    /** 将原生查询返回的时间值统一转为 ISO-8601 字符串（兼容 OffsetDateTime / Timestamp / Date）。 */
    private String toIsoString(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof OffsetDateTime odt) {
            return odt.toString();
        }
        if (value instanceof java.time.LocalDateTime ldt) {
            return ldt.toString();
        }
        if (value instanceof java.util.Date d) {
            return d.toInstant().toString();
        }
        return value.toString();
    }

    /** 若字段存在且非 null，则应用更新函数 */
    private void applyIfPresent(Map<String, Object> fields, String key,
                                 java.util.function.Consumer<Object> applier) {
        if (fields.containsKey(key) && fields.get(key) != null) {
            applier.accept(fields.get(key));
        }
    }

    private String asString(Object v) {
        return Objects.toString(v, null);
    }

    private int asInt(Object v) {
        if (v instanceof Number n) {
            return n.intValue();
        }
        return Integer.parseInt(asString(v));
    }
}
