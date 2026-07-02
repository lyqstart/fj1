package com.fj.sync.photo;

import com.fj.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.Map;

/**
 * 照片上传 REST API（DD-2 / §6.4）。
 *
 * <p>三步式分片上传：
 * <ol>
 *   <li>{@code POST /api/v1/photos/upload/init} — 初始化上传，返回 chunk_size 与临时目录。</li>
 *   <li>{@code POST /api/v1/photos/upload/chunk} — 上传单个分片（支持并发 2-3 个，§103.2）。</li>
 *   <li>{@code POST /api/v1/photos/upload/complete} — 合并分片 + SHA-256 校验 + 返回签名访问 URL。</li>
 * </ol>
 *
 * <p>照片元数据（client_uuid / hash / type）随文本 Push 同步（§6.4），文件异步上传。
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class PhotoUploadController {

    private final PhotoStorageService photoStorageService;
    private final HmacUrlSigner hmacUrlSigner;

    /**
     * 初始化分片上传。
     *
     * @param photoClientUuid 照片客户端 UUID
     * @return chunk_size 与临时目录路径
     */
    @PostMapping("/api/v1/photos/upload/init")
    public ApiResponse<Map<String, Object>> initUpload(@RequestParam String photoClientUuid) {
        Path tmpDir = photoStorageService.initUpload(photoClientUuid);
        return ApiResponse.ok(Map.of(
                "photo_client_uuid", photoClientUuid,
                "chunk_size", photoStorageService.getChunkSize(),
                "tmp_dir", tmpDir.toString()
        ));
    }

    /**
     * 上传单个分片。
     *
     * @param photoClientUuid 照片客户端 UUID
     * @param chunkIndex      分片序号（0-based）
     * @param chunkData       分片二进制（multipart）
     */
    @PostMapping("/api/v1/photos/upload/chunk")
    public ApiResponse<Map<String, Object>> uploadChunk(@RequestParam String photoClientUuid,
                                                        @RequestParam int chunkIndex,
                                                        @RequestPart("chunk_data") MultipartFile chunkData) {
        try {
            byte[] data = chunkData.getBytes();
            photoStorageService.writeChunk(photoClientUuid, chunkIndex, data);
            return ApiResponse.ok(Map.of(
                    "photo_client_uuid", photoClientUuid,
                    "chunk_index", chunkIndex,
                    "received_bytes", data.length
            ));
        } catch (Exception e) {
            throw new FileAccessException("分片上传失败: " + photoClientUuid + "/" + chunkIndex, e);
        }
    }

    /**
     * 完成上传：合并分片 + SHA-256 校验。
     *
     * @param photoClientUuid 照片客户端 UUID
     * @param projectId       项目 ID
     * @param dailyReportId   所属日报 ID（可空）
     * @param fileName        最终文件名
     * @param fileHash        客户端提交的 SHA-256（Base64）
     */
    @PostMapping("/api/v1/photos/upload/complete")
    public ApiResponse<Map<String, Object>> completeUpload(@RequestParam String photoClientUuid,
                                                           @RequestParam Long projectId,
                                                           @RequestParam(required = false) Long dailyReportId,
                                                           @RequestParam String fileName,
                                                           @RequestParam String fileHash) {
        Path finalFile = photoStorageService.completeAndVerify(
                photoClientUuid, projectId, dailyReportId, fileName, fileHash);
        String accessUrl = "/api/v1/photos/" + photoClientUuid + "/file";
        String signedUrl = hmacUrlSigner.sign(accessUrl);
        return ApiResponse.ok(Map.of(
                "photo_client_uuid", photoClientUuid,
                "file_path", finalFile.toString(),
                "sha256", photoStorageService.sha256(finalFile),
                "access_url", signedUrl,
                "expires_in_seconds", hmacUrlSigner.defaultExpiry().getSeconds()
        ));
    }

    /**
     * 校验签名并返回文件信息（实际文件流由 Nginx X-Accel-Redirect 转发，§7.3）。
     * <p>这里仅做签名校验与元信息返回，文件下载流由网关层处理。
     */
    @GetMapping("/api/v1/photos/{photoClientUuid}/file")
    public ApiResponse<Map<String, Object>> accessFile(@PathVariable String photoClientUuid,
                                                       @RequestParam long expires,
                                                       @RequestParam String sig) {
        String path = "/api/v1/photos/" + photoClientUuid + "/file";
        if (!hmacUrlSigner.verify(path, expires, sig)) {
            throw new FileAccessException("签名无效或已过期");
        }
        return ApiResponse.ok(Map.of(
                "photo_client_uuid", photoClientUuid,
                "status", "authorized"
        ));
    }
}
