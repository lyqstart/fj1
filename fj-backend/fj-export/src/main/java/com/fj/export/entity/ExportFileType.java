package com.fj.export.entity;

/**
 * 导出文件类型枚举（对应 export_files.file_type VARCHAR，§101.16）。
 * <p>区分草稿预览导出与发布固化导出：
 * <ul>
 *   <li>{@link #DRAFT_PREVIEW} 草稿预览导出（不改变报告状态，NFR-5 ≤60s）</li>
 *   <li>{@link #OFFICIAL_PUBLISH} 发布固化导出（BR-4 发布即固化，NFR-5 ≤120s）</li>
 * </ul>
 */
public enum ExportFileType {

    /** 草稿预览导出（可覆盖，文件路径带 draft 标记） */
    DRAFT_PREVIEW,
    /** 发布固化导出（不可覆盖，路径含 report_version + 时间戳） */
    OFFICIAL_PUBLISH
}
