#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  GitLabForkSchema,
  GitLabReferenceSchema,
  GitLabRepositorySchema,
  GitLabIssueSchema,
  GitLabMergeRequestSchema,
  GitLabContentSchema,
  GitLabCreateUpdateFileResponseSchema,
  GitLabSearchResponseSchema,
  GitLabTreeSchema,
  GitLabCommitSchema,
  CreateRepositoryOptionsSchema,
  CreateIssueOptionsSchema,
  CreateMergeRequestOptionsSchema,
  CreateBranchOptionsSchema,
  CreateOrUpdateFileSchema,
  SearchRepositoriesSchema,
  CreateRepositorySchema,
  GetFileContentsSchema,
  PushFilesSchema,
  CreateIssueSchema,
  CreateMergeRequestSchema,
  ForkRepositorySchema,
  CreateBranchSchema,
  type GitLabFork,
  type GitLabReference,
  type GitLabRepository,
  type GitLabIssue,
  type GitLabMergeRequest,
  type GitLabContent,
  type GitLabCreateUpdateFileResponse,
  type GitLabSearchResponse,
  type GitLabTree,
  type GitLabCommit,
  type FileOperation,
} from './schemas.js';

// 安全配置處理
const disabledHandlers = (process.env.DISABLED_HANDLERS || '')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);

const allowedReadProjects = (process.env.ALLOWED_READ_PROJECTS || '')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);

// 添加審計日誌功能
function logAudit(operation: string, projectId: string | undefined, allowed: boolean, reason?: string) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    operation,
    projectId: projectId || 'unknown',
    allowed,
    reason
  };
  console.error(`[AUDIT] ${JSON.stringify(logEntry)}`);
}

const server = new Server({
  name: "gitlab-zero-leak-mcp-server",
  version: "1.0.0",
}, {
  capabilities: {
    tools: {}
  }
});

const GITLAB_PERSONAL_ACCESS_TOKEN = process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
const GITLAB_API_URL = process.env.GITLAB_API_URL || 'https://gitlab.com/api/v4';

if (!GITLAB_PERSONAL_ACCESS_TOKEN) {
  console.error("GITLAB_PERSONAL_ACCESS_TOKEN environment variable is not set");
  process.exit(1);
}

// 顯示安全配置信息
console.error(`[CONFIG] Disabled handlers: ${disabledHandlers.length > 0 ? disabledHandlers.join(', ') : 'None'}`);
console.error(`[CONFIG] Allowed read projects: ${allowedReadProjects.length > 0 ? allowedReadProjects.join(', ') : 'None'}`);
console.error(`[CONFIG] GitLab API URL: ${GITLAB_API_URL}`);

async function forkProject(
  projectId: string,
  namespace?: string
): Promise<GitLabFork> {
  const url = `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/fork`;
  const queryParams = namespace ? `?namespace=${encodeURIComponent(namespace)}` : '';

  const response = await fetch(url + queryParams, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${errorText}`);
  }

  return GitLabForkSchema.parse(await response.json());
}

async function createBranch(
  projectId: string,
  options: z.infer<typeof CreateBranchOptionsSchema>
): Promise<GitLabReference> {
  const response = await fetch(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/repository/branches`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        branch: options.name,
        ref: options.ref
      })
    }
  );

  if (!response.ok) {
    try {
      const errorBody = await response.json();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${JSON.stringify(errorBody)}`);
    } catch (parseError) {
      const errorText = await response.text();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${errorText}`);
    }
  }

  return GitLabReferenceSchema.parse(await response.json());
}

