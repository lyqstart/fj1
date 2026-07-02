package com.fj.system.entity;

import com.fj.common.enume.BaseEnum;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * UserStatus <-> SMALLINT JPA 转换器。
 * <p>持久化按 {@link BaseEnum#getCode()} 存储，读取时按 code 还原枚举。
 */
@Converter
public class UserStatusConverter implements AttributeConverter<UserStatus, Integer> {

    @Override
    public Integer convertToDatabaseColumn(UserStatus attribute) {
        return attribute == null ? null : attribute.getCode();
    }

    @Override
    public UserStatus convertToEntityAttribute(Integer dbData) {
        return BaseEnum.valueOf(UserStatus.class, dbData);
    }
}
