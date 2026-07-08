package com.fj.common.applog.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class LogEntryDTO {
    private String timestamp;   // ISO 8601
    private String level;       // DEBUG / INFO / WARN / ERROR
    private String module;      // e.g. BOOT, DB, AUTH, API
    private String message;
    private Object data;        // optional, any JSON value
}
