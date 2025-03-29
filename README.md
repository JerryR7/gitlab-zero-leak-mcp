# GitLab Zero-Leak MCP Server

[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-orange)]()

A security-hardened GitLab API MCP Server with zero source code leakage risk. Built for self-hosted use with Claude Desktop or other LLM-based agents.

## Features
- ❌ Disables all source-reading operations (e.g., `get_file_contents`)
- ✅ Zero-read default policy
- ✅ Env-based handler control via `.env`
- ✅ Project-level allowlist for read access
- ✅ Dockerized & Self-hostable
- ✅ Claude/Desktop compatible MCP Server implementation

## Architecture

```
Claude Desktop
     |
     v
 GitLab MCP Server (Zero-Leak)
     |
     v
 GitLab API (self-hosted)
```

## Getting Started

1. Clone this repository
2. Create a `.env` file based on `.env.example`
3. Run MCP Server using Docker:

```bash
docker-compose up --build -d
```

4. Configure Claude Desktop to connect to:
```
http://<your-ip>:8081
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| GITLAB_PERSONAL_ACCESS_TOKEN | Your GitLab Token |
| GITLAB_API_URL | Your GitLab API endpoint |
| DISABLED_HANDLERS | Comma-separated disabled operations |
| ALLOWED_READ_PROJECTS | Comma-separated whitelist |

## Security Model
See [SECURITY.md](./SECURITY.md)

## License
MIT

