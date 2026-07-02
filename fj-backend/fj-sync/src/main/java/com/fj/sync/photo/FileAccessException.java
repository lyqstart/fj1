package com.fj.sync.photo;

/**
 * 照片文件访问异常（存储 / 哈希校验 / 签名失败时抛出）。
 * <p>属于可恢复或可向用户展示的业务异常。
 */
public class FileAccessException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public FileAccessException(String message) {
        super(message);
    }

    public FileAccessException(String message, Throwable cause) {
        super(message, cause);
    }
}
