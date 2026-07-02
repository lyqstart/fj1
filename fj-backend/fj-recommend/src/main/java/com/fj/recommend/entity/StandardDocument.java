package com.fj.recommend.entity;

import com.fj.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serial;
import java.time.LocalDate;

/**
 * 标准文档实体（对应 V3 standard_documents 表）。
 * <p>国标 / 行标 / 地标的基础载体。
 */
@Entity
@Table(name = "standard_documents")
@Getter
@Setter
public class StandardDocument extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    /** 标准编号（如 GB 50251） */
    @Column(name = "doc_number", length = 128)
    private String docNumber;

    @Column(name = "publish_date")
    private LocalDate publishDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private StandardDocumentStatus status = StandardDocumentStatus.PUBLISHED;

    @Column(name = "version", length = 32)
    private String version;
}
