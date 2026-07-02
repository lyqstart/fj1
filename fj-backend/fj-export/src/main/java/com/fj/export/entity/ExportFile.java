package com.fj.export.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;
import java.time.OffsetDateTime;

/**
 * 导出文件实体（对应 V7 export_files 表，§101.16）。
 * <p>记录每次报告导出（草稿预览 / 发布固化 / 手工补导出）生成的 Word 文件元信息。
 * <p>关键字段语义（DD-3 报告导出引擎）：
 * <ul>
 *   <li>{@link #fileType}：导出场景（{@link ExportFileType}）</li>
 *   <li>{@link #filePath}：版本化路径，发布固化含 report_version + 时间戳，物理上不可覆盖</li>
 *   <li>{@link #fileHash}：文件 SHA-256 哈希，用于完整性校验</li>
 *   <li>{@link #generatedAt} / {@link #generatedBy}：导出时刻与操作人</li>
 * </ul>
 */
@Entity
@Table(name = "export_files")
@Getter
@Setter
public class ExportFile extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 关联报告 ID */
    @Column(name = "report_id", nullable = false)
    private Long reportId;

    /** 导出场景类型 */
    @Enumerated(EnumType.STRING)
    @Column(name = "file_type", nullable = false, length = 32)
    private ExportFileType fileType;

    /** 文件存储路径（版本化，发布固化含 v{version}_{timestamp}，不可覆盖） */
    @Column(name = "file_path", nullable = false, length = 512)
    private String filePath;

    /** 文件名（业务可读） */
    @Column(name = "file_name", nullable = false, length = 256)
    private String fileName;

    /** 文件大小（字节） */
    @Column(name = "file_size")
    private Long fileSize;

    /** 文件 SHA-256 哈希（完整性校验） */
    @Column(name = "file_hash", length = 128)
    private String fileHash;

    /** 生成时刻 */
    @Column(name = "generated_at", nullable = false)
    private OffsetDateTime generatedAt;

    /** 生成人 ID */
    @Column(name = "generated_by")
    private Long generatedBy;

    /** 导出状态（SUCCESS / FAILED，DD-3 失败也记录留痕） */
    @Column(name = "export_status", nullable = false, length = 32)
    private String exportStatus = "SUCCESS";

    /** 失败时的错误信息（export_status=FAILED 时填写） */
    @Column(name = "error_message", length = 1024)
    private String errorMessage;
}
