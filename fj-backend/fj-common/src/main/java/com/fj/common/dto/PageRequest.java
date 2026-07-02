package com.fj.common.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 分页请求 DTO（§5.1）。
 * <p>所有列表查询接口继承或组合此对象。
 */
@Data
public class PageRequest implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 默认页码 */
    public static final int DEFAULT_PAGE = 1;

    /** 默认每页大小 */
    public static final int DEFAULT_PAGE_SIZE = 20;

    /** 每页最大条数（防止单次查询过大） */
    public static final int MAX_PAGE_SIZE = 100;

    /** 页码（从 1 开始） */
    @Min(value = 1, message = "页码不能小于 1")
    private Integer page = DEFAULT_PAGE;

    /** 每页大小 */
    @Min(value = 1, message = "每页大小不能小于 1")
    @Max(value = MAX_PAGE_SIZE, message = "每页大小不能超过 " + MAX_PAGE_SIZE)
    private Integer pageSize = DEFAULT_PAGE_SIZE;

    /** 排序字段（可选） */
    private String sortBy;

    /** 排序方向：asc / desc（可选，默认 asc） */
    private String sortOrder = "asc";

    /**
     * 获取计算偏移量。
     *
     * @return OFFSET 值
     */
    public long getOffset() {
        return (long) (page - 1) * pageSize;
    }

    /**
     * 安全化分页参数：null/越界值修正为默认。
     */
    public void normalize() {
        if (page == null || page < 1) {
            page = DEFAULT_PAGE;
        }
        if (pageSize == null || pageSize < 1) {
            pageSize = DEFAULT_PAGE_SIZE;
        }
        if (pageSize > MAX_PAGE_SIZE) {
            pageSize = MAX_PAGE_SIZE;
        }
        if (!"desc".equalsIgnoreCase(sortOrder)) {
            sortOrder = "asc";
        }
    }
}
