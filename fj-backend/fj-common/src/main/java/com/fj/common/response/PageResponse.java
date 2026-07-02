package com.fj.common.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serial;
import java.io.Serializable;
import java.util.List;

/**
 * 分页响应体（§5.1 契约规范）。
 * <pre>
 * { "items": [...], "total": 100, "page": 1, "page_size": 20 }
 * </pre>
 *
 * @param <T> 列表元素类型
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PageResponse<T> implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 当前页数据列表 */
    private List<T> items;

    /** 总记录数 */
    private long total;

    /** 当前页码（从 1 开始） */
    private int page;

    /** 每页大小 */
    private int pageSize;

    /** 构造分页响应 */
    public static <T> PageResponse<T> of(List<T> items, long total, int page, int pageSize) {
        return new PageResponse<>(items, total, page, pageSize);
    }

    /** 总页数 */
    public int getTotalPages() {
        if (pageSize <= 0) {
            return 0;
        }
        return (int) Math.ceil((double) total / pageSize);
    }
}
