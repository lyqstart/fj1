package com.fj.sync.photo;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

/**
 * 照片磁盘存储 Service（DD-2 / §6.4）。
 *
 * <h3>存储布局</h3>
 * <ul>
 *   <li>最终路径：{@code <base>/<project_id>/<yyyy-MM>/<daily_report_id>/<filename>}</li>
 *   <li>分片临时：{@code <base>/.tmp/<photo_client_uuid>/chunks/chunk_<index>}</li>
 * </ul>
 *
 * <p>支持分片写入、断点续传（已存在分片跳过）、合并、SHA-256 完整性校验。
 * 基础存储目录与分片大小通过配置注入，不硬编码。
 */
@Slf4j
@Service
public class PhotoStorageService {

    @Value("${fj.photo.storage-base:/data/photos}")
    private String storageBase;

    /** 初始化上传时返回给客户端的分片大小（字节），默认 1MB */
    @Value("${fj.photo.chunk-size:1048576}")
    private int chunkSize;

    @PostConstruct
    public void init() throws IOException {
        Path base = Paths.get(storageBase);
        Files.createDirectories(base);
        log.info("PhotoStorageService initialized: base={}, chunkSize={}", base.toAbsolutePath(), chunkSize);
    }

    /**
     * 初始化一次分片上传：创建临时分片目录。
     *
     * @param photoClientUuid 照片客户端 UUID
     * @return 分片目录路径
     */
    public Path initUpload(String photoClientUuid) {
        if (photoClientUuid == null || photoClientUuid.isBlank()) {
            throw new FileAccessException("photo_client_uuid 不能为空");
        }
        Path chunksDir = chunksDir(photoClientUuid);
        try {
            Files.createDirectories(chunksDir);
        } catch (IOException e) {
            throw new FileAccessException("创建分片目录失败: " + photoClientUuid, e);
        }
        return chunksDir;
    }

    /**
     * 写入一个分片（支持断点续传：已存在则覆盖以保证一致性）。
     *
     * @param photoClientUuid 照片客户端 UUID
     * @param chunkIndex      分片序号（从 0 开始）
     * @param data            分片二进制
     */
    public void writeChunk(String photoClientUuid, int chunkIndex, byte[] data) {
        if (data == null) {
            throw new FileAccessException("分片数据为空");
        }
        Path chunkFile = chunksDir(photoClientUuid).resolve("chunk_" + chunkIndex);
        try {
            Files.createDirectories(chunkFile.getParent());
            Files.write(chunkFile, data);
        } catch (IOException e) {
            throw new FileAccessException("写入分片失败: " + photoClientUuid + "/" + chunkIndex, e);
        }
    }

    /**
     * 合并全部分片到最终路径，并校验 SHA-256 哈希。
     *
     * @param photoClientUuid 照片客户端 UUID
     * @param projectId       项目 ID
     * @param dailyReportId   所属日报 ID（可空：未关联日报时落到 unknown 子目录）
     * @param fileName        最终文件名（含扩展名）
     * @param expectedHash    客户端提交的 SHA-256（Base64），用于完整性校验
     * @return 最终文件路径
     */
    public Path completeAndVerify(String photoClientUuid, Long projectId, Long dailyReportId,
                                  String fileName, String expectedHash) {
        Path chunksDir = chunksDir(photoClientUuid);
        if (!Files.exists(chunksDir)) {
            throw new FileAccessException("分片目录不存在，请先 init/upload-chunk: " + photoClientUuid);
        }
        Path target = finalPath(projectId, dailyReportId, fileName);
        try {
            Files.createDirectories(target.getParent());
            String actualHash = mergeChunks(chunksDir, target);
            if (expectedHash != null && !expectedHash.isBlank()
                    && !actualHash.equals(expectedHash)) {
                // 哈希不匹配：删除已合并文件，避免脏数据
                Files.deleteIfExists(target);
                throw new FileAccessException("照片哈希校验失败：expected=" + expectedHash + ", actual=" + actualHash);
            }
            // 校验通过后清理临时分片
            cleanupChunks(chunksDir);
            log.info("Photo upload completed: {}, hash={}, size={}", target, actualHash, Files.size(target));
            return target;
        } catch (IOException e) {
            throw new FileAccessException("合并分片失败: " + photoClientUuid, e);
        }
    }

    /**
     * 计算文件的 SHA-256（Base64 编码）。
     */
    public String sha256(Path file) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = Files.readAllBytes(file);
            return Base64.getEncoder().encodeToString(digest.digest(bytes));
        } catch (Exception e) {
            throw new FileAccessException("计算文件哈希失败: " + file, e);
        }
    }

    /** 推荐的分片大小（字节） */
    public int getChunkSize() {
        return chunkSize;
    }

    /** 计算最终存储路径：<base>/<project_id>/<yyyy-MM>/<daily_report_id>/<fileName> */
    private Path finalPath(Long projectId, Long dailyReportId, String fileName) {
        String month = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));
        String projDir = projectId == null ? "unknown" : String.valueOf(projectId);
        String reportDir = dailyReportId == null ? "unknown" : String.valueOf(dailyReportId);
        return Paths.get(storageBase, projDir, month, reportDir, fileName);
    }

    /** 分片临时目录：<base>/.tmp/<photoClientUuid>/chunks */
    private Path chunksDir(String photoClientUuid) {
        return Paths.get(storageBase, ".tmp", photoClientUuid, "chunks");
    }

    /** 按序号合并全部分片到目标文件，返回 SHA-256（Base64） */
    private String mergeChunks(Path chunksDir, Path target) throws IOException {
        try (Stream<Path> stream = Files.list(chunksDir)) {
            List<Path> sorted = stream
                    .filter(Files::isRegularFile)
                    .sorted(Comparator.comparingInt(this::chunkIndexOf))
                    .toList();
            if (sorted.isEmpty()) {
                throw new FileAccessException("无分片可合并: " + chunksDir);
            }
            MessageDigest digest;
            try {
                digest = MessageDigest.getInstance("SHA-256");
            } catch (Exception e) {
                throw new IOException("SHA-256 不可用", e);
            }
            try (RandomAccessFile out = new RandomAccessFile(target.toFile(), "rw")) {
                out.setLength(0);
                byte[] buf = new byte[8192];
                for (Path chunk : sorted) {
                    try (java.io.InputStream in = Files.newInputStream(chunk)) {
                        int n;
                        while ((n = in.read(buf)) != -1) {
                            out.write(buf, 0, n);
                            digest.update(buf, 0, n);
                        }
                    }
                }
            }
            return Base64.getEncoder().encodeToString(digest.digest());
        }
    }

    private int chunkIndexOf(Path chunk) {
        String name = chunk.getFileName().toString();
        try {
            return Integer.parseInt(name.substring("chunk_".length()));
        } catch (NumberFormatException e) {
            return Integer.MAX_VALUE;
        }
    }

    /** 递归清理临时分片目录 */
    private void cleanupChunks(Path chunksDir) {
        try (Stream<Path> stream = Files.walk(chunksDir)) {
            stream.sorted(Comparator.reverseOrder())
                    .forEach(p -> {
                        try {
                            Files.deleteIfExists(p);
                        } catch (IOException ignored) {
                            // 清理失败不影响主流程
                        }
                    });
        } catch (IOException e) {
            log.warn("清理临时分片目录失败: {}", chunksDir, e);
        }
    }
}