async function getDefaultBranchRef(projectId: string): Promise<string> {
  const response = await fetch(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}`,
    {
      headers: {
        "Authorization": `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`
      }
    }
  );

  if (!response.ok) {
    try {
      const errorBody = await response.json();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${JSON.stringify(errorBody)}`);
    } catch (parseError) {
      const errorText = await response.text();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${errorText}`);
    }
  }

  const project = GitLabRepositorySchema.parse(await response.json());
  return project.default_branch;
}

async function getFileContents(
  projectId: string,
  filePath: string,
  ref?: string
): Promise<GitLabContent> {
  const encodedPath = encodeURIComponent(filePath);
  let url = `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/repository/files/${encodedPath}`;
  if (ref) {
    url += `?ref=${encodeURIComponent(ref)}`;
  }

  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`
    }
  });

  if (!response.ok) {
    try {
      const errorBody = await response.json();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${JSON.stringify(errorBody)}`);
    } catch (parseError) {
      const errorText = await response.text();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${errorText}`);
    }
  }

  const data = GitLabContentSchema.parse(await response.json());
  
  if (!Array.isArray(data) && data.content) {
    data.content = Buffer.from(data.content, 'base64').toString('utf8');
  }

  return data;
}

async function createIssue(
  projectId: string,
  options: z.infer<typeof CreateIssueOptionsSchema>
): Promise<GitLabIssue> {
  const response = await fetch(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/issues`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: options.title,
        description: options.description,
        assignee_ids: options.assignee_ids,
        milestone_id: options.milestone_id,
        labels: options.labels?.join(',')
      })
    }
  );

  if (!response.ok) {
    try {
      const errorBody = await response.json();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${JSON.stringify(errorBody)}`);
    } catch (parseError) {
      const errorText = await response.text();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${errorText}`);
    }
  }

  return GitLabIssueSchema.parse(await response.json());
}

async function createMergeRequest(
  projectId: string,
  options: z.infer<typeof CreateMergeRequestOptionsSchema>
): Promise<GitLabMergeRequest> {
  const response = await fetch(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/merge_requests`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: options.title,
        description: options.description,
        source_branch: options.source_branch,
        target_branch: options.target_branch,
        allow_collaboration: options.allow_collaboration,
        draft: options.draft
      })
    }
  );

  if (!response.ok) {
    try {
      const errorBody = await response.json();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${JSON.stringify(errorBody)}`);
    } catch (parseError) {
      const errorText = await response.text();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${errorText}`);
    }
  }

  return GitLabMergeRequestSchema.parse(await response.json());
}

async function createOrUpdateFile(
  projectId: string,
  filePath: string,
  content: string,
  commitMessage: string,
  branch: string,
  previousPath?: string
): Promise<GitLabCreateUpdateFileResponse> {
  const encodedPath = encodeURIComponent(filePath);
  const url = `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/repository/files/${encodedPath}`;

  const body = {
    branch,
    content,
    commit_message: commitMessage,
    ...(previousPath ? { previous_path: previousPath } : {})
  };

  // Check if file exists
  let method = "POST";
  try {
    await getFileContents(projectId, filePath, branch);
    method = "PUT";
  } catch (error) {
    // File doesn't exist, use POST
  }

  const response = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    try {
      const errorBody = await response.json();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${JSON.stringify(errorBody)}`);
    } catch (parseError) {
      const errorText = await response.text();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${errorText}`);
    }
  }

  return GitLabCreateUpdateFileResponseSchema.parse(await response.json());
}

