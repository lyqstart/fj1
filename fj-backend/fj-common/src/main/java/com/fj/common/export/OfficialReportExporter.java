package com.fj.common.export;

/**
 * 报告固化导出端口（六边形架构端口接口）。
 *
 * <p>存在意义：解耦 {@code fj-report}（发布服务）与 {@code fj-export}（poi-tl 实现）。
 * {@code fj-export} 已单向依赖 {@code fj-report}（导出落盘需读取 Report / ReportIssueSnapshot），
 * 若 {@code fj-report} 反向依赖 {@code fj-export} 将形成模块环（编译期即可检测的循环依赖）。
 * 因此将"发布固化导出"能力抽象为本端口接口（位于无环依赖的 {@code fj-common}）：
 * <ul>
 *   <li>{@code fj-report.ReportPublishService} 依赖本端口（不感知 poi-tl 实现细节）</li>
 *   <li>{@code fj-export.PoiTlExportEngine} 作为适配器实现本端口</li>
 * </ul>
 * Spring 在运行期将唯一实现（PoiTlExportEngine）注入 ReportPublishService。
 *
 * <p>BR-4：发布即固化。导出成功后报告方可进入 PUBLISHED；导出失败抛业务异常，报告状态不变。
 *
 * <p>方法命名为 {@code exportForPublish}（而非 {@code exportOfficialPublish}）以避免与
 * {@code ExportService.exportOfficialPublish(Long, Long)} 的返回值类型冲突（后者返回 ExportFile）。
 */
public interface OfficialReportExporter {

    /**
     * 发布固化导出（BR-4 发布即固化）。
     *
     * <p>实现职责：渲染 Word 模板 → 写入版本化不可覆盖路径 → 计算 SHA-256 → 记录 ExportFile(SUCCESS)。
     *
     * <p>失败处理：实现负责写入 ExportFile(FAILED) 留痕（§103），并抛出 {@code BusinessException}，
     * 调用方据此保持报告状态不变（不进入 PUBLISHED）。
     *
     * @param reportId    报告 ID
     * @param publisherId 发布人 ID
     */
    void exportForPublish(Long reportId, Long publisherId);
}
