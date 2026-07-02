package com.fj.inspection.entity;

/**
 * 照片文件上传状态枚举（对应 photos.file_upload_status VARCHAR，§101.13）。
 * <p>支持离线拍照后补传：PENDING → UPLOADING → UPLOADED / FAILED。
 */
public enum FileUploadStatus {

    /** 待上传（离线拍照后尚未上传） */
    PENDING,
    /** 上传中 */
    UPLOADING,
    /** 已上传 */
    UPLOADED,
    /** 上传失败（可重试） */
    FAILED
}
