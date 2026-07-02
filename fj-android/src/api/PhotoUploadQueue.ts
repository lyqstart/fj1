/**
 * PhotoUploadQueue — 飞检安卓端照片分片上传队列
 *
 * 设计依据：WI-0001 / DD-6 §6.4 照片同步协议 / DD-2 照片压缩 / §103.2 弱网策略 / NFR-11 失败重试不丢数据
 *
 * 职责：
 *  - 分片上传：将本地压缩后的照片切分为 256KB 分片，逐片 POST 到 /api/v1/photos/upload-chunk。
 *  - 断点续传：记录已上传分片索引，失败重试只补传缺失分片（避免重复传输）。
 *  - 指数退避重试：单片失败按 1s→2s→4s→8s→16s 退避，最多 5 次（§6.4 / NFR-11）。
 *  - 完成确认：全部分片上传成功后，调用 /api/v1/photos/complete 提交元数据 + file_hash 完成上传。
 *  - 队列状态：pending / uploading / completed / failed，便于 UI 展示与重试调度。
 *
 * 与文本同步的关系（§6.4）：
 *  - 照片"元数据"（client_uuid / hash / type / captured_at 等）随文本 Push 同步（SyncEngine）。
 *  - 照片"文件"由本队列异步分片上传，二者独立。文件上传完成后由上层回写
 *    PhotoModel.file_upload_status='uploaded' + uploaded_at（见 PhotoModel）。
 *
 * 依赖（全部通过构造注入，便于单测）：
 *  - ApiClient：HTTP 通道（postFormData 用于分片二进制，post 用于 complete JSON）。
 *  - PhotoChunkReader：本地文件读取端口（解耦 RNFS / native blob，便于单测用内存实现替换）。
 *
 * 不引入新 npm 依赖：
 *  - 使用 RN 内置 FormData / fetch / setTimeout（由 ApiClient 封装）。
 *  - 不直接 import react-native-fs（未安装）——文件切片通过注入端口实现。
 */
import type { ApiClient, ApiError } from './ApiClient';

// ============== 常量 ==============
/** 分片大小：256 KB（§6.4） */
export const PHOTO_CHUNK_SIZE = 256 * 1024;
/** 单片最大重试次数（§6.4：指数退避 1s→2s→4s→8s→16s，最多 5 次） */
export const PHOTO_CHUNK_MAX_RETRIES = 5;
/** 指数退避基数（毫秒）：1s */
const BACKOFF_BASE_MS = 1000;

/** 上传端点 */
const UPLOAD_CHUNK_PATH = '/api/v1/photos/upload-chunk';
const COMPLETE_PATH = '/api/v1/photos/complete';

/**
 * 文件分片读取端口（解耦原生文件系统）。
 *
 * 生产实现建议基于 react-native-fs（read 文件字节区间）或自定义 native module，
 * 避免一次性把整张大图读进 JS 内存。默认实现 {@link FetchBlobChunkReader}
 * 通过 fetch(file://) 读取整文件为 Blob 再切片，仅适用于中小图 / 调试。
 */
export interface PhotoChunkReader {
  /**
   * 读取指定分片为 Blob，供 FormData.append。
   * @param localFilePath - 本地文件路径（file:// uri 或绝对路径）
   * @param chunkIndex - 分片序号（从 0 起）
   * @param chunkSize - 单片字节大小
   * @returns 该分片的 Blob
   */
  readChunk(localFilePath: string, chunkIndex: number, chunkSize: number): Promise<Blob>;
  /**
   * 读取整个文件大小（字节），用于计算 total_chunks。
   * 若调用方已知 total_size 可不依赖此方法。
   */
  sizeOf(localFilePath: string): Promise<number>;
}

/**
 * 基于 fetch + Blob.slice 的默认分片读取实现（fallback）。
 *
 * 适用场景：RN 运行时支持 fetch(file://)→Blob 的环境（调试 / 中小图）。
 * 大图生产场景应注入基于原生文件 IO 的实现，避免整图载入内存。
 */
export class FetchBlobChunkReader implements PhotoChunkReader {
  /** 缓存已读取的整文件 Blob，避免重复读取（同一次上传内） */
  private readonly blobCache = new Map<string, Blob>();

  private async readWholeBlob(localFilePath: string): Promise<Blob> {
    const cached = this.blobCache.get(localFilePath);
    if (cached) {
      return cached;
    }
    const resp = await fetch(localFilePath);
    if (!resp.ok) {
      throw new Error(`读取本地照片失败：${localFilePath}（HTTP ${resp.status}）`);
    }
    const blob = await resp.blob();
    this.blobCache.set(localFilePath, blob);
    return blob;
  }

  async readChunk(localFilePath: string, chunkIndex: number, chunkSize: number): Promise<Blob> {
    const whole = await this.readWholeBlob(localFilePath);
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, whole.size);
    return whole.slice(start, end);
  }

  async sizeOf(localFilePath: string): Promise<number> {
    const whole = await this.readWholeBlob(localFilePath);
    return whole.size;
  }

  /** 清除缓存（上传完成 / 失败后调用，释放内存） */
  clear(localFilePath: string): void {
    this.blobCache.delete(localFilePath);
  }
}

