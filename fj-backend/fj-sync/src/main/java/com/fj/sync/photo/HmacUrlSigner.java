package com.fj.sync.photo;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

/**
 * HMAC-SHA256 URL 签名器（§7.3）。
 * <p>为照片 / 导出文件生成带时效的签名 URL，防止 URL 泄露被未授权访问。
 *
 * <h3>签名格式</h3>
 * <pre>{@code
 * signed_url = base_url + "?expires=<epoch_seconds>&sig=<base64url(hmac_sha256(secret, path + expires))>"
 * }</pre>
 *
 * <p>密钥通过配置 {@code fj.photo.hmac-secret} 注入，不硬编码。
 */
@Slf4j
@Component
public class HmacUrlSigner {

    private static final String HMAC_ALGORITHM = "HmacSHA256";

    @Value("${fj.photo.hmac-secret:change-me-in-production}")
    private String secret;

    /** 签名有效期（秒），默认 5 分钟（§7.3） */
    @Value("${fj.photo.url-expiry-seconds:300}")
    private long urlExpirySeconds;

    @PostConstruct
    public void validate() {
        if ("change-me-in-production".equals(secret)) {
            log.warn("HmacUrlSigner using default secret — configure 'fj.photo.hmac-secret' for production");
        }
    }

    /**
     * 生成签名 URL。
     *
     * @param baseUrl 基础访问路径（如 {@code /api/v1/photos/123/file}）
     * @return 带时效签名的完整 URL
     */
    public String sign(String baseUrl) {
        long expires = System.currentTimeMillis() / 1000 + urlExpirySeconds;
        String payload = baseUrl + expires;
        String sig = hmac(payload);
        String queryJoin = baseUrl.contains("?") ? "&" : "?";
        return baseUrl + queryJoin + "expires=" + expires + "&sig=" + sig;
    }

    /**
     * 校验签名 URL 是否有效（签名匹配且未过期）。
     *
     * @param path    请求路径（不含查询参数）
     * @param expires 过期时间戳（秒）
     * @param sig     客户端携带的签名
     * @return true 若签名有效且未过期
     */
    public boolean verify(String path, long expires, String sig) {
        if (expires < System.currentTimeMillis() / 1000) {
            return false;
        }
        String expected = hmac(path + expires);
        return constantTimeEquals(expected, sig);
    }

    /** 默认有效期（便于上层提前判断） */
    public Duration defaultExpiry() {
        return Duration.ofSeconds(urlExpirySeconds);
    }

    private String hmac(String payload) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            byte[] raw = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        } catch (Exception e) {
            throw new FileAccessException("HMAC 签名计算失败", e);
        }
    }

    /** 常量时间比较，避免时序攻击 */
    private boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null || a.length() != b.length()) {
            return false;
        }
        int r = 0;
        for (int i = 0; i < a.length(); i++) {
            r |= a.charAt(i) ^ b.charAt(i);
        }
        return r == 0;
    }
}