// 未使用的函數，但保留以供將來使用
// @ts-ignore
async function createTree(
  projectId: string,
  files: FileOperation[],
  ref?: string
): Promise<GitLabTree> {
  const response = await fetch(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/repository/tree`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        files: files.map(file => ({
          file_path: file.path,
          content: file.content
        })),
        ...(ref ? { ref } : {})
      })
    }
  );

  if (!response.ok) {
    try {
      const errorBody = await response.json();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${JSON.stringify(errorBody)}`);
    } catch (parseError) {
      const errorText = await response.text();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${errorText}`);
    }
  }

  return GitLabTreeSchema.parse(await response.json());
}

async function createCommit(
  projectId: string,
  message: string,
  branch: string,
  actions: FileOperation[]
): Promise<GitLabCommit> {
  const response = await fetch(
    `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/repository/commits`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        branch,
        commit_message: message,
        actions: actions.map(action => ({
          action: "create",
          file_path: action.path,
          content: action.content
        }))
      })
    }
  );

  if (!response.ok) {
    try {
      const errorBody = await response.json();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${JSON.stringify(errorBody)}`);
    } catch (parseError) {
      const errorText = await response.text();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${errorText}`);
    }
  }

  return GitLabCommitSchema.parse(await response.json());
}

async function searchProjects(
  query: string,
  page: number = 1,
  perPage: number = 20
): Promise<GitLabSearchResponse> {
  const url = new URL(`${GITLAB_API_URL}/projects`);
  url.searchParams.append("search", query);
  url.searchParams.append("page", page.toString());
  url.searchParams.append("per_page", perPage.toString());

  const response = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`
    }
  });

  if (!response.ok) {
    try {
      const errorBody = await response.json();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${JSON.stringify(errorBody)}`);
    } catch (parseError) {
      const errorText = await response.text();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${errorText}`);
    }
  }

  const projects = await response.json();
  return GitLabSearchResponseSchema.parse({
    count: parseInt(response.headers.get("X-Total") || "0"),
    items: projects
  });
}

