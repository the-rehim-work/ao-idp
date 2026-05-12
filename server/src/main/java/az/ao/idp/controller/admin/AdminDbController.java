package az.ao.idp.controller.admin;

import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.sql.ResultSetMetaData;
import java.util.*;

@RestController
@RequestMapping("/admin/api/v1/db")
@Tag(name = "Admin — Database", description = "PostgreSQL table browser and read-only query executor")
@SecurityRequirement(name = "AdminBearerAuth")
@PreAuthorize("hasRole('IDP_ADMIN')")
public class AdminDbController {

    private static final Set<String> ALLOWED_TABLES = Set.of(
            "users", "applications", "admin_users", "audit_logs", "login_attempts",
            "user_app_access", "ldap_server_config", "idp_settings", "sessions",
            "auth_codes", "refresh_tokens", "admin_app_scopes"
    );

    private final JdbcTemplate jdbc;

    public AdminDbController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/tables")
    public ResponseEntity<List<Map<String, Object>>> listTables() {
        String inClause = ALLOWED_TABLES.stream()
                .map(t -> "'" + t + "'")
                .collect(java.util.stream.Collectors.joining(", "));
        String sql = """
            SELECT table_name,
                   (SELECT COUNT(*) FROM information_schema.columns c
                    WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS column_count,
                   pg_total_relation_size(quote_ident(table_name)) AS size_bytes
            FROM information_schema.tables t
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
              AND table_name IN (%s)
            ORDER BY table_name
            """.formatted(inClause);
        List<Map<String, Object>> result = jdbc.queryForList(sql);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/tables/{table}/columns")
    public ResponseEntity<?> tableColumns(@PathVariable String table) {
        if (!ALLOWED_TABLES.contains(table)) return ResponseEntity.status(403).body(Map.of("error", "access_denied"));
        String sql = """
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ?
            ORDER BY ordinal_position
            """;
        return ResponseEntity.ok(jdbc.queryForList(sql, table));
    }

    @GetMapping("/tables/{table}/rows")
    public ResponseEntity<?> tableRows(
            @PathVariable String table,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String orderBy,
            @RequestParam(defaultValue = "DESC") String direction
    ) {
        if (!ALLOWED_TABLES.contains(table)) return ResponseEntity.status(403).body(Map.of("error", "access_denied"));
        int safeSize = Math.min(Math.max(size, 1), 200);
        int offset = page * safeSize;

        String safeTable = "\"" + table.replace("\"", "") + "\"";
        String safeOrder = (orderBy != null && orderBy.matches("[a-zA-Z0-9_]+"))
                ? "\"" + orderBy + "\""
                : "1";
        String safeDir = "ASC".equalsIgnoreCase(direction) ? "ASC" : "DESC";

        String dataSql = "SELECT * FROM " + safeTable + " ORDER BY " + safeOrder + " " + safeDir
                + " LIMIT " + safeSize + " OFFSET " + offset;
        String countSql = "SELECT COUNT(*) FROM " + safeTable;

        List<Map<String, Object>> rows = jdbc.queryForList(dataSql);
        long total = jdbc.queryForObject(countSql, Long.class);
        int totalPages = (int) Math.ceil((double) total / safeSize);

        return ResponseEntity.ok(Map.of(
                "rows", rows,
                "total", total,
                "page", page,
                "size", safeSize,
                "totalPages", totalPages
        ));
    }

    // Columns that are auto-managed by the DB and should not be editable
    private static final Set<String> AUTO_COLUMNS = Set.of("created_at", "updated_at", "last_login_at");

    @PostMapping("/tables/{table}/rows")
    public ResponseEntity<?> insertRow(@PathVariable String table, @RequestBody Map<String, Object> data) {
        if (!ALLOWED_TABLES.contains(table)) return ResponseEntity.status(403).body(Map.of("error", "access_denied"));
        if (data == null || data.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "body is required"));

        List<Map<String, Object>> colMeta = getColumnMeta(table);
        Map<String, String> colTypes = new java.util.LinkedHashMap<>();
        for (Map<String, Object> col : colMeta) colTypes.put((String) col.get("column_name"), (String) col.get("data_type"));

        Map<String, Object> safe = new java.util.LinkedHashMap<>();
        for (Map.Entry<String, Object> e : data.entrySet()) {
            String col = e.getKey();
            if (!colTypes.containsKey(col) || AUTO_COLUMNS.contains(col)) continue;
            Object val = normalizeValue(e.getValue(), colTypes.get(col));
            if (val != null) safe.put(col, val);  // only include non-null for insert
        }
        if (safe.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "no valid columns provided"));

        String cols = safe.keySet().stream().map(c -> "\"" + c + "\"").collect(java.util.stream.Collectors.joining(", "));
        String placeholders = safe.keySet().stream()
                .map(c -> castPlaceholder(colTypes.get(c))).collect(java.util.stream.Collectors.joining(", "));
        String sql = "INSERT INTO \"" + table + "\" (" + cols + ") VALUES (" + placeholders + ")";

