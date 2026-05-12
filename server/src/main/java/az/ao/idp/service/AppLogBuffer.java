package az.ao.idp.service;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.AppenderBase;
import jakarta.annotation.PostConstruct;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

@Service
public class AppLogBuffer {

    private static final int MAX_LINES = 2000;
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneOffset.UTC);

    public record LogEntry(String timestamp, String level, String logger, String message) {}

    private final Deque<LogEntry> buffer = new ArrayDeque<>();

    @PostConstruct
    void attach() {
        LoggerContext ctx = (LoggerContext) LoggerFactory.getILoggerFactory();
        Logger root = ctx.getLogger(Logger.ROOT_LOGGER_NAME);

        AppenderBase<ILoggingEvent> appender = new AppenderBase<>() {
            @Override
            protected void append(ILoggingEvent event) {
                if (event.getLevel().isGreaterOrEqual(Level.INFO)) {
                    String shortLogger = event.getLoggerName();
                    int dot = shortLogger.lastIndexOf('.');
                    if (dot >= 0) shortLogger = shortLogger.substring(dot + 1);
                    LogEntry entry = new LogEntry(
                            FMT.format(Instant.ofEpochMilli(event.getTimeStamp())),
                            event.getLevel().toString(),
                            shortLogger,
                            event.getFormattedMessage()
                    );
                    synchronized (buffer) {
                        buffer.addLast(entry);
                        if (buffer.size() > MAX_LINES) buffer.pollFirst();
                    }
                }
            }
        };
        appender.setContext(ctx);
        appender.setName("APP_LOG_BUFFER");
        appender.start();
        root.addAppender(appender);
    }

    public List<LogEntry> getEntries(String search, String level, int limit) {
        List<LogEntry> snapshot;
        synchronized (buffer) {
            snapshot = new ArrayList<>(buffer);
        }
        String searchLower = search != null && !search.isBlank() ? search.toLowerCase() : null;
        String levelUpper = level != null && !level.isBlank() ? level.toUpperCase() : null;

        List<LogEntry> result = new ArrayList<>();
        for (int i = snapshot.size() - 1; i >= 0; i--) {
            LogEntry e = snapshot.get(i);
            if (levelUpper != null && !e.level().equals(levelUpper)) continue;
            if (searchLower != null &&
                    !e.message().toLowerCase().contains(searchLower) &&
                    !e.logger().toLowerCase().contains(searchLower)) continue;
            result.add(e);
            if (result.size() >= limit) break;
        }
        return result;
    }
}
