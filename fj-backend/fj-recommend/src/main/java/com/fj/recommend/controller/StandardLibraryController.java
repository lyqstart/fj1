package com.fj.recommend.controller;

import com.fj.common.response.ApiResponse;
import com.fj.recommend.entity.StandardClause;
import com.fj.recommend.entity.StandardDocument;
import com.fj.recommend.service.StandardLibraryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 标准库管理 REST API（/api/v1/standards）。
 */
@RestController
@RequestMapping("/api/v1/standards")
@RequiredArgsConstructor
public class StandardLibraryController {

    private final StandardLibraryService standardLibraryService;

    // ==================== 标准文档 ====================

    /** 查询标准文档列表 */
    @GetMapping("/documents")
    public ApiResponse<List<StandardDocument>> listDocuments() {
        return ApiResponse.ok(standardLibraryService.listDocuments());
    }

    /** 查看标准文档详情 */
    @GetMapping("/documents/{id}")
    public ApiResponse<StandardDocument> documentDetail(@PathVariable Long id) {
        return ApiResponse.ok(standardLibraryService.documentDetail(id));
    }

    /** 创建标准文档 */
    @PostMapping("/documents")
    public ApiResponse<StandardDocument> createDocument(@RequestBody StandardDocument document) {
        return ApiResponse.ok(standardLibraryService.createDocument(document));
    }

    /** 更新标准文档 */
    @PutMapping("/documents/{id}")
    public ApiResponse<StandardDocument> updateDocument(@PathVariable Long id,
                                                        @RequestBody StandardDocument document) {
        return ApiResponse.ok(standardLibraryService.updateDocument(id, document));
    }

    // ==================== 标准条款 ====================

    /** 按文档查询条款 */
    @GetMapping("/documents/{documentId}/clauses")
    public ApiResponse<List<StandardClause>> listClausesByDocument(@PathVariable Long documentId) {
        return ApiResponse.ok(standardLibraryService.listClausesByDocument(documentId));
    }

    /** 按分类查询条款 */
    @GetMapping("/clauses")
    public ApiResponse<List<StandardClause>> listClauses(@RequestParam(required = false) String category,
                                                         @RequestParam(required = false) String keyword) {
        if (keyword != null && !keyword.isBlank()) {
            return ApiResponse.ok(standardLibraryService.searchByKeyword(keyword));
        }
        if (category != null && !category.isBlank()) {
            return ApiResponse.ok(standardLibraryService.listClausesByCategory(category));
        }
        return ApiResponse.ok(List.of());
    }

    /** 查看条款详情 */
    @GetMapping("/clauses/{id}")
    public ApiResponse<StandardClause> clauseDetail(@PathVariable Long id) {
        return ApiResponse.ok(standardLibraryService.clauseDetail(id));
    }

    /** 创建条款 */
    @PostMapping("/clauses")
    public ApiResponse<StandardClause> createClause(@RequestBody StandardClause clause) {
        return ApiResponse.ok(standardLibraryService.createClause(clause));
    }

    /** 更新条款 */
    @PutMapping("/clauses/{id}")
    public ApiResponse<StandardClause> updateClause(@PathVariable Long id, @RequestBody StandardClause clause) {
        return ApiResponse.ok(standardLibraryService.updateClause(id, clause));
    }
}
