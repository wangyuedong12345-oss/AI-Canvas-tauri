/**
 * nodes/shared/mentionEditorSources — @ 提及候选来源解析。
 * 收集画布上可被引用的生成节点（含上游连线输出）与工作流 IO 节点，
 * 解析出带缩略图、输出类型与自引用标记的提及条目，供提示词编辑器联想补全。
 */
import type { AppState } from '../../../store/useAppStore';
import type { BaseNodeData, NodeType, StoryboardCellOverride, WorkflowIONodeType } from '../../../types';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getCachedVideoPoster } from '../../../services/videoPosterCache';
import { bestNodeThumb } from './mentionEditorDom';

export interface CanvasMentionItem {
  id: string;
  label: string;
  type: NodeType;
  displayId: number | undefined;
  hasOutput: boolean;
  outputType: 'image' | 'video' | 'audio' | 'text';
  thumbnailUrl: string | undefined;
  isSelf: boolean;
}

export interface WorkflowMentionItem {
  id: string;
  label: string;
  _ioNodeId: string;
  _ioType: WorkflowIONodeType;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const IMAGE_URL_RE = /(?:^data:image\/|\.(?:png|jpe?g|webp|gif|bmp|svg)(?:[?#]|$))/i;

function isImageUrl(url?: string): boolean {
  return !!url && IMAGE_URL_RE.test(url);
}

function localAssetUrl(filePath?: string): string | undefined {
  if (!filePath || !IS_TAURI) return undefined;
  try {
    return convertFileSrc(filePath);
  } catch {
    return undefined;
  }
}

function videoPreviewUrl(data: BaseNodeData): string | undefined {
  return stringValue(data.videoUrl)
    || localAssetUrl(stringValue(data.filePath))
    || stringValue(data.thumbnailUrl)
    || stringValue(data.output)
    || stringValue(data.sourceUrl);
}

function videoThumbnailUrl(nodeId: string, data: BaseNodeData): string | undefined {
  const cachedPoster = getCachedVideoPoster(nodeId);
  const explicitThumb = stringValue(data.thumbnailUrl);
  if (cachedPoster) return cachedPoster;
  if (isImageUrl(explicitThumb)) return explicitThumb;
  return videoPreviewUrl(data);
}

export function resolveCanvasMentionNodes(
  nodeId: string | undefined,
  nodes: AppState['nodes'],
  edges: AppState['edges'],
  posterRevision = 0,
): CanvasMentionItem[] {
  void posterRevision;
  if (!nodeId) return [];
  const currentNode = nodes.find((node) => node.id === nodeId);
  const rawSourceIds = new Set(edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source));
  if (currentNode?.parentId) {
    edges.filter((edge) => edge.target === currentNode.parentId)
      .forEach((edge) => rawSourceIds.add(edge.source));
  }

  const sourceNodeIds = new Set<string>();
  for (const sourceId of rawSourceIds) {
    const sourceNode = nodes.find((node) => node.id === sourceId);
    if (sourceNode?.type === 'group') {
      nodes.filter((node) => node.parentId === sourceId)
        .forEach((node) => sourceNodeIds.add(node.id));
    } else {
      sourceNodeIds.add(sourceId);
    }
  }

  const list: CanvasMentionItem[] = nodes
    .filter((node) => node.id !== nodeId && node.type !== 'group' && sourceNodeIds.has(node.id))
    .map((node) => {
      const nodeType = (node.data.type || node.type) as NodeType;
      const isVideoNode = nodeType === 'ai-video' || nodeType === 'source-video' || !!node.data.videoUrl;
      const outputType = node.data.imageUrl ? 'image' : (node.data.videoUrl || isVideoNode) ? 'video' : node.data.audioUrl ? 'audio' : 'text';
      return {
        id: node.id,
        label: (node.data.label as string) || '节点',
        type: nodeType,
        displayId: node.data.displayId as number | undefined,
        hasOutput: !!node.data.output,
        outputType,
        thumbnailUrl: outputType === 'video'
          ? videoThumbnailUrl(node.id, node.data)
          : bestNodeThumb(node.data),
        isSelf: false,
      };
    });

  const expanded: CanvasMentionItem[] = [];
  for (const item of list) {
    expanded.push(item);
    if (item.type !== 'ai-storyboard') continue;
    const storyboard = nodes.find((node) => node.id === item.id);
    if (!storyboard) continue;
    const data = storyboard.data as BaseNodeData;
    const cols = Math.max(1, data.storyboardCols || 3);
    const rows = Math.max(1, data.storyboardRows || 3);
    const extracted = data.storyboardExtracted ?? [];
    const overrides = data.storyboardOverrides ?? [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < cols; column += 1) {
        const index = row * cols + column;
        if (extracted[index] && !overrides[index]) continue;
        expanded.push({
          id: `${item.id}/cell/${index}`,
          label: `${item.label} · 第${row + 1}行${column + 1}列`,
          type: 'ai-image',
          displayId: undefined,
          hasOutput: true,
          outputType: 'image',
          thumbnailUrl: (overrides[index] as StoryboardCellOverride | null)?.url || data.imageUrl,
          isSelf: false,
        });
      }
    }
  }

  if (currentNode && currentNode.type !== 'group') {
    const { output, imageUrl, videoUrl, audioUrl } = currentNode.data;
    const currentNodeType = (currentNode.data.type || currentNode.type) as NodeType;
    const currentIsVideoNode = currentNodeType === 'ai-video' || currentNodeType === 'source-video' || !!videoUrl;
    const currentVideoUrl = videoPreviewUrl(currentNode.data);
    if ((typeof output === 'string' && output.trim()) || imageUrl || videoUrl || audioUrl) {
      expanded.unshift({
        id: currentNode.id,
        label: currentNode.data.label || '节点',
        type: currentNodeType,
        displayId: currentNode.data.displayId,
        hasOutput: true,
        outputType: imageUrl ? 'image' : (videoUrl || currentIsVideoNode) ? 'video' : audioUrl ? 'audio' : 'text',
        thumbnailUrl: (videoUrl || currentIsVideoNode)
          ? videoThumbnailUrl(currentNode.id, currentNode.data)
          : bestNodeThumb(currentNode.data) || currentVideoUrl,
        isSelf: true,
      });
    }
  }
  return expanded;
}

export function resolveWorkflowMentionNodes(
  selectedWorkflowId: string | undefined,
  ioNodes: Array<{ nodeId: string; title: string; type: WorkflowIONodeType }>,
): WorkflowMentionItem[] {
  if (!selectedWorkflowId) return [];
  return ioNodes.map((io) => ({
    id: `wf:${io.nodeId}`,
    label: io.title,
    _ioNodeId: io.nodeId,
    _ioType: io.type,
  }));
}

export function resolveDramaMentionItems(
  dramaAssets: AppState['dramaAssets'],
  query: string,
) {
  const items = [
    ...dramaAssets.characters.map((asset) => ({
      id: asset.id,
      name: asset.name,
      kind: asset.kind as string,
      imageNodeId: asset.imageNodeId,
      imageUrl: asset.imageUrl,
      referenceImages: asset.referenceImages,
    })),
    ...dramaAssets.scenes.map((asset) => ({
      id: asset.id,
      name: asset.name,
      kind: asset.kind as string,
      imageNodeId: asset.imageNodeId,
      imageUrl: asset.imageUrl,
      referenceImages: undefined,
    })),
    ...dramaAssets.props.map((asset) => ({
      id: asset.id,
      name: asset.name,
      kind: asset.kind as string,
      imageNodeId: asset.imageNodeId,
      imageUrl: asset.imageUrl,
      referenceImages: undefined,
    })),
  ];
  if (!query) return items.slice(0, 20);
  const normalizedQuery = query.toLowerCase();
  return items.filter((asset) => asset.name.toLowerCase().includes(normalizedQuery)).slice(0, 20);
}