/** 待上传的本地照片（与 PhotoModel 字段对齐，但仅取上传所需） */
export interface LocalPhoto {
  /** 客户端稳定 UUID（等价 PhotoModel.client_uuid，§6.4 client_photo_uuid） */
  client_uuid: string;
  /** 本地压缩图路径（PhotoModel.local_file_path） */
  local_file_path: string;
  /** 文件 SHA-256（PhotoModel.compressed_file_hash，完成上传时提交，DD-2 服务端重新计算校验） */
  file_hash: string;
  /** 文件总字节数；若不提供则由 reader.sizeOf 探测 */
  total_size?: number;
  /** 完成上传时一并提交的元数据（photo_type / captured_at / gps 等） */
  metadata: Record<string, unknown>;
}

/** 单片上传成功响应（§6.4 upload-chunk） */
export interface UploadChunkResponse {
  /** 服务端上传会话 ID（断点续传依据） */
  upload_id: string;
  /** 本次接收的分片序号 */
  chunk_index: number;
  /** 是否所有分片已齐 */
  completed?: boolean;
}

/** 完成上传响应（§6.4 complete） */
export interface CompleteUploadResponse {
  /** 服务端最终文件路径（回写 PhotoModel.remote_file_path） */
  remote_file_path: string;
  /** 服务端校验后的文件 hash（应与 LocalPhoto.file_hash 一致，DD-2） */
  file_hash?: string;
  /** 服务端照片记录 ID */
  photo_id?: string | number;
}

/** 上传操作结果 */
export interface UploadResult {
  /** 照片 client_uuid */
  photo_client_uuid: string;
  /** 服务端最终文件路径 */
  remote_file_path: string;
  /** 实际成功上传的分片数 */
  uploaded_chunks: number;
  /** 总分片数 */
  total_chunks: number;
  /** 全过程累计的重试次数（用于诊断弱网程度） */
  retries: number;
}

/** 队列项状态 */
export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed';

/** 队列项快照（供 UI 展示进度 / 失败重试） */
export interface QueueEntry {
  photo: LocalPhoto;
  status: UploadStatus;
  /** 已成功上传的分片索引集合（断点续传依据） */
  uploadedChunkIndices: number[];
  /** 总分片数 */
  totalChunks: number;
  /** 累计重试次数 */
  retries: number;
  /** 最近一次错误消息（status=failed 时有值） */
  lastError?: string;
}

/**
 * 判断 ApiError 是否可重试（网络错误 / 超时）。
 * 服务端业务错误（如 hash 校验失败）不可重试，应直接 failed。
 */
function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const kind = (error as ApiError).kind;
  return kind === 'network' || kind === 'timeout';
}

/** 指数退避延迟：1s, 2s, 4s, 8s, 16s（attempt 从 0 起） */
function backoffDelay(attempt: number): number {
  return BACKOFF_BASE_MS * Math.pow(2, attempt);
}

/** sleep 工具 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 飞检照片分片上传队列。
 *
 * @example
 * const queue = new PhotoUploadQueue(apiClient);
 * const result = await queue.uploadPhoto({ client_uuid, local_file_path, file_hash, metadata });
 */
export class PhotoUploadQueue {
  private readonly apiClient: ApiClient;
  private readonly reader: PhotoChunkReader;
  /** 内存队列：photo_client_uuid → 队列项快照（持久化由上层负责，V1 内存态足够） */
  private readonly queue = new Map<string, QueueEntry>();

  constructor(apiClient: ApiClient, reader?: PhotoChunkReader) {
    this.apiClient = apiClient;
    this.reader = reader ?? new FetchBlobChunkReader();
  }

