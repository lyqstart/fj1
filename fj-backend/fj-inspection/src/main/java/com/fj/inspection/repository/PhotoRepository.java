package com.fj.inspection.repository;

import com.fj.inspection.entity.Photo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 照片 Repository（支持按日报/问题查询，client_photo_uuid 幂等查询）。
 */
@Repository
public interface PhotoRepository extends JpaRepository<Photo, Long> {

    /** 按日报 ID 查询全部照片 */
    List<Photo> findByDailyReportId(Long dailyReportId);

    /** 按日报问题 ID 查询照片 */
    List<Photo> findByDailyReportIssueId(Long dailyReportIssueId);

    /** client_photo_uuid 幂等查询（去重/续传） */
    Optional<Photo> findByClientPhotoUuid(String clientPhotoUuid);

    /** 统计日报下照片总数（强提醒校验：照片不足） */
    long countByDailyReportId(Long dailyReportId);

    /** 统计日报问题下照片数（强提醒校验） */
    long countByDailyReportIssueId(Long dailyReportIssueId);
}
