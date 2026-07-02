package com.fj.export.repository;

import com.fj.export.entity.ExportFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 导出文件 Repository。
 */
@Repository
public interface ExportFileRepository extends JpaRepository<ExportFile, Long> {

    /** 按报告 ID 查询全部导出文件（按生成时刻倒序，最新优先） */
    List<ExportFile> findByReportIdOrderByGeneratedAtDesc(Long reportId);

    /** 统计报告下指定类型的导出文件数（用于生成版本化文件名） */
    long countByReportIdAndFileType(Long reportId, com.fj.export.entity.ExportFileType fileType);
}