        try {
            jdbc.update(sql, safe.values().toArray());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.status(400).body(Map.of("error", rootMessage(e)));
        }
    }

    @PutMapping("/tables/{table}/rows/{id}")
    public ResponseEntity<?> updateRow(@PathVariable String table, @PathVariable String id, @RequestBody Map<String, Object> data) {
        if (!ALLOWED_TABLES.contains(table)) return ResponseEntity.status(403).body(Map.of("error", "access_denied"));
        if (data == null || data.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "body is required"));

        List<Map<String, Object>> colMeta = getColumnMeta(table);
        Map<String, String> colTypes = new java.util.LinkedHashMap<>();
        for (Map<String, Object> col : colMeta) colTypes.put((String) col.get("column_name"), (String) col.get("data_type"));

        Map<String, Object> safe = new java.util.LinkedHashMap<>();
        for (Map.Entry<String, Object> e : data.entrySet()) {
            String col = e.getKey();
            if (col.equals("id") || !colTypes.containsKey(col) || AUTO_COLUMNS.contains(col)) continue;
            safe.put(col, normalizeValue(e.getValue(), colTypes.get(col)));
        }
        if (safe.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "no editable columns provided"));

        String setClauses = safe.entrySet().stream()
                .map(e -> "\"" + e.getKey() + "\" = " + castPlaceholder(colTypes.get(e.getKey())))
                .collect(java.util.stream.Collectors.joining(", "));
        String sql = "UPDATE \"" + table + "\" SET " + setClauses + " WHERE id = ?";

        List<Object> params = new ArrayList<>(safe.values());
        params.add(id);

        try {
            int updated = jdbc.update(sql, params.toArray());
            return updated > 0 ? ResponseEntity.ok(Map.of("success", true))
                    : ResponseEntity.status(404).body(Map.of("error", "row not found"));
        } catch (Exception e) {
            return ResponseEntity.status(400).body(Map.of("error", rootMessage(e)));
        }
    }

    @DeleteMapping("/tables/{table}/rows/{id}")
    public ResponseEntity<?> deleteRow(@PathVariable String table, @PathVariable String id) {
        if (!ALLOWED_TABLES.contains(table)) return ResponseEntity.status(403).body(Map.of("error", "access_denied"));
        String sql = "DELETE FROM \"" + table + "\" WHERE id = ?";
        try {
            int deleted = jdbc.update(sql, id);
            return deleted > 0 ? ResponseEntity.ok(Map.of("success", true))
                    : ResponseEntity.status(404).body(Map.of("error", "row not found"));
        } catch (Exception e) {
            return ResponseEntity.status(400).body(Map.of("error", rootMessage(e)));
        }
    }

    private List<Map<String, Object>> getColumnMeta(String table) {
        String sql = """
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema='public' AND table_name=?
            ORDER BY ordinal_position
            """;
        return jdbc.queryForList(sql, table);
    }

    private List<String> getTableColumns(String table) {
        return getColumnMeta(table).stream()
                .map(m -> (String) m.get("column_name"))
                .toList();
    }

    private String castPlaceholder(String dataType) {
        if (dataType == null) return "?";
        return switch (dataType.toLowerCase()) {
            case "boolean" -> "?::boolean";
            case "integer", "bigint", "smallint" -> "?::bigint";
            case "numeric", "decimal", "real", "double precision" -> "?::numeric";
            case "uuid" -> "?::uuid";
            case "timestamp with time zone", "timestamp without time zone", "date" -> "?::text";
            case "json", "jsonb" -> "?::jsonb";
            default -> "?";
        };
    }

    private Object normalizeValue(Object raw, String dataType) {
        if (raw == null) return null;
        String str = raw instanceof String s ? s.trim() : raw.toString().trim();
        if (str.isEmpty()) return null;
        if (dataType != null) {
            switch (dataType.toLowerCase()) {
                case "boolean" -> { return "true".equalsIgnoreCase(str) || "1".equals(str) || "yes".equalsIgnoreCase(str) ? "true" : "false"; }
                case "integer", "bigint", "smallint" -> { try { return Long.parseLong(str); } catch (NumberFormatException e) { return str; } }
                case "numeric", "decimal", "real", "double precision" -> { try { return new java.math.BigDecimal(str); } catch (NumberFormatException e) { return str; } }
            }
        }
        return str;
    }

    private String rootMessage(Exception e) {
        Throwable t = e;
        while (t.getCause() != null) t = t.getCause();
        return t.getMessage() != null ? t.getMessage() : e.getMessage();
    }

    @PostMapping("/query")
    public ResponseEntity<?> executeQuery(@RequestBody Map<String, String> body) {
        String sql = body.get("sql");
        if (sql == null || sql.isBlank()) return ResponseEntity.badRequest().body(Map.of("error", "sql is required"));

        String trimmed = sql.strip().toUpperCase();
        if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH") && !trimmed.startsWith("EXPLAIN")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only SELECT, WITH, and EXPLAIN queries are allowed"));
        }

        try {
            List<Map<String, Object>> rows = new ArrayList<>();
            List<String> columns = new ArrayList<>();

            jdbc.query(sql + " LIMIT 500", rs -> {
                if (columns.isEmpty()) {
                    ResultSetMetaData meta = rs.getMetaData();
                    for (int i = 1; i <= meta.getColumnCount(); i++) {
                        try { columns.add(meta.getColumnName(i)); } catch (Exception ignored) {}
                    }
                }
                Map<String, Object> row = new LinkedHashMap<>();
                for (String col : columns) {
                    row.put(col, rs.getObject(col));
                }
                rows.add(row);
            });

            return ResponseEntity.ok(Map.of("columns", columns, "rows", rows, "count", rows.size()));
        } catch (Exception e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }
}
