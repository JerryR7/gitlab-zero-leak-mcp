# Security Policy - GitLab Zero-Leak MCP Server

## Objective
To prevent all possible unintentional or unauthorized source code exposure through MCP Server integrations.

## Threat Model & Mitigations

| Threat                                 | Mitigation                                                                 |
|----------------------------------------|----------------------------------------------------------------------------|
| AI/LLM client accesses source code     | `get_file_contents` handler disabled by default                           |
| Unintended read access to any repo     | Read operations restricted by `ALLOWED_READ_PROJECTS` allowlist           |
| Leaked GitLab token or misuse          | `.env` excluded from version control; recommend least-privilege tokens     |
| External access to MCP Server          | Docker binds only to internal IP (e.g., 192.168.x.x); not exposed publicly |
| Elevated privileges in container       | Dockerfile runs as non-root user                                          |

## Recommended Practices

- Only run within secured network (e.g., LAN/VPN)
- Use firewalls to limit access to MCP port (8081)
- Never commit `.env` files to version control
- Use token scopes that exclude admin-level privileges
- Optional: add audit logging in `index.ts` to trace usage

## Future Enhancements (Optional)

- mTLS authentication between Claude and MCP Server
- Add `AUDIT_LOG_ENABLED` toggle
- Integration with log aggregation (ELK, Loki, etc.)