async function createRepository(
  options: z.infer<typeof CreateRepositoryOptionsSchema>
): Promise<GitLabRepository> {
  const response = await fetch(`${GITLAB_API_URL}/projects`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: options.name,
      description: options.description,
      visibility: options.visibility,
      initialize_with_readme: options.initialize_with_readme
    })
  });

  if (!response.ok) {
    try {
      const errorBody = await response.json();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${JSON.stringify(errorBody)}`);
    } catch (parseError) {
      const errorText = await response.text();
      throw new Error(`GitLab API error: ${response.statusText} (${response.status}) - ${errorText}`);
    }
  }

  return GitLabRepositorySchema.parse(await response.json());
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  // 根據禁用的 handlers 過濾工具列表
  const allTools = [
    {
      name: "create_or_update_file",
      description: "Create or update a single file in a GitLab project",
      inputSchema: zodToJsonSchema(CreateOrUpdateFileSchema)
    },
    {
      name: "search_repositories",
      description: "Search for GitLab projects",
      inputSchema: zodToJsonSchema(SearchRepositoriesSchema)
    },
    {
      name: "create_repository",
      description: "Create a new GitLab project",
      inputSchema: zodToJsonSchema(CreateRepositorySchema)
    },
    {
      name: "get_file_contents",
      description: "Get the contents of a file or directory from a GitLab project",
      inputSchema: zodToJsonSchema(GetFileContentsSchema)
    },
    {
      name: "push_files",
      description: "Push multiple files to a GitLab project in a single commit",
      inputSchema: zodToJsonSchema(PushFilesSchema)
    },
    {
      name: "create_issue",
      description: "Create a new issue in a GitLab project",
      inputSchema: zodToJsonSchema(CreateIssueSchema)
    },
    {
      name: "create_merge_request",
      description: "Create a new merge request in a GitLab project",
      inputSchema: zodToJsonSchema(CreateMergeRequestSchema)
    },
    {
      name: "fork_repository",
      description: "Fork a GitLab project to your account or specified namespace",
      inputSchema: zodToJsonSchema(ForkRepositorySchema)
    },
    {
      name: "create_branch",
      description: "Create a new branch in a GitLab project",
      inputSchema: zodToJsonSchema(CreateBranchSchema)
    }
  ];

  const availableTools = allTools.filter(tool => !disabledHandlers.includes(tool.name));
  
  return {
    tools: availableTools
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (!request.params.arguments) {
      logAudit(request.params.name, undefined, false, 'Missing arguments');
      throw new Error("Arguments are required");
    }

    const opName = request.params.name;
    const args = request.params.arguments;
    // 安全地存取 project_id，處理可能的類型問題
    const projectId = typeof args === 'object' && args !== null && 'project_id' in args 
      ? String(args.project_id) 
      : undefined;

    // 檢查 handler 是否被禁用
    if (disabledHandlers.includes(opName)) {
      logAudit(opName, projectId, false, 'Operation disabled by policy');
      throw new Error(`Tool "${opName}" is disabled by server policy.`);
    }

    // 檢查項目是否在白名單中（對於讀取操作）
    const readOps = ['get_file_contents'];
    if (readOps.includes(opName) && projectId) {
      if (!allowedReadProjects.includes(projectId)) {
        logAudit(opName, projectId, false, 'Project not in allowlist');
        throw new Error(`Project "${projectId}" is not allowed for read operations.`);
      }
      logAudit(opName, projectId, true, 'Project in allowlist');
    }

    // 記錄執行操作
    logAudit(opName, projectId, true, 'Operation permitted');

    switch (request.params.name) {
      case "fork_repository": {
        const args = ForkRepositorySchema.parse(request.params.arguments);
        const fork = await forkProject(args.project_id, args.namespace);
        return { content: [{ type: "text", text: JSON.stringify(fork, null, 2) }] };
      }

      case "create_branch": {
        const args = CreateBranchSchema.parse(request.params.arguments);
        let ref = args.ref;
        if (!ref) {
          ref = await getDefaultBranchRef(args.project_id);
        }

        const branch = await createBranch(args.project_id, {
          name: args.branch,
          ref
        });

        return { content: [{ type: "text", text: JSON.stringify(branch, null, 2) }] };
      }

      case "search_repositories": {
        const args = SearchRepositoriesSchema.parse(request.params.arguments);
        const results = await searchProjects(args.search, args.page, args.per_page);
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      }

      case "create_repository": {
        const args = CreateRepositorySchema.parse(request.params.arguments);
        const repository = await createRepository(args);
        return { content: [{ type: "text", text: JSON.stringify(repository, null, 2) }] };
      }

      case "get_file_contents": {
        const args = GetFileContentsSchema.parse(request.params.arguments);
        const contents = await getFileContents(args.project_id, args.file_path, args.ref);
        return { content: [{ type: "text", text: JSON.stringify(contents, null, 2) }] };
      }

      case "create_or_update_file": {
        const args = CreateOrUpdateFileSchema.parse(request.params.arguments);
        const result = await createOrUpdateFile(
          args.project_id,
          args.file_path,
          args.content,
          args.commit_message,
          args.branch,
          args.previous_path
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "push_files": {
        const args = PushFilesSchema.parse(request.params.arguments);
        const result = await createCommit(
          args.project_id,
          args.commit_message,
          args.branch,
          args.files.map(f => ({ path: f.file_path, content: f.content }))
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "create_issue": {
        const args = CreateIssueSchema.parse(request.params.arguments);
        const { project_id, ...options } = args;
        const issue = await createIssue(project_id, options);
        return { content: [{ type: "text", text: JSON.stringify(issue, null, 2) }] };
      }

      case "create_merge_request": {
        const args = CreateMergeRequestSchema.parse(request.params.arguments);
        const { project_id, ...options } = args;
        const mergeRequest = await createMergeRequest(project_id, options);
        return { content: [{ type: "text", text: JSON.stringify(mergeRequest, null, 2) }] };
      }

      default:
        logAudit(opName, projectId, false, 'Unknown tool');
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    // 統一錯誤處理
    if (error instanceof z.ZodError) {
      const errorMessage = `Invalid arguments: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    // 將 GitLab API 錯誤轉換為更清晰的錯誤消息
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error(`Unknown error: ${String(error)}`);
    }
    
    throw error;
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  
  try {
    console.error("GitLab Zero-Leak MCP Server starting...");
    await server.connect(transport);
    console.error("GitLab Zero-Leak MCP Server running on stdio");
  } catch (error) {
    console.error("Failed to start server:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // 處理進程退出
  process.on('SIGTERM', () => {
    console.error("Server shutting down (SIGTERM)");
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.error("Server shutting down (SIGINT)");
    process.exit(0);
  });
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error instanceof Error ? error.message : String(error));
  process.exit(1);
});