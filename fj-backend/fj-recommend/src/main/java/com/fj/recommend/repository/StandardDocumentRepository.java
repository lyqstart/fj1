package com.fj.recommend.repository;

import com.fj.recommend.entity.StandardDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 标准文档 Repository。
 */
@Repository
public interface StandardDocumentRepository extends JpaRepository<StandardDocument, Long> {

    /** 按标准编号查询 */
    Optional<StandardDocument> findByDocNumber(String docNumber);
}
