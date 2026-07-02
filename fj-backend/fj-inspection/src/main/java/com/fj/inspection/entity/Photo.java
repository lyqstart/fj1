package com.fj.inspection.entity;

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
 * 照片实体（对应 V5 photos 表，§101.13）。
 * <p>支持离线拍照后补传；{@link #clientPhotoUuid} 全局唯一（去重/续传幂等键）。
 */
@Entity
@Table(name = "photos")
@Getter
@Setter
public class Photo extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "daily_report_id", nullable = false)
    private Long dailyReportId;

    /** 关联日报问题（可为空：日报级全景照片） */
    @Column(name = "daily_report_issue_id")
    private Long dailyReportIssueId;

    /** 客户端生成 UUID（幂等键，全局唯一） */
    @Column(name = "client_photo_uuid", nullable = false, length = 64)
    private String clientPhotoUuid;

    /** 照片类型（§101.13）：PANORAMA/DETAIL/OVERVIEW/AFTER_RECTIFICATION */
    @Enumerated(EnumType.STRING)
    @Column(name = "photo_type", nullable = false, length = 32)
    private PhotoType photoType = PhotoType.DETAIL;

    /** 压缩后存储路径（对象存储 / 本地） */
    @Column(name = "compressed_file_path", length = 512)
    private String compressedFilePath;

    /** 压缩文件哈希（去重校验） */
    @Column(name = "compressed_file_hash", length = 128)
    private String compressedFileHash;

    /** 原始文件哈希（完整性校验） */
    @Column(name = "original_file_hash", length = 128)
    private String originalFileHash;

    /** 文件大小（字节） */
    @Column(name = "file_size")
    private Long fileSize;

    /** 图片宽度（px） */
    @Column(name = "width")
    private Integer width;

    /** 图片高度（px） */
    @Column(name = "height")
    private Integer height;

    /** 经度（WGS84） */
    @Column(name = "gps_longitude")
    private Double gpsLongitude;

    /** 纬度（WGS84）；{@link #gpsStatus} 标记采集质量 */
    @Column(name = "gps_latitude")
    private Double gpsLatitude;

    /** GPS 状态：VALID/UNKNOWN/MISSING/SPOOFED */
    @Enumerated(EnumType.STRING)
    @Column(name = "gps_status", nullable = false, length = 32)
    private GpsStatus gpsStatus = GpsStatus.UNKNOWN;

    /** 拍摄时刻（EXIF，可早于上传时刻） */
    @Column(name = "taken_at")
    private OffsetDateTime takenAt;

    /** 是否后补传（taken_at 早于上传时刻超过阈值） */
    @Column(name = "is_late_uploaded", nullable = false)
    private Boolean isLateUploaded = Boolean.FALSE;

    /** 文件上传状态：PENDING/UPLOADING/UPLOADED/FAILED */
    @Enumerated(EnumType.STRING)
    @Column(name = "file_upload_status", nullable = false, length = 32)
    private FileUploadStatus fileUploadStatus = FileUploadStatus.PENDING;
}
