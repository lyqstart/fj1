package com.fj.common.applog.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class LogBatchRequest {
    private List<LogEntryDTO> entries;
}
