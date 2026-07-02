package com.fj.inspection.entity;

/**
 * 照片 GPS 状态枚举（对应 photos.gps_status VARCHAR，§101.13）。
 * <p>用于强提醒校验（§9.1 三层校验）：GPS 缺失/可疑时提交强提醒。
 */
public enum GpsStatus {

    /** GPS 有效（精度可接受） */
    VALID,
    /** GPS 未知（采集时未能判定） */
    UNKNOWN,
    /** GPS 缺失（未采集到） */
    MISSING,
    /** GPS 可疑（疑似伪造/漂移，SPOOFED） */
    SPOOFED
}
