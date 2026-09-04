import { describe, expect, it } from 'vitest';
// MCP 适配器核心脚本是直接由 Node 执行的 ESM，不参与应用 TypeScript 构建。
// @ts-expect-error JavaScript MCP 适配器核心没有独立声明文件
import { toMcpToolResult } from '../../../scripts/ai-canvas-mcp-core.mjs';

describe('MCP image result adapter', () => {
  it('preserves image content returned by AI Canvas', () => {
    expect(toMcpToolResult({
      isError: false,
      content: [{ type: 'image', data: 'YWJj', mimeType: 'image/jpeg' }],
    })).toEqual({
      isError: false,
      content: [{ type: 'image', data: 'YWJj', mimeType: 'image/jpeg' }],
    });
  });
});
