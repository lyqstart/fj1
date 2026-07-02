package com.fj.export.service;

import com.fj.export.entity.ExportFile;

/**
 * 报告导出 Service 接口（DD-3 / TASK-041）。
 * <p>定义草稿预览导出与发布固化导出两类导出场景：
 * <ul>
 *   <li>{@link #exportDraftPreview}：草稿预览导出，不改变报告状态，NFR-5 ≤60s 同步等待</li>
 *   <li>{@link #exportOfficialPublish}：发布固化导出，BR-4 发布即固化，NFR-5 ≤120s 同步等待</li>
 * </ul>
 * <p>错误场景（DD-3 Errors）：
 * TemplateNotFoundError | ExportRenderError | ExportTimeoutError | PhotoMissingInExportWarning（非阻断）
 */
public interface ExportService {

    /**
     * 草稿预览导出（不改变报告状态）。
     * <p>NFR-5 性能要求：≤60s 同步返回。失败抛业务异常，不写 ExportFile 失败记录（草稿预览不计留痕）。
     *
     * @param reportId 报告 ID
     * @param userId   操作人 ID
     * @return 导出文件元信息
     */
    ExportFile exportDraftPreview(Long reportId, Long userId);

    /**
     * 发布固化导出（发布流程调用，失败则报告不进入已发布 — BR-4）。
     * <p>NFR-5 性能要求：≤120s 同步等待，超时返回失败。
     * <p>版本化路径：{@code /data/exports/report/{reportId}/v{version}_{timestamp}_official.docx}，
     * 物理上不可覆盖。
     * <p>失败时也写一条 export_status=FAILED 的 ExportFile 记录用于排查（§103 失败留痕）。
     *
     * @param reportId   报告 ID
     * @param publisherId 发布人 ID
     * @return 导出文件元信息
     */
    ExportFile exportOfficialPublish(Long reportId, Long publisherId);
}
