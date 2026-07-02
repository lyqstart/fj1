package com.fj.recommend.service;

import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.recommend.entity.StandardClause;
import com.fj.recommend.entity.StandardDocument;
import com.fj.recommend.repository.StandardClauseRepository;
import com.fj.recommend.repository.StandardDocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 标准库管理 Service（标准文档 + 条款管理 + 关键词检索）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StandardLibraryService {

    private final StandardDocumentRepository documentRepository;
    private final StandardClauseRepository clauseRepository;

    // ==================== 标准文档 ====================

    /**
     * 创建标准文档。
     */
    @Transactional
    public StandardDocument createDocument(StandardDocument document) {
        return documentRepository.save(document);
    }

    /**
     * 查看标准文档详情。
     */
    @Transactional(readOnly = true)
    public StandardDocument documentDetail(Long id) {
        return requireDocument(id);
    }

    /**
     * 查询全部标准文档。
     */
    @Transactional(readOnly = true)
    public List<StandardDocument> listDocuments() {
        return documentRepository.findAll();
    }

    /**
     * 更新标准文档。
     */
    @Transactional
    public StandardDocument updateDocument(Long id, StandardDocument patch) {
        StandardDocument existing = requireDocument(id);
        if (patch.getTitle() != null) {
            existing.setTitle(patch.getTitle());
        }
        if (patch.getDocNumber() != null) {
            existing.setDocNumber(patch.getDocNumber());
        }
        if (patch.getPublishDate() != null) {
            existing.setPublishDate(patch.getPublishDate());
        }
        if (patch.getStatus() != null) {
            existing.setStatus(patch.getStatus());
        }
        if (patch.getVersion() != null) {
            existing.setVersion(patch.getVersion());
        }
        return documentRepository.save(existing);
    }

    // ==================== 标准条款 ====================

    /**
     * 创建标准条款。
     */
    @Transactional
    public StandardClause createClause(StandardClause clause) {
        requireDocument(clause.getDocumentId());
        return clauseRepository.save(clause);
    }

    /**
     * 查看条款详情。
     */
    @Transactional(readOnly = true)
    public StandardClause clauseDetail(Long id) {
        return requireClause(id);
    }

    /**
     * 按文档查询条款列表。
     */
    @Transactional(readOnly = true)
    public List<StandardClause> listClausesByDocument(Long documentId) {
        return clauseRepository.findByDocumentId(documentId);
    }

    /**
     * 按分类查询条款。
     */
    @Transactional(readOnly = true)
    public List<StandardClause> listClausesByCategory(String category) {
        return clauseRepository.findByCategory(category);
    }

    /**
     * 关键词检索条款（命中 keyword_tags 或 content）。
     */
    @Transactional(readOnly = true)
    public List<StandardClause> searchByKeyword(String keyword) {
        return clauseRepository.searchByKeyword(keyword);
    }

    /**
     * 更新条款。
     */
    @Transactional
    public StandardClause updateClause(Long id, StandardClause patch) {
        StandardClause existing = requireClause(id);
        if (patch.getClauseNumber() != null) {
            existing.setClauseNumber(patch.getClauseNumber());
        }
        if (patch.getContent() != null) {
            existing.setContent(patch.getContent());
        }
        if (patch.getCategory() != null) {
            existing.setCategory(patch.getCategory());
        }
        if (patch.getKeywordTags() != null) {
            existing.setKeywordTags(patch.getKeywordTags());
        }
        if (patch.getIssueTemplateId() != null) {
            existing.setIssueTemplateId(patch.getIssueTemplateId());
        }
        return clauseRepository.save(existing);
    }

    private StandardDocument requireDocument(Long id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "标准文档不存在: " + id));
    }

    private StandardClause requireClause(Long id) {
        return clauseRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "标准条款不存在: " + id));
    }
}
