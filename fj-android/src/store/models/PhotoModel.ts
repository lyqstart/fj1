/**
 * PhotoModel — 照片证据本地模型
 *
 * 设计依据：WI-0001 §101.13 Photo / DD-2 照片压缩与存储 / §6.4 照片同步协议 / §60.1 迟到同步
 *
 * 关键说明：
 *  - 照片文件独立于文本同步：元数据（本表）走 sync/push，文件走分片上传（§6.4）。
 *  - local_file_path 必填（客户端压缩后的本地路径）；remote_file_path 同步成功后回填。
 *  - file_upload_status 独立于 sync_status，因为元数据可以比文件先到服务端（照片迟到同步）。
 *  - 照片迟到同步：日报锁定后照片文件仍可补传，标记 is_late_uploaded=true（§60.1）。
 *  - 已锁定日报和已发布报告的照片不得被离线同步覆盖（§103.1 第5条）。
 */
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export const PHOTO_TABLE = 'photos' as const;

/**
 * 照片类型（§101.13 photo_type）
 * V1 仅做规则化提示（DD-10）：检查是否满足最低组合（如全景+细节）。
 */
export const PHOTO_TYPE = {
  PANORAMA: '全景',
  DETAIL: '细节',
  SUPPLEMENT: '补充',
} as const;

/**
 * GPS 获取状态（§101.13 gps_status）
 */
export const GPS_STATUS = {
  SUCCESS: 'success',
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
} as const;

/**
 * 文件上传状态（独立于元数据 sync_status）。
 * 照片元数据 push 成功后，文件可能仍在分片上传中。
 */
export const FILE_UPLOAD_STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  FAILED: 'failed',
} as const;

/** 分片上传最大重试次数（§6.4：指数退避 1s→2s→4s→8s，最多 5 次） */
export const PHOTO_UPLOAD_MAX_RETRIES = 5;

export type PhotoType =
  (typeof PHOTO_TYPE)[keyof typeof PHOTO_TYPE];
export type GpsStatus =
  (typeof GPS_STATUS)[keyof typeof GPS_STATUS];
export type FileUploadStatus =
  (typeof FILE_UPLOAD_STATUS)[keyof typeof FILE_UPLOAD_STATUS];

export default class PhotoModel extends Model {
  static table = PHOTO_TABLE;

  // ============== 同步字段 ==============
  @field('server_id') serverId!: string;
  @field('sync_status') syncState!: string;
  @field('server_seq') serverSeq!: number;
  /** 等价于业务文档中的 client_photo_uuid（§6.4） */
  @field('client_uuid') clientUuid!: string;

  // ============== 关联 ==============
  @field('daily_report_issue_id') dailyReportIssueId!: string;
  @field('project_id') projectId!: string;

  // ============== 文件路径 ==============
  /** 本地压缩图路径（必填，照片迟到同步的关键依据） */
  @field('local_file_path') localFilePath!: string;
  /** 服务端最终文件路径，元数据+文件双同步成功后回填 */
  @field('remote_file_path') remoteFilePath!: string | null;
  /** 原图本地路径（仅当项目配置 retain_original=true 时存在） */
  @field('original_local_path') originalLocalPath!: string | null;

  // ============== 元数据 ==============
  /** 照片类型：全景|细节|补充 */
  @field('photo_type') photoType!: PhotoType | string;
  @date('captured_at') capturedAt!: Date;

  // ============== 校验哈希（DD-2：服务端重新计算校验防传输损坏）==============
  /** 压缩图 SHA-256（必填） */
  @field('compressed_file_hash') compressedFileHash!: string | null;
  /** 原图 SHA-256（保留原图时必填） */
  @field('original_file_hash') originalFileHash!: string | null;

  // ============== GPS ==============
  @field('longitude') longitude!: number | null;
  @field('latitude') latitude!: number | null;
  /** GPS 获取状态：success|denied|unavailable（DD-10：缺失时提醒） */
  @field('gps_status') gpsStatus!: GpsStatus | string | null;

  // ============== 文件上传状态（独立于元数据 sync_status）==============
  @field('file_upload_status') fileUploadStatus!: FileUploadStatus | string;
  @field('upload_retries') uploadRetries!: number;
  /** 照片迟到同步标记（§60.1）：日报锁定后补传的照片为 true */
  @field('is_late_uploaded') isLateUploaded!: boolean;
  @date('uploaded_at') uploadedAt!: Date | null;

  // ============== WatermelonDB 内置字段 ==============
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}

/**
 * 判断照片文件是否还需要上传（元数据可能已 push 但文件未传完）。
 */
export function isPhotoFilePendingUpload(record: PhotoModel): boolean {
  return (
    record.fileUploadStatus === FILE_UPLOAD_STATUS.PENDING ||
    record.fileUploadStatus === FILE_UPLOAD_STATUS.FAILED
  );
}

/**
 * 判断照片是否可以重试上传（未超过最大重试次数）。
 */
export function canRetryPhotoUpload(record: PhotoModel): boolean {
  return record.uploadRetries < PHOTO_UPLOAD_MAX_RETRIES;
}
