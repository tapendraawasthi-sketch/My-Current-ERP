# Security Review (Phase 8)

Generated: 2026-07-14T06:59:25+00:00

Knowledge content is untrusted data. Retrieved records must never become system instructions.

- **ZIP_TRAVERSAL** (mitigated): validate_kb_package blocks path traversal, absolute, drive-letter, symlink, executables.
- **FTS_INJECTION** (mitigated): Runtime sanitizes FTS queries to alphanumeric/Devanagari tokens.
- **PROMPT_INJECTION_IN_KB** (mitigated_partial): Retrieved records treated as untrusted data; never system instructions; label heuristics applied.
- **EVAL_LEAKAGE** (mitigated): eval_fts separated; production search uses prod_fts only.
- **KB_POSTING_AUTHORITY** (mitigated): Adapter execution_allowed always False; ERP services remain authority.
- **SECRET_LOGGING** (mitigated_partial): Observability logs record IDs/latencies; avoids logging full payroll/secrets by design.
- **CROSS_TENANT_CACHE** (mitigated): Adapter does not implement cross-tenant cache keys.
