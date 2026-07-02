package com.fj.project.service;

import com.fj.common.exception.BusinessException;
import com.fj.common.exception.ErrorCode;
import com.fj.project.entity.BindingType;
import com.fj.project.entity.CheckItemStandardBinding;
import com.fj.project.entity.FormStatus;
import com.fj.project.entity.InspectionFormItem;
import com.fj.project.entity.ProjectInspectionForm;
import com.fj.project.repository.CheckItemStandardBindingRepository;
import com.fj.project.repository.InspectionFormItemRepository;
import com.fj.project.repository.InspectionFormRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 检查表 Service（CRUD + 条目管理 + 发布检查表）。
 * <p>检查表发布（DRAFT→ACTIVE）后条目锁定，不可再增删改条目。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InspectionFormService {

    private final InspectionFormRepository formRepository;
    private final InspectionFormItemRepository itemRepository;
    private final CheckItemStandardBindingRepository bindingRepository;

    /**
     * 创建检查表（默认 DRAFT 状态）。
     */
    @Transactional
    public ProjectInspectionForm create(ProjectInspectionForm form) {
        if (form.getStatus() == null) {
            form.setStatus(FormStatus.DRAFT);
        }
        if (form.getVersion() == null) {
            form.setVersion(1);
        }
        return formRepository.save(form);
    }

    /**
     * 查看检查表详情。
     */
    @Transactional(readOnly = true)
    public ProjectInspectionForm detail(Long id) {
        return requireForm(id);
    }

    /**
     * 按项目查询检查表列表。
     */
    @Transactional(readOnly = true)
    public List<ProjectInspectionForm> listByProject(Long projectId) {
        return formRepository.findByProjectId(projectId);
    }

    /**
     * 更新检查表基本信息（仅 DRAFT 状态可改名称）。
     */
    @Transactional
    public ProjectInspectionForm update(Long id, ProjectInspectionForm patch) {
        ProjectInspectionForm existing = requireForm(id);
        if (existing.getStatus() != FormStatus.DRAFT) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED, "非草稿状态检查表不可修改");
        }
        if (patch.getName() != null) {
            existing.setName(patch.getName());
        }
        return formRepository.save(existing);
    }

    /**
     * 发布检查表（DRAFT→ACTIVE），发布后条目锁定。
     */
    @Transactional
    public ProjectInspectionForm publish(Long id) {
        ProjectInspectionForm existing = requireForm(id);
        if (existing.getStatus() != FormStatus.DRAFT) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED, "仅草稿状态检查表可发布");
        }
        if (!itemRepository.existsByFormId(id)) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, "检查表无条目，不可发布");
        }
        existing.setStatus(FormStatus.ACTIVE);
        return formRepository.save(existing);
    }

    // ==================== 条目管理 ====================

    /**
     * 查询检查表条目（按 sort_order 排序）。
     */
    @Transactional(readOnly = true)
    public List<InspectionFormItem> listItems(Long formId) {
        requireForm(formId);
        return itemRepository.findByFormIdOrderBySortOrderAsc(formId);
    }

    /**
     * 新增检查表条目（仅 DRAFT 状态可加）。
     */
    @Transactional
    public InspectionFormItem addItem(Long formId, InspectionFormItem item) {
        ProjectInspectionForm form = requireForm(formId);
        if (form.getStatus() != FormStatus.DRAFT) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED, "非草稿状态检查表不可新增条目");
        }
        item.setFormId(formId);
        if (item.getSortOrder() == null) {
            item.setSortOrder(0);
        }
        if (item.getIsRequired() == null) {
            item.setIsRequired(Boolean.FALSE);
        }
        return itemRepository.save(item);
    }

    /**
     * 更新检查表条目（仅 DRAFT 状态可改）。
     */
    @Transactional
    public InspectionFormItem updateItem(Long formId, Long itemId, InspectionFormItem patch) {
        ProjectInspectionForm form = requireForm(formId);
        if (form.getStatus() != FormStatus.DRAFT) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED, "非草稿状态检查表不可修改条目");
        }
        InspectionFormItem existing = requireItem(itemId);
        if (!existing.getFormId().equals(formId)) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, "条目不属于该检查表");
        }
        if (patch.getCategory() != null) {
            existing.setCategory(patch.getCategory());
        }
        if (patch.getCheckContent() != null) {
            existing.setCheckContent(patch.getCheckContent());
        }
        if (patch.getIsRequired() != null) {
            existing.setIsRequired(patch.getIsRequired());
        }
        if (patch.getSortOrder() != null) {
            existing.setSortOrder(patch.getSortOrder());
        }
        if (patch.getStandardBindingId() != null) {
            existing.setStandardBindingId(patch.getStandardBindingId());
        }
        return itemRepository.save(existing);
    }

    /**
     * 删除检查表条目（仅 DRAFT 状态可删）。
     */
    @Transactional
    public void deleteItem(Long formId, Long itemId) {
        ProjectInspectionForm form = requireForm(formId);
        if (form.getStatus() != FormStatus.DRAFT) {
            throw new BusinessException(ErrorCode.BIZ_OPERATION_NOT_ALLOWED, "非草稿状态检查表不可删除条目");
        }
        InspectionFormItem existing = requireItem(itemId);
        if (!existing.getFormId().equals(formId)) {
            throw new BusinessException(ErrorCode.BIZ_PARAMS_INVALID, "条目不属于该检查表");
        }
        itemRepository.delete(existing);
    }

    /**
     * 设置检查项默认绑定的标准条款（TASK-014 绑定管理入口）。
     * <p>仅记录绑定 ID 到 standard_binding_id；绑定明细由 CheckItemStandardBinding 维护。
     */
    @Transactional
    public InspectionFormItem bindStandard(Long formId, Long itemId, Long standardBindingId) {
        InspectionFormItem existing = updateItem(formId, itemId, new InspectionFormItem());
        existing.setStandardBindingId(standardBindingId);
        return itemRepository.save(existing);
    }

    // ==================== 检查项-标准条款绑定管理（TASK-014） ====================

    /**
     * 创建检查项-标准条款绑定。
     */
    @Transactional
    public CheckItemStandardBinding createBinding(CheckItemStandardBinding binding) {
        requireItem(binding.getCheckItemId());
        if (bindingRepository.existsByCheckItemIdAndStandardClauseId(
                binding.getCheckItemId(), binding.getStandardClauseId())) {
            throw new BusinessException(ErrorCode.DATA_ALREADY_EXISTS, "该检查项已绑定此标准条款");
        }
        if (binding.getBindingType() == null) {
            binding.setBindingType(BindingType.RECOMMENDED);
        }
        if (binding.getScoreWeight() == null) {
            binding.setScoreWeight(50);
        }
        return bindingRepository.save(binding);
    }

    /**
     * 查询检查项的绑定列表。
     */
    @Transactional(readOnly = true)
    public List<CheckItemStandardBinding> listBindings(Long checkItemId) {
        return bindingRepository.findByCheckItemId(checkItemId);
    }

    /**
     * 删除绑定。
     */
    @Transactional
    public void deleteBinding(Long bindingId) {
        CheckItemStandardBinding binding = bindingRepository.findById(bindingId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "绑定不存在: " + bindingId));
        bindingRepository.delete(binding);
    }

    private ProjectInspectionForm requireForm(Long id) {
        return formRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "检查表不存在: " + id));
    }

    private InspectionFormItem requireItem(Long id) {
        return itemRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATA_NOT_FOUND, "检查项不存在: " + id));
    }
}
