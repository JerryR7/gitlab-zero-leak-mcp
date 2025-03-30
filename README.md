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
- ✅ All original GitLab MCP Server features
- ✅ Comprehensive audit logging

## Architecture

### Standard Setup (Local MCP)
```
Claude Desktop
     |
     v
 GitLab Zero-Leak MCP Server (Local)
     |
     v
 GitLab API (self-hosted)
```

## Tools

1. `create_or_update_file`
   - Create or update a single file in a project
   - Inputs:
     - `project_id` (string): Project ID or URL-encoded path
     - `file_path` (string): Path where to create/update the file
     - `content` (string): Content of the file
     - `commit_message` (string): Commit message
     - `branch` (string): Branch to create/update the file in
     - `previous_path` (optional string): Path of the file to move/rename
   - Returns: File content and commit details

2. `push_files`
   - Push multiple files in a single commit
   - Inputs:
     - `project_id` (string): Project ID or URL-encoded path
     - `branch` (string): Branch to push to
     - `files` (array): Files to push, each with `file_path` and `content`
     - `commit_message` (string): Commit message
   - Returns: Updated branch reference

3. `search_repositories`
   - Search for GitLab projects
   - Inputs:
     - `search` (string): Search query
     - `page` (optional number): Page number for pagination
     - `per_page` (optional number): Results per page (default 20)
   - Returns: Project search results

4. `create_repository`
   - Create a new GitLab project
   - Inputs:
     - `name` (string): Project name
     - `description` (optional string): Project description
     - `visibility` (optional string): 'private', 'internal', or 'public'
     - `initialize_with_readme` (optional boolean): Initialize with README
   - Returns: Created project details

5. `get_file_contents`
   - Get contents of a file or directory
   - Inputs:
     - `project_id` (string): Project ID or URL-encoded path
     - `file_path` (string): Path to file/directory
     - `ref` (optional string): Branch/tag/commit to get contents from
   - Returns: File/directory contents
   - **Note**: Disabled by default for security reasons

6. `create_issue`
   - Create a new issue
   - Inputs:
     - `project_id` (string): Project ID or URL-encoded path
     - `title` (string): Issue title
     - `description` (optional string): Issue description
     - `assignee_ids` (optional number[]): User IDs to assign
     - `labels` (optional string[]): Labels to add
     - `milestone_id` (optional number): Milestone ID
   - Returns: Created issue details

7. `create_merge_request`
   - Create a new merge request
   - Inputs:
     - `project_id` (string): Project ID or URL-encoded path
     - `title` (string): MR title
     - `description` (optional string): MR description
     - `source_branch` (string): Branch containing changes
     - `target_branch` (string): Branch to merge into
     - `draft` (optional boolean): Create as draft MR
     - `allow_collaboration` (optional boolean): Allow commits from upstream members
   - Returns: Created merge request details

8. `fork_repository`
   - Fork a project
   - Inputs:
     - `project_id` (string): Project ID or URL-encoded path
     - `namespace` (optional string): Namespace to fork to
   - Returns: Forked project details

9. `create_branch`
   - Create a new branch
   - Inputs:
     - `project_id` (string): Project ID or URL-encoded path
     - `branch` (string): Name for new branch
     - `ref` (optional string): Source branch/commit for new branch
   - Returns: Created branch reference

## Getting Started


