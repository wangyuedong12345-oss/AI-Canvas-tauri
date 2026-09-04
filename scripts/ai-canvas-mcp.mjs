#!/usr/bin/env node

import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { LoopbackClient, parseCliArgs, toMcpToolResult } from './ai-canvas-mcp-core.mjs';

export { LoopbackClient, parseCliArgs, toMcpToolResult };

export async function createMcpServer(client) {
  const [
    { Server },
    { CallToolRequestSchema, ListToolsRequestSchema },
  ] = await Promise.all([
    import('@modelcontextprotocol/sdk/server/index.js'),
    import('@modelcontextprotocol/sdk/types.js'),
  ]);
  const server = new Server(
    { name: 'ai-canvas-local-control', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const result = await client.request('tools/list', {});
    return { tools: Array.isArray(result?.tools) ? result.tools : [] };
  });
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    try {
      const result = await client.request('tools/call', {
        name: request.params.name,
        arguments: request.params.arguments ?? {},
      }, { signal: extra.signal });
      return toMcpToolResult(result);
    } catch (error) {
      return toMcpToolResult({
        isError: true,
        summary: error instanceof Error ? error.message : 'AI Canvas MCP 调用失败',
      });
    }
  });
  return server;
}

async function main() {
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const options = parseCliArgs(process.argv.slice(2));
  const client = new LoopbackClient(options);
  // 不预连接：客户端通常开机就拉起本进程，那时 AI Canvas 往往还没启动。
  // request() 自带惰性连接与断线重连，连不上只让当次调用报错，不会让整个 MCP 服务失败退出。
  const server = await createMcpServer(client);
  const transport = new StdioServerTransport();
  const close = () => client.close();
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
  process.once('exit', close);
  await server.connect(transport);
}

const isDirectExecution = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectExecution) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
