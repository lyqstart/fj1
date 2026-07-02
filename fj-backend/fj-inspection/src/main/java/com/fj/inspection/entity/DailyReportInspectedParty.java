package com.fj.inspection.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;

/**
 * 日报受检单位实体（对应 V5 daily_report_inspected_parties 表，§101.9）。
 * <p>日报涉及的受检方信息（施工/监理/分包/供应商等）。
 */
@Entity
@Table(name = "daily_report_inspected_parties")
@Getter
@Setter
public class DailyReportInspectedParty extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "daily_report_id", nullable = false)
    private Long dailyReportId;

    /** 受检方名称 */
    @Column(name = "party_name", nullable = false, length = 255)
    private String partyName;

    /** 受检方类型（施工/监理/分包/供应商...） */
    @Column(name = "party_type", length = 64)
    private String partyType;
}
