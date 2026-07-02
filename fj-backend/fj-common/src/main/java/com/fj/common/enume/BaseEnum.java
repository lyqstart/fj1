package com.fj.common.enume;

/**
 * 枚举基接口（IBaseEnum）。
 * <p>所有业务状态枚举实现此接口，统一通过 code 持久化、通过 description 展示。
 * 避免 ORM 框架将枚举按 name() 序列化导致的重构风险。
 */
public interface BaseEnum {

    /**
     * 获取枚举持久化 code。
     *
     * @return 业务 code（数据库存储值）
     */
    int getCode();

    /**
     * 获取枚举展示描述。
     *
     * @return 中文描述
     */
    String getDescription();

    /**
     * 按 code 查找枚举值。
     *
     * @param enumClass 枚举类型
     * @param code      code 值
     * @param <E>       枚举类型参数
     * @return 匹配的枚举值，未找到返回 null
     */
    static <E extends Enum<E> & BaseEnum> E valueOf(Class<E> enumClass, Integer code) {
        if (code == null) {
            return null;
        }
        E[] constants = enumClass.getEnumConstants();
        if (constants == null) {
            return null;
        }
        for (E e : constants) {
            if (e.getCode() == code) {
                return e;
            }
        }
        return null;
    }
}
