package com.fj.report.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fj.common.enume.IssueSeverity;
import com.fj.issue.entity.ProjectIssue;
import com.fj.report.entity.Report;
import com.fj.report.entity.ReportIssueSnapshot;
import com.fj.report.repository.ReportIssueSnapshotRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * {@link ReportSnapshotService} 单元测试（TASK-W02-043，G4 修复验证）。
 *
 * <p>G4 修复核心：{@code createSnapshot/createSnapshots/addSnapshot} 创建快照时，
 * {@code photo_reference_snapshot} 必须被 {@code buildPhotoReferenceSnapshot} 填充——
 * <ul>
 *   <li>有照片 → JSON 含非空 {@code photos} 数组，{@code photoCount > 0}</li>
 *   <li>无照片 → JSON 仍非 null，含空数组 {@code {"photos":[],"photoCount":0,...}}，
 *       <b>不得为 null</b></li>
 * </ul>
 *
 * <p>测试通过单问题入口 {@link ReportSnapshotService#addSnapshot} 触发
 * {@code buildSnapshotFromIssue → buildPhotoReferenceSnapshot → loadPhotoRefs}，
 * 用 Mockito 桩 {@link EntityManager} 原生查询，使用<b>真实</b> {@link ObjectMapper}
 * 验证 JSON 真序列化且可被 Jackson 反序列化验证结构。
 */
@ExtendWith(MockitoExtension.class)
class ReportSnapshotServiceTest {

    private static final Long REPORT_ID = 100L;
    private static final Long PROJECT_ID = 10L;
    private static final Long ISSUE_ID = 500L;
    /** ProjectIssue.sourceIssueId：源日报问题 ID（DailyReportIssue.id），照片关联键 */
    private static final Long DAILY_REPORT_ISSUE_ID = 9001L;

    @Mock
    private ReportIssueSnapshotRepository snapshotRepository;
    @Mock
    private ReportService reportService;
    @Mock
    private EntityManager entityManager;

    /** 真实 ObjectMapper：验证 JSON 真序列化与可反序列化结构（不 mock 序列化） */
    private final ObjectMapper objectMapper = new ObjectMapper();

    private ReportSnapshotService service;

    @BeforeEach
    void setUp() {
        // 手工构造（非 @InjectMocks），以便注入真实 ObjectMapper 而非 mock
        // 构造参数顺序：snapshotRepository, reportService, entityManager, objectMapper
        service = new ReportSnapshotService(snapshotRepository, reportService, entityManager, objectMapper);
    }

    /**
     * 构造一个含源日报问题关联的 ProjectIssue，并预置 {@code addSnapshot} 公共 Mock 桩。
     *
     * @param dailyReportIssueId 源日报问题 ID（决定照片查询参数；可为空）
     * @return 已构造的 ProjectIssue
     */
    private ProjectIssue prepareIssueAndStubs(Long dailyReportIssueId) {
        Report report = new Report();
        report.setId(REPORT_ID);
        report.setProjectId(PROJECT_ID);

        ProjectIssue issue = new ProjectIssue();
        issue.setId(ISSUE_ID);
        issue.setProjectId(PROJECT_ID);
        issue.setIssueNo("ISS-10-000001");
        issue.setDescription("钢筋间距不满足设计要求");
        issue.setSeverity(IssueSeverity.MAJOR);
        issue.setCategory("主体结构");
        issue.setResponsiblePartyId(200L);
        issue.setSourceIssueId(dailyReportIssueId);

        when(reportService.detail(REPORT_ID)).thenReturn(report);
        when(snapshotRepository.findByReportIdAndSourceIssueId(REPORT_ID, ISSUE_ID))
                .thenReturn(Optional.empty());
        when(reportService.loadIssuesOfProject(eq(PROJECT_ID), any()))
                .thenReturn(List.of(issue));
        when(snapshotRepository.countByReportId(REPORT_ID)).thenReturn(0L);
        when(snapshotRepository.save(any(ReportIssueSnapshot.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        return issue;
    }

    /**
     * 场景 1：有照片 → photoReferenceSnapshot 含照片 JSON 且 photoCount > 0（G4 修复）。
     *
     * <p>Mock EntityManager 原生查询返回 1 行照片记录（id/path/hash/gps/taken_at），
     * 断言：photoReferenceSnapshot 非 null；JSON 含 photos 数组（至少 1 个）；
     * photoCount = 1；且照片字段（photoId/filePath/fileHash/gpsStatus/capturedAt）正确映射。
     */
    @Test
    @DisplayName("创建快照·有照片 → photoReferenceSnapshot 含照片 JSON 且 photoCount>0")
    void testCreateSnapshot_WithPhotos_FillsPhotoReference() throws Exception {
        // given：源日报问题关联 1 张压缩照片
        prepareIssueAndStubs(DAILY_REPORT_ISSUE_ID);
        Object[] photoRow = {
                9001L,                       // id
                "/photos/9001.jpg",          // compressed_file_path
                "sha256:abc123",             // compressed_file_hash
                "OK",                        // gps_status
                OffsetDateTime.now()         // taken_at
        };
        Query query = mock(Query.class);
        when(entityManager.createNativeQuery(anyString())).thenReturn(query);
        when(query.setParameter(eq("issueId"), any())).thenReturn(query);
        // Collections.singletonList 避免 List.of 的 varargs 展平：getResultList 返回「每行一个 Object[]」
        when(query.getResultList()).thenReturn(Collections.singletonList(photoRow));

        // when：单问题入口触发 buildSnapshotFromIssue → buildPhotoReferenceSnapshot
        ReportIssueSnapshot snapshot = service.addSnapshot(REPORT_ID, ISSUE_ID);

        // then：photoReferenceSnapshot 非空
        assertThat(snapshot).as("addSnapshot 必须返回被 save 的同一快照").isNotNull();
        String json = snapshot.getPhotoReferenceSnapshot();
        assertThat(json).as("G4：photoReferenceSnapshot 不得为 null").isNotNull();

        // 解析 JSON 结构断言（真实 Jackson 反序列化）
        JsonNode root = objectMapper.readTree(json);
        assertThat(root.get("photos").isArray()).as("JSON 含 photos 数组").isTrue();
        assertThat(root.get("photos").size()).as("photos 数组至少 1 个").isGreaterThan(0);
        assertThat(root.get("photoCount").asInt()).as("photoCount > 0").isEqualTo(1);
        assertThat(root.has("snapshotAt")).as("JSON 含 snapshotAt").isTrue();

        // 照片字段映射（与 loadPhotoRefs 的 Map 键一致）
        JsonNode photo = root.get("photos").get(0);
        assertThat(photo.get("photoId").asLong())
                .as("photoId 映射自 photos.id").isEqualTo(9001L);
        assertThat(photo.get("filePath").asText())
                .as("filePath 映射自 compressed_file_path").isEqualTo("/photos/9001.jpg");
        assertThat(photo.get("fileHash").asText())
                .as("fileHash 映射自 compressed_file_hash").isEqualTo("sha256:abc123");
        assertThat(photo.get("gpsStatus").asText())
                .as("gpsStatus 映射自 gps_status").isEqualTo("OK");
        assertThat(photo.has("capturedAt"))
                .as("capturedAt 由 taken_at 转换而来").isTrue();
    }

    /**
     * 场景 2：无照片 → photoReferenceSnapshot 存空数组 JSON 且 photoCount = 0（G4 修复）。
     *
     * <p>关键回归点：无照片时 photoReferenceSnapshot <b>不得为 null</b>，
     * 必须为 {@code {"photos":[],"photoCount":0,"snapshotAt":"..."}} 结构，
     * 保证前端展示脱网时仍能正确判定"无照片"而非"字段缺失"。
     */
    @Test
    @DisplayName("创建快照·无照片 → photoReferenceSnapshot 存空数组 JSON 且 photoCount=0")
    void testCreateSnapshot_NoPhotos_EmptyArrayJson() throws Exception {
        // given：源日报问题无关联照片（原生查询返回空列表）
        prepareIssueAndStubs(DAILY_REPORT_ISSUE_ID);
        Query query = mock(Query.class);
        when(entityManager.createNativeQuery(anyString())).thenReturn(query);
        when(query.setParameter(eq("issueId"), any())).thenReturn(query);
        when(query.getResultList()).thenReturn(Collections.emptyList());

        // when
        ReportIssueSnapshot snapshot = service.addSnapshot(REPORT_ID, ISSUE_ID);

        // then：photoReferenceSnapshot 非 null（G4 关键：不得为 null）
        assertThat(snapshot).isNotNull();
        String json = snapshot.getPhotoReferenceSnapshot();
        assertThat(json).as("G4：无照片时 photoReferenceSnapshot 仍不得为 null").isNotNull();

        // 解析 JSON 结构断言
        JsonNode root = objectMapper.readTree(json);
        assertThat(root.get("photos").isArray()).as("JSON 含 photos 数组").isTrue();
        assertThat(root.get("photos").size()).as("无照片时 photos 数组为空").isEqualTo(0);
        assertThat(root.get("photoCount").asInt()).as("photoCount = 0").isEqualTo(0);
        assertThat(root.has("snapshotAt")).as("空数组 JSON 仍含 snapshotAt").isTrue();
    }
}
