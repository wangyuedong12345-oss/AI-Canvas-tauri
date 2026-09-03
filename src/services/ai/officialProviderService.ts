import type {
  ApiProviderConfig,
  GeneralModelCategory,
  ProviderModelSelection,
} from '../../types';
import { corsSafeFetch } from './httpTransport';

export const OFFICIAL_PROVIDER_ID = 'zeroframe-official';
export const OFFICIAL_PROVIDER_NAME = '官方接口';
export const OFFICIAL_PROVIDER_BADGE = 'ZF';
export const OFFICIAL_MODELS_PATH = '/api/zeroframe/models';
export const OFFICIAL_DEV_ORIGIN = 'https://daifly-test.cdyxi.com';
export const OFFICIAL_DEV_BASE_URL = `${OFFICIAL_DEV_ORIGIN}/v1`;
export const OFFICIAL_REGISTER_URL = import.meta.env.VITE_ZEROFRAME_REGISTER_URL
  || (import.meta.env.DEV ? OFFICIAL_DEV_ORIGIN : '');
export const OFFICIAL_BASE_URL = import.meta.env.VITE_ZEROFRAME_API_BASE_URL
  || (import.meta.env.DEV ? OFFICIAL_DEV_BASE_URL : '');
const OFFICIAL_ORIGIN_URL = import.meta.env.VITE_ZEROFRAME_ORIGIN_URL
  || OFFICIAL_REGISTER_URL
  || OFFICIAL_BASE_URL.replace(/\/v1\/?$/, '');

export type OfficialProviderStatus =
  | 'unconfigured'
  | 'syncing'
  | 'connected'
  | 'failed'
  | 'unavailable';

export interface OfficialSyncResult {
  models: ProviderModelSelection[];
  skippedCount: number;
  totalCount: number;
}

interface OfficialModelPayload {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  aiCanvas?: unknown;
}

const MODEL_TYPES: GeneralModelCategory[] = ['text', 'image', 'video', 'audio'];

export function isOfficialProviderId(providerId: string | undefined): boolean {
  return providerId === OFFICIAL_PROVIDER_ID;
}

export function isOfficialProviderConfigured(config?: ApiProviderConfig): boolean {
  return !!config?.apiKey?.trim();
}

export function isOfficialProviderAvailable(): boolean {
  return Boolean(OFFICIAL_BASE_URL.trim() && OFFICIAL_REGISTER_URL.trim() && OFFICIAL_ORIGIN_URL.trim());
}

export function officialProviderBaseUrl(): string {
  return OFFICIAL_BASE_URL.replace(/\/+$/, '');
}

export function officialProviderRegisterUrl(): string {
  return OFFICIAL_REGISTER_URL;
}

export function officialProviderOriginUrl(): string {
  return OFFICIAL_ORIGIN_URL.replace(/\/+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readPayloadModels(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.models)) return payload.models;
  return [];
}

function parseOfficialModel(item: unknown): ProviderModelSelection | null {
  if (!isRecord(item)) return null;
  const payload = item as OfficialModelPayload;
  if (typeof payload.id !== 'string' || !payload.id.trim()) return null;
  if (typeof payload.type !== 'string' || !MODEL_TYPES.includes(payload.type as GeneralModelCategory)) {
    return null;
  }

  const id = payload.id.trim();
  const aiCanvas = isRecord(payload.aiCanvas) ? payload.aiCanvas : {};
  return {
    id,
    name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : id,
    category: payload.type as GeneralModelCategory,
    provider: OFFICIAL_PROVIDER_ID,
    description: typeof aiCanvas.description === 'string' ? aiCanvas.description : undefined,
    inputModalities: Array.isArray(aiCanvas.inputModalities)
      ? aiCanvas.inputModalities.filter((item): item is 'text' | 'image' => item === 'text' || item === 'image')
      : undefined,
    contextWindow: typeof aiCanvas.contextWindow === 'number' ? aiCanvas.contextWindow : undefined,
    executionProfile: isRecord(aiCanvas.executionProfile)
      ? aiCanvas.executionProfile as unknown as ProviderModelSelection['executionProfile']
      : undefined,
    imageReferenceRequestMode:
      aiCanvas.imageReferenceRequestMode === 'generation-json-image-urls'
      || aiCanvas.imageReferenceRequestMode === 'generation-json-image-data-urls'
      || aiCanvas.imageReferenceRequestMode === 'edits-multipart'
        ? aiCanvas.imageReferenceRequestMode
        : undefined,
    videoCapability: isRecord(aiCanvas.videoCapability)
      ? aiCanvas.videoCapability as ProviderModelSelection['videoCapability']
      : undefined,
  };
}

export function parseOfficialModels(payload: unknown): OfficialSyncResult {
  const unique = new Map<string, ProviderModelSelection>();
  const items = readPayloadModels(payload);
  let skippedCount = 0;
  for (const item of items) {
    const model = parseOfficialModel(item);
    if (!model) {
      skippedCount += 1;
      continue;
    }
    if (!unique.has(model.id)) unique.set(model.id, model);
  }
  return { models: [...unique.values()], skippedCount, totalCount: items.length };
}

export function mergeOfficialModels(
  incoming: ProviderModelSelection[],
  previousSelected: ProviderModelSelection[] | undefined,
  hiddenModelIds: string[] | undefined = [],
): ProviderModelSelection[] {
  const previousById = new Map((previousSelected ?? []).map((model) => [model.id, model]));
  const hidden = new Set(hiddenModelIds);
  return incoming.filter((model) => !hidden.has(model.id)).map((model) => {
    const previous = previousById.get(model.id);
    return previous
      ? {
          ...model,
          descriptionManual: previous.descriptionManual,
          inputModalitiesManual: previous.inputModalitiesManual,
          categoryManual: previous.categoryManual,
        }
      : model;
  });
}

export async function fetchOfficialModels(apiKey: string, signal?: AbortSignal): Promise<OfficialSyncResult> {
  const baseUrl = officialProviderOriginUrl();
  if (!baseUrl) throw new Error('官方渠道配置缺失');
  const response = await corsSafeFetch(`${baseUrl}${OFFICIAL_MODELS_PATH}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    signal,
  });
  if (!response.ok) throw new Error(`模型同步失败 (HTTP ${response.status})`);
  const payload = await response.json().catch(() => {
    throw new Error('模型同步失败：响应不是 JSON');
  });
  const result = parseOfficialModels(payload);
  if (result.totalCount > 0 && result.models.length === 0) {
    throw new Error('模型同步失败：模型清单格式不兼容');
  }
  return result;
}
