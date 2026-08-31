import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  OFFICIAL_MODELS_PATH,
  OFFICIAL_PROVIDER_ID,
  fetchOfficialModels,
  mergeOfficialModels,
  parseOfficialModels,
} from '../../src/services/ai/officialProviderService';
import type { ProviderModelSelection } from '../../src/types';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('officialProviderService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('解析官方模型清单并跳过无效条目', () => {
    const result = parseOfficialModels({
      data: [
        {
          id: 'DeepSeek-V4-flash',
          name: 'DeepSeek V4 Flash',
          type: 'text',
          aiCanvas: {
            description: '文本模型',
            contextWindow: 128000,
            inputModalities: ['text'],
          },
        },
        { id: '', name: 'bad', type: 'text' },
        { id: 'unknown', name: 'bad', type: 'other' },
      ],
    });

    expect(result.totalCount).toBe(3);
    expect(result.skippedCount).toBe(2);
    expect(result.models).toEqual([
      expect.objectContaining({
        id: 'DeepSeek-V4-flash',
        name: 'DeepSeek V4 Flash',
        category: 'text',
        provider: OFFICIAL_PROVIDER_ID,
        contextWindow: 128000,
        inputModalities: ['text'],
      }),
    ]);
  });

  it('同步时保留用户手动关闭的官方模型', () => {
    const incoming: ProviderModelSelection[] = [
      { id: 'text-1', name: 'Text 1', category: 'text', provider: OFFICIAL_PROVIDER_ID },
      { id: 'image-1', name: 'Image 1', category: 'image', provider: OFFICIAL_PROVIDER_ID },
      { id: 'video-new', name: 'Video New', category: 'video', provider: OFFICIAL_PROVIDER_ID },
    ];
    const previousSelected: ProviderModelSelection[] = [
      {
        id: 'text-1',
        name: 'Old Text',
        category: 'text',
        provider: OFFICIAL_PROVIDER_ID,
        descriptionManual: true,
      },
    ];

    const merged = mergeOfficialModels(incoming, previousSelected, ['image-1']);

    expect(merged.map((model) => model.id)).toEqual(['text-1', 'video-new']);
    expect(merged[0]?.descriptionManual).toBe(true);
  });

  it('拉取模型时使用官方端点和 Bearer Key', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      data: [{ id: 'DeepSeek-V4-flash', name: 'DeepSeek', type: 'text' }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchOfficialModels('zf-key');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(OFFICIAL_MODELS_PATH),
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer zf-key' },
      }),
    );
    expect(result.models).toHaveLength(1);
  });

  it('官方端点返回全无效模型时报告格式不兼容', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      data: [{ id: '', name: 'bad', type: 'text' }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchOfficialModels('zf-key')).rejects.toThrow('模型清单格式不兼容');
  });
});
