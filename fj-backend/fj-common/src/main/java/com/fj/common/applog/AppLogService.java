package com.fj.common.applog;

import com.fj.common.applog.dto.LogEntryDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
public class AppLogService {

    private static final String LOG_DIR = "/opt/fj1/api/logs/app-logs";
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /**
     * Write a batch of log entries to the daily log file.
     * One line per entry: "timestamp [LEVEL] [module] message {json_data}"
     */
    public void writeLogs(List<LogEntryDTO> entries) {
        if (entries == null || entries.isEmpty()) {
            return;
        }
        try {
            Path dir = Path.of(LOG_DIR);
            if (!Files.exists(dir)) {
                Files.createDirectories(dir);
            }
            String fileName = "app-" + LocalDate.now().format(DATE_FMT) + ".log";
            Path filePath = dir.resolve(fileName);

            StringBuilder sb = new StringBuilder();
            for (LogEntryDTO entry : entries) {
                sb.append(entry.getTimestamp() != null ? entry.getTimestamp() : "unknown")
                  .append(" [").append(entry.getLevel() != null ? entry.getLevel() : "?").append("]")
                  .append(" [").append(entry.getModule() != null ? entry.getModule() : "?").append("]")
                  .append(" ").append(entry.getMessage() != null ? entry.getMessage() : "")
                  .append(entry.getData() != null ? " " + entry.getData().toString() : "")
                  .append("\n");
            }
            Files.writeString(filePath, sb.toString(),
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            log.debug("Wrote {} log entries to {}", entries.size(), filePath);
        } catch (IOException e) {
            log.error("Failed to write app logs to file: {}", e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error writing app logs: {}", e.getMessage(), e);
        }
    }
}