  /**
   * 上传单张照片：分片 + 断点续传 + 指数退避 + 完成确认。
   *
   * 流程：
   *  1. 计算 total_chunks = ceil(total_size / 256KB)
   *  2. 逐片上传：对每个未上传的分片调用 uploadSingleChunkWithRetry
   *     - 成功 → 记录 chunk_index 到 uploadedChunkIndices
   *     - 不可重试错误 / 重试耗尽 → 整张照片标记 failed，抛出
   *  3. 全部分片齐后 POST /api/v1/photos/complete（photo_client_uuid + file_hash + metadata）
   *  4. 标记 completed，返回 remote_file_path
   *
   * 断点续传：若同一 photo.client_uuid 曾部分上传（队列中有记录），
   *          本次跳过 uploadedChunkIndices 中已成功的分片。
   *
   * @throws 当不可重试错误发生或重试耗尽时抛出，照片状态为 'failed'
   */
  async uploadPhoto(photo: LocalPhoto): Promise<UploadResult> {
    const entry = this.getOrCreateEntry(photo);
    entry.status = 'uploading';
    entry.lastError = undefined;

    const totalSize = photo.total_size ?? (await this.reader.sizeOf(photo.local_file_path));
    const totalChunks = Math.max(1, Math.ceil(totalSize / PHOTO_CHUNK_SIZE));
    entry.totalChunks = totalChunks;

    let totalRetries = entry.retries;

    try {
      for (let i = 0; i < totalChunks; i++) {
        // 断点续传：跳过已成功的分片
        if (entry.uploadedChunkIndices.includes(i)) {
          continue;
        }
        const { retries } = await this.uploadSingleChunkWithRetry(photo, i, totalChunks);
        totalRetries += retries;
        entry.uploadedChunkIndices.push(i);
        entry.retries = totalRetries;
      }

      // 全部分片齐 → 完成确认
      const completeResp = await this.completeUpload(photo);

      entry.status = 'completed';
      return {
        photo_client_uuid: photo.client_uuid,
        remote_file_path: completeResp.remote_file_path,
        uploaded_chunks: entry.uploadedChunkIndices.length,
        total_chunks: totalChunks,
        retries: totalRetries,
      };
    } catch (error) {
      entry.status = 'failed';
      entry.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      // 释放默认 reader 的内存缓存（自定义 reader 自行管理）
      if (this.reader instanceof FetchBlobChunkReader) {
        this.reader.clear(photo.local_file_path);
      }
    }
  }

  /**
   * 上传单个分片，带指数退避重试。
   * @returns 该分片成功前的累计重试次数
   */
  private async uploadSingleChunkWithRetry(
    photo: LocalPhoto,
    chunkIndex: number,
    totalChunks: number,
  ): Promise<{ retries: number }> {
    let attempt = 0;
    // 捕获最后一次错误用于重试耗尽时抛出
    let lastError: unknown = null;

    while (attempt < PHOTO_CHUNK_MAX_RETRIES) {
      try {
        const chunkBlob = await this.reader.readChunk(
          photo.local_file_path,
          chunkIndex,
          PHOTO_CHUNK_SIZE,
        );
        await this.apiClient.postFormData<UploadChunkResponse>(UPLOAD_CHUNK_PATH, {
          photo_client_uuid: photo.client_uuid,
          chunk_index: chunkIndex,
          total_chunks: totalChunks,
          chunk_data: chunkBlob,
        });
        return { retries: attempt };
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error)) {
          // 不可重试（服务端业务错误）：直接抛出，整张照片失败
          throw error;
        }
        // 可重试：指数退避后重试
        await sleep(backoffDelay(attempt));
        attempt += 1;
      }
    }
    // 重试耗尽
    throw lastError instanceof Error
      ? lastError
      : new Error(`分片 ${chunkIndex} 上传失败：重试 ${PHOTO_CHUNK_MAX_RETRIES} 次后仍不可达`);
  }

  /** 调用完成上传接口，提交 file_hash + 元数据 */
  private async completeUpload(photo: LocalPhoto): Promise<CompleteUploadResponse> {
    return this.apiClient.post<CompleteUploadResponse>(COMPLETE_PATH, {
      photo_client_uuid: photo.client_uuid,
      file_hash: photo.file_hash,
      metadata: photo.metadata,
    });
  }

  /**
   * 获取或创建队列项（支持断点续传：若该照片曾部分上传，复用已记录的分片进度）。
   */
  private getOrCreateEntry(photo: LocalPhoto): QueueEntry {
    let entry = this.queue.get(photo.client_uuid);
    if (!entry) {
      entry = {
        photo,
        status: 'pending',
        uploadedChunkIndices: [],
        totalChunks: 0,
        retries: 0,
      };
      this.queue.set(photo.client_uuid, entry);
    } else {
      // 复用进度，但更新 photo 引用（字段可能变更）
      entry.photo = photo;
      entry.status = 'pending';
    }
    return entry;
  }

  // ============== 队列查询接口（供 UI / 调度器使用）==============

  /** 获取某张照片的队列快照（不存在返回 undefined） */
  getEntry(photoClientUuid: string): QueueEntry | undefined {
    return this.queue.get(photoClientUuid);
  }

  /** 所有队列项快照 */
  getAllEntries(): QueueEntry[] {
    return Array.from(this.queue.values());
  }

  /** 当前处于某状态的照片数 */
  countByStatus(status: UploadStatus): number {
    let n = 0;
    for (const entry of this.queue.values()) {
      if (entry.status === status) {
        n += 1;
      }
    }
    return n;
  }

  /**
   * 将失败的照片重置为 pending（清除 lastError，保留已上传分片进度用于断点续传）。
   * 调度器可随后重新调用 uploadPhoto 触发重试。
   */
  resetToPending(photoClientUuid: string): boolean {
    const entry = this.queue.get(photoClientUuid);
    if (!entry) {
      return false;
    }
    entry.status = 'pending';
    entry.lastError = undefined;
    return true;
  }

  /** 从队列中移除某张照片（成功后清理 / 用户删除照片时调用） */
  remove(photoClientUuid: string): boolean {
    return this.queue.delete(photoClientUuid);
  }
}
