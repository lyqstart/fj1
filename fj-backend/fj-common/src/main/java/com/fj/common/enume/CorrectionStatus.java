package com.fj.common.enume;

/**
 * 问题整改状态枚举（对应 daily_report_issues.correction_status / project_issues.correction_status VARCHAR，§101.10）。
 * <p>共享枚举：fj-inspection（日报问题）和 fj-issue（项目问题池）共用，避免模块间循环依赖。
 * <p>记录问题从发现到整改闭环的状态。
 */
public enum CorrectionStatus {

    /** 待整改 */
    PENDING,
    /** 整改中 */
    IN_PROGRESS,
    /** 已整改 */
    CORRECTED,
    /** 已验证（整改后复检通过） */
    VERIFIED
}
