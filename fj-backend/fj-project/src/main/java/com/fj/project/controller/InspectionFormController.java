package com.fj.project.controller;

import com.fj.common.response.ApiResponse;
import com.fj.project.entity.InspectionFormItem;
import com.fj.project.entity.ProjectInspectionForm;
import com.fj.project.service.InspectionFormService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 项目检查表 REST API（/api/v1/projects/{projectId}/inspection-forms）。
 */
@RestController
@RequestMapping("/api/v1/projects/{projectId}/inspection-forms")
@RequiredArgsConstructor
public class InspectionFormController {

    private final InspectionFormService inspectionFormService;

    /** 查询项目下检查表列表 */
    @GetMapping
    public ApiResponse<List<ProjectInspectionForm>> list(@PathVariable Long projectId) {
        return ApiResponse.ok(inspectionFormService.listByProject(projectId));
    }

    /** 查看检查表详情 */
    @GetMapping("/{formId}")
    public ApiResponse<ProjectInspectionForm> detail(@PathVariable Long projectId, @PathVariable Long formId) {
        return ApiResponse.ok(inspectionFormService.detail(formId));
    }

    /** 创建检查表 */
    @PostMapping
    public ApiResponse<ProjectInspectionForm> create(@PathVariable Long projectId,
                                                     @RequestBody ProjectInspectionForm form) {
        form.setProjectId(projectId);
        return ApiResponse.ok(inspectionFormService.create(form));
    }

    /** 更新检查表基本信息 */
    @PutMapping("/{formId}")
    public ApiResponse<ProjectInspectionForm> update(@PathVariable Long projectId, @PathVariable Long formId,
                                                     @RequestBody ProjectInspectionForm form) {
        return ApiResponse.ok(inspectionFormService.update(formId, form));
    }

    /** 发布检查表（DRAFT→ACTIVE） */
    @PostMapping("/{formId}/publish")
    public ApiResponse<ProjectInspectionForm> publish(@PathVariable Long projectId, @PathVariable Long formId) {
        return ApiResponse.ok(inspectionFormService.publish(formId));
    }

    // ==================== 条目管理 ====================

    /** 查询检查表条目 */
    @GetMapping("/{formId}/items")
    public ApiResponse<List<InspectionFormItem>> listItems(@PathVariable Long projectId,
                                                           @PathVariable Long formId) {
        return ApiResponse.ok(inspectionFormService.listItems(formId));
    }

    /** 新增检查表条目 */
    @PostMapping("/{formId}/items")
    public ApiResponse<InspectionFormItem> addItem(@PathVariable Long projectId, @PathVariable Long formId,
                                                   @RequestBody InspectionFormItem item) {
        return ApiResponse.ok(inspectionFormService.addItem(formId, item));
    }

    /** 更新检查表条目 */
    @PutMapping("/{formId}/items/{itemId}")
    public ApiResponse<InspectionFormItem> updateItem(@PathVariable Long projectId, @PathVariable Long formId,
                                                      @PathVariable Long itemId, @RequestBody InspectionFormItem item) {
        return ApiResponse.ok(inspectionFormService.updateItem(formId, itemId, item));
    }

    /** 删除检查表条目 */
    @DeleteMapping("/{formId}/items/{itemId}")
    public ApiResponse<Void> deleteItem(@PathVariable Long projectId, @PathVariable Long formId,
                                        @PathVariable Long itemId) {
        inspectionFormService.deleteItem(formId, itemId);
        return ApiResponse.ok();
    }

    /** 设置检查项默认绑定标准条款（TASK-014） */
    @PutMapping("/{formId}/items/{itemId}/binding/{standardBindingId}")
    public ApiResponse<InspectionFormItem> bindStandard(@PathVariable Long projectId, @PathVariable Long formId,
                                                        @PathVariable Long itemId,
                                                        @PathVariable Long standardBindingId) {
        return ApiResponse.ok(inspectionFormService.bindStandard(formId, itemId, standardBindingId));
    }
}