### Local Deployment

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/gitlab-zero-leak-mcp.git
   cd gitlab-zero-leak-mcp
   ```

2. Create a `.env` file based on `.env.example`:
   ```bash
   cat > .env << EOF
   GITLAB_PERSONAL_ACCESS_TOKEN=your_token_here
   GITLAB_API_URL=https://gitlab.com/api/v4
   DISABLED_HANDLERS=get_file_contents
   ALLOWED_READ_PROJECTS=your-group/public-repo
   EOF
   ```

3. Run MCP Server using Docker:
   ```bash
   docker build -t gitlab-zero-leak-mcp .
   docker run -i --env-file .env gitlab-zero-leak-mcp
   ```

## Setup

### Personal Access Token
[Create a GitLab Personal Access Token](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html) with appropriate permissions:
   - Go to User Settings > Access Tokens in GitLab
   - Select the required scopes:
     - `api` for full API access
     - `read_api` for read-only access
     - `write_repository` for repository operations
     - Avoid `read_repository` when possible for maximum security
   - Create the token and save it securely

### Usage with Claude Desktop

Add the following to your `claude_desktop_config.json`:

#### Docker
```json
{
  "mcpServers": { 
    "gitlab-zero-leak": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e", "GITLAB_PERSONAL_ACCESS_TOKEN",
        "-e", "GITLAB_API_URL",
        "-e", "DISABLED_HANDLERS",
        "-e", "ALLOWED_READ_PROJECTS",
        "gitlab-zero-leak-mcp"
      ],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "<YOUR_TOKEN>",
        "GITLAB_API_URL": "https://gitlab.com/api/v4",
        "DISABLED_HANDLERS": "get_file_contents",
        "ALLOWED_READ_PROJECTS": "your-org/public-repo,your-org/docs-repo"
      }
    }
  }
}
```

### NPX

```json
{
  "mcpServers": {
    "gitlab-zero-leak": {
      "command": "npx",
      "args": [
        "-y",
        "gitlab-zero-leak-mcp"
      ],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "<YOUR_TOKEN>",
        "GITLAB_API_URL": "https://gitlab.com/api/v4",
        "DISABLED_HANDLERS": "get_file_contents",
        "ALLOWED_READ_PROJECTS": "your-org/public-repo,your-org/docs-repo"
      }
    }
  }
}
```

## Build and Run

### Using Docker Compose

1. Create a `docker-compose.yml` file:
   ```yaml
   version: '3'
   
   services:
     gitlab-mcp:
       build: .
       container_name: gitlab-zero-leak-mcp
       restart: always
       env_file:
         - .env
       ports:
         - "127.0.0.1:8081:3000"  # Only expose to localhost by default
       user: "node"  # Run as non-root user
   ```

2. Create a `.env` file based on `.env.example`:
   ```
   GITLAB_PERSONAL_ACCESS_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
   GITLAB_API_URL=https://gitlab.com/api/v4
   
   # Zero-Leak
   DISABLED_HANDLERS=get_file_contents
   ALLOWED_READ_PROJECTS=my-group/public-repo
   ```

3. Run with Docker Compose:
   ```bash
   docker-compose up -d
   ```

### Manual Docker Build

```bash
docker build -t gitlab-zero-leak-mcp .
docker run -i --env-file .env gitlab-zero-leak-mcp
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| GITLAB_PERSONAL_ACCESS_TOKEN | Your GitLab Token |
| GITLAB_API_URL | Your GitLab API endpoint |
| DISABLED_HANDLERS | Comma-separated disabled operations |
| ALLOWED_READ_PROJECTS | Comma-separated whitelist |

## Security Model
### Threat Model & Mitigations

| Threat                                 | Mitigation                                                                 |
|----------------------------------------|----------------------------------------------------------------------------|
| AI/LLM client accesses source code     | `get_file_contents` handler disabled by default                           |
| Unintended read access to any repo     | Read operations restricted by `ALLOWED_READ_PROJECTS` allowlist           |
| Leaked GitLab token or misuse          | `.env` excluded from version control; recommend least-privilege tokens     |
| External access to MCP Server          | Docker binds only to internal IP (e.g., 192.168.x.x); not exposed publicly |
| Elevated privileges in container       | Dockerfile runs as non-root user                                          |
| Using standard MCP server              | Server-side deployment restricts all MCP access through Zero-Leak instance |
| Misconfigured API tokens               | Recommend tokens without `read_repository` permission                      |

### Recommended Practices

- Use tokens without `read_repository` permission
- Always set `DISABLED_HANDLERS=get_file_contents`
- Carefully manage your `ALLOWED_READ_PROJECTS` list
- Never commit `.env` files to version control
- Use token scopes that exclude admin-level privileges
- Regularly review audit logs for unauthorized access attempts
- Periodically review and rotate API tokens

## Testing

1. Test if handler disabling works:
```bash
echo '{"id":"1","method":"listTools","params":{}}' | GITLAB_PERSONAL_ACCESS_TOKEN=your_token node dist/index.js
# Verify get_file_contents is missing
```

2. Test allowlist restrictions:
```bash
echo '{"id":"2","method":"callTool","params":{"name":"get_file_contents","arguments":{"project_id":"unauthorized-project","file_path":"file.txt"}}}' | DISABLED_HANDLERS="" GITLAB_PERSONAL_ACCESS_TOKEN=your_token node dist/index.js
# Should fail with "not allowed" message
```

3. Test other operations:
```bash
echo '{"id":"3","method":"callTool","params":{"name":"search_repositories","arguments":{"search":"test"}}}' | GITLAB_PERSONAL_ACCESS_TOKEN=your_token node dist/index.js
# Should return search results
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify your Personal Access Token is valid and has appropriate permissions
   - Check for typos in the token

2. **Missing Tools**
   - If tools are missing from the listTools response, verify your `DISABLED_HANDLERS` setting

3. **Permission Denied**
   - Ensure your token has the necessary permissions for the operation
   - Check that projects needing read access are in the `ALLOWED_READ_PROJECTS` list

### Logs

- View Docker logs:
  ```bash
  docker logs gitlab-zero-leak-mcp
  ```

- Check for audit log entries:
  ```bash
  docker logs gitlab-zero-leak-mcp | grep "[AUDIT]"
  ```

## Security Model
See [SECURITY.md](./SECURITY.md) for more detailed security information.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.