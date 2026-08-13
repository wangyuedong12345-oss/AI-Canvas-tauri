/**
 * Canvas 閻㈣绔锋稉鑽ょ矋娴?閳?React Flow 閻㈣绔烽弽绋跨妇閿涘瞼顓搁悶鍡氬Ν閻?鏉堣瑕嗛弻鎾扁偓浣瑰珛閺€淇扁偓浣界箾缁捐￥鈧礁褰搁柨顔垮綅閸楁洏鈧胶鈹栭悩鑸碘偓?
 */
import { lazy, Suspense, useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ReactFlow,
  Background,
  MiniMap,
  BackgroundVariant,
  ConnectionMode,
  SelectionMode,
  PanOnScrollMode,
  useReactFlow,
  useViewport,
  useUpdateNodeInternals,
  ReactFlowProvider,
  Panel,
  applyNodeChanges,
  type OnSelectionChangeParams,
  type NodeChange,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import TextNode from './nodes/TextNode';
import ImageNode from './nodes/ImageNode';
import VideoNode from './nodes/VideoNode';
import AudioNode from './nodes/AudioNode';
import AnimationNode from './nodes/AnimationNode';
import MarkdownNode from './nodes/MarkdownNode';
import StoryboardNode from './nodes/StoryboardNode';
import ShotlistNode from './nodes/ShotlistNode';
import GroupNode from './nodes/GroupNode';
import CanvasNoteNode from './noteNodes/CanvasNoteNode';
import PluginNode from './nodes/PluginNode';
import NodeRenderBoundary from './nodes/shared/NodeRenderBoundary';
import { isEditableTarget } from '../utils/textSelection';
import ConnectionMenu from './canvas/ConnectionMenu';
import CanvasContextMenu from './canvas/CanvasContextMenu';
import NodeContextMenu from './canvas/NodeContextMenu';
import CanvasToolbar from './canvas/CanvasToolbar';
import CanvasDrawingToolbar from './canvas/CanvasDrawingToolbar';
import CanvasNoteStylePanel from './canvas/CanvasNoteStylePanel';
import RoundedMiniMapMask from './canvas/RoundedMiniMapMask';
import MultiSelectToolbar from './canvas/MultiSelectToolbar';
import CanvasEmptyState from './canvas/CanvasEmptyState';
import HistoryTimelinePanel from './canvas/HistoryTimelinePanel';
import ScissorHoverEdge from './canvas/ScissorHoverEdge';
import CanvasRadialMenu, { CanvasLongPressIndicator } from './canvas/CanvasRadialMenu';
import { useConnectionDropMenu } from '../hooks/useConnectionDropMenu';
import { useCanvasContextMenu } from '../hooks/useCanvasContextMenu';
import { useNodeContextMenu } from '../hooks/useNodeContextMenu';
import { useCanvasSecondaryClickMenu } from '../hooks/useCanvasSecondaryClickMenu';
import { useCanvasLongPressRadialMenu } from '../hooks/useCanvasLongPressRadialMenu';
import { useAppStore } from '../store/useAppStore';
import { filterHiddenCanvasElements, isCanvasConnectionValid } from '../store/store.nodes';
import { useNodeCreation } from '../hooks/useNodeCreation';
import { useCanvasDrawing } from '../hooks/useCanvasDrawing';
import type { BaseNodeData } from '../types';
import { SHOTLIST_FRAME_SOURCE_TYPES, STORYBOARD_CELL_SOURCE_TYPES } from '../types';
import type { Node as RFNode, NodeProps, NodeTypes, OnMove } from '@xyflow/react';
import { useNodeSnap, ResizeSnapContext, type SnapLine } from '../hooks/useNodeSnap';
import { setCanvasPointerPosition } from '../services/canvasPointerService';
import {
  CANVAS_PAN_BY_EVENT,
  CANVAS_PAN_DURATION_MS,
  registerCanvasViewportController,
  type CanvasPanByDetail,
} from '../services/canvasViewportService';

// 閹虫帒濮炴潪鏂ょ窗閸忋劍娅欓懞鍌滃仯瀵洖鍙?three閿涘牅缍嬬粔顖氥亣閹村嚖绱氶敍宀€鏁剧敮鍐х瑐閸戣櫣骞囬崗銊︽珯閼哄倻鍋ｉ弮鑸靛閸旂姾娴?
const PanoramaNodeLazy = lazy(() => import('./nodes/PanoramaNode'));
function PanoramaNode(props: { id: string; data: BaseNodeData; selected?: boolean }) {
  return <Suspense fallback={null}><PanoramaNodeLazy {...props} /></Suspense>;
}

// 閹虫帒濮炴潪鏂ょ窗3D 鐎靛吋绱ㄩ崣鎷屽Ν閻愯瀵滈棁鈧潻鐐村复閺堫剙婀?Tauri 閻欘剛鐝涚粣妤€褰?
const DirectorDeskNodeLazy = lazy(() => import('./nodes/DirectorDeskNode'));
function DirectorDeskNode(props: { id: string; data: BaseNodeData; selected?: boolean }) {
  return <Suspense fallback={null}><DirectorDeskNodeLazy {...props} /></Suspense>;
}

const CharacterAssetDialog = lazy(() => import('./CharacterAssetDialog'));

// 閳光偓閳光偓 Node types mapping 閳光偓閳光偓
/**
 * 缂佹瑦鐦℃稉顏囧Ν閻愬湱绮嶆禒璺哄瘶娑撯偓鐏炲倿鏁婄拠顖濈珶閻ｅ矉绱伴崡鏇氶嚋閼哄倻鍋ｅ〒鍙夌厠閹舵盯鏁婇敍鍫ｅ壈閺佺増宓侀妴浣割嚤閸忋儲鏋冩禒韬测偓浣规＋閻楀牐绺肩粔缁樼暙閻ｆ瑱绱?
 * 閸欘亪妾风痪褎鍨氭稉鈧鐘插窗娴ｅ秴宕遍敍宀€鏁剧敮鍐ㄥ従娴ｆ瑩鍎撮崚鍡欐埛缂侇厼褰查悽銊ｂ偓?
 * 閸欘亜婀Ο鈥虫健妞よ泛鐪扮拫鍐暏娑撯偓濞?閳ユ柡鈧?React Flow 鐟曚焦鐪?nodeTypes 娑撳骸鍙炬稉顓犳畱缂佸嫪娆㈤煬顐″敜娣囨繃瀵旂粙鍐茬暰閵?
 */
function withNodeRenderBoundaries(types: NodeTypes): NodeTypes {
  return Object.fromEntries(Object.entries(types).map(([typeName, NodeComponent]) => {
    const Bounded = (props: NodeProps) => (
      <NodeRenderBoundary nodeId={props.id} typeName={typeName} data={props.data}>
        <NodeComponent {...props} />
      </NodeRenderBoundary>
    );
    Bounded.displayName = `NodeBoundary(${typeName})`;
    return [typeName, Bounded] as const;
  }));
}

const nodeTypes: NodeTypes = withNodeRenderBoundaries({
  'ai-text': TextNode,
  'ai-image': ImageNode,
  'ai-video': VideoNode,
  'ai-audio': AudioNode,
  'ai-animation': AnimationNode,
  'ai-panorama': PanoramaNode,
  'ai-markdown': MarkdownNode,
  'ai-storyboard': StoryboardNode,
  'ai-shotlist': ShotlistNode,
  'ai-director': DirectorDeskNode,
  'source-text': TextNode,
  'source-image': ImageNode,
  'source-video': VideoNode,
  'source-audio': AudioNode,
  comment: TextNode,
  group: GroupNode,
  'canvas-note': CanvasNoteNode,
  'plugin-node': PluginNode,
});

const edgeTypes: EdgeTypes = {
    'scissor-hover': ScissorHoverEdge,
};

// 閳光偓閳光偓 Stable ReactFlow props (hoisted to avoid new identities every render,
//    which makes React Flow re-run internal effects and drop frames on drag) 閳光偓閳光偓
const FIT_VIEW_OPTIONS = { padding: 0.2, maxZoom: 1 };
const PRO_OPTIONS = { hideAttribution: true };
const PAN_ON_DRAG_DEFAULT = [1, 2]; // 默认交互：右键(2) + 中键(1) 拖拽平移
const PAN_ON_DRAG_CLASSIC = [0];    // 传统交互：左键(0) 拖拽平移
const DEFAULT_EDGE_STYLE: { stroke: string; strokeWidth: number } = { stroke: 'var(--canvas-edge)', strokeWidth: 1.5 };
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
const isMacOS = typeof navigator !== 'undefined'
  && /Macintosh|Mac OS X/.test(navigator.userAgent);
const shouldUseMacTrackpadPan = isTauri && isMacOS;
const easeOutCubic = (progress: number) => 1 - (1 - progress) ** 3;
const CANVAS_INTERACTING_CLASS = 'canvas-interacting';
const NODE_TOOLBAR_MIN_SCREEN_SCALE = 0.8;
const NODE_TOOLBAR_MAX_SCREEN_SCALE = 1.25;
const NODE_TOOLBAR_SCALE_EPSILON = 0.0005;

// 閳光偓閳光偓 娴溿倓绨板Ο鈥崇础妫板嫯顔曢敍鍫濆枙缂佹挸顕挒鈽呯礉闁灝鍘ゅВ蹇旑偧 render 娴溠呮晸閺傛媽闊╂禒鏂ょ礉鐎佃壈鍤?React Flow 閸愬懘鍎?effect 闁插秷绐囬妴浣瑰珛閹疯姤甯€鐢嶇礆閳光偓閳光偓
const DEFAULT_INTERACTION = Object.freeze({
  panOnScroll: shouldUseMacTrackpadPan,
  zoomOnScroll: !shouldUseMacTrackpadPan,
  zoomOnPinch: true,
  panOnDrag: PAN_ON_DRAG_DEFAULT,
  selectionOnDrag: true,
  selectionMode: SelectionMode.Partial,
  multiSelectionKeyCode: 'Shift',
  deleteKeyCode: null,
});

const CLASSIC_INTERACTION = Object.freeze({
  panOnScroll: true,
  panOnScrollMode: PanOnScrollMode.Free, // Free 閹靛秷鍏橀崗濂搞€?Shift+濠婃俺鐤嗗鏉戦挬楠炲磭些娑撳孩娅橀柅姘泊鏉烆喖鐎惄鏉戦挬缁?
  panOnScrollSpeed: 0.5,
  zoomOnScroll: false,
  zoomOnPinch: true,
  zoomOnDoubleClick: false, // 閸忔娊妫撮崣灞藉毊缂傗晜鏂侀敍宀勪缉閸忓秳绗岄妴灞藉蓟閸戣崵鈹栭惂钘夊灡瀵ょ儤鏋冮張顒冨Ν閻愬箍鈧秴鍟跨粣?
  zoomActivationKeyCode: 'Control', // Ctrl+濠婃俺鐤嗙紓鈺傛杹
  panOnDrag: PAN_ON_DRAG_CLASSIC,
  selectionOnDrag: false,
  selectionKeyCode: 'Shift', // Shift+瀹革箓鏁幏鏍ㄥ 閳?濡楀棝鈧?
  multiSelectionKeyCode: 'Shift',
  selectionMode: SelectionMode.Partial,
  deleteKeyCode: null,
});
const MINIMAP_STYLE = {
  width: 180,
  height: 120,
  border: '1px solid var(--theme-border)',
  borderRadius: '8px',
};
const INLINE_EDIT_DOUBLE_CLICK_DELAY_MS = 280;
const minimapNodeColor = (node: RFNode) => {
  switch (node.type) {
    case 'ai-text':
    case 'source-text':
    case 'comment': return 'color-mix(in srgb, var(--node-text-light) 50%, transparent)';
    case 'ai-image':
    case 'source-image':
    case 'ai-storyboard': return 'color-mix(in srgb, var(--node-image-light) 50%, transparent)';
    case 'ai-video':
    case 'source-video': return 'color-mix(in srgb, var(--node-video-light) 50%, transparent)';
    case 'ai-audio':
    case 'source-audio': return 'color-mix(in srgb, var(--node-audio-light) 50%, transparent)';
    case 'ai-animation': return 'color-mix(in srgb, var(--brand) 50%, transparent)';
    case 'ai-panorama': return 'color-mix(in srgb, var(--node-panorama) 50%, transparent)';
    case 'ai-markdown': return 'color-mix(in srgb, var(--node-markdown-light) 50%, transparent)';
    case 'ai-director': return 'color-mix(in srgb, #a78bfa 50%, transparent)';
    case 'ai-shotlist': return 'color-mix(in srgb, #fbbf24 50%, transparent)';
    case 'canvas-note': return 'color-mix(in srgb, var(--brand-light) 55%, transparent)';
    case 'group': return '#4b556380';
    default: return '#6b728080';
  }
};

// 閳光偓閳光偓 Snap lines overlay 閳光偓閳光偓
type SpacingSnapLine = Extract<SnapLine, { kind: 'spacing' }>;

function formatSpacingDistance(distance: number): string {
  return Number.isInteger(distance) ? String(distance) : distance.toFixed(1);
}

function SpacingGuideMarks({ line, index }: { line: SpacingSnapLine; index: number }) {
  const label = formatSpacingDistance(line.distance);
  return (
    <g key={`spacing-${line.type}-${index}`}>
      {line.segments.map((segment, segmentIndex) => {
        const middle = (segment.start + segment.end) / 2;
        return line.type === 'horizontal' ? (
          <g key={`horizontal-gap-${segmentIndex}`}>
            <line
              x1={segment.start}
              y1={line.crossPosition}
              x2={segment.end}
              y2={line.crossPosition}
              stroke="var(--brand)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={segment.start}
              y1={line.crossPosition - 4}
              x2={segment.start}
              y2={line.crossPosition + 4}
              stroke="var(--brand)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={segment.end}
              y1={line.crossPosition - 4}
              x2={segment.end}
              y2={line.crossPosition + 4}
              stroke="var(--brand)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={middle}
              y={line.crossPosition - 6}
              fill="var(--brand)"
              stroke="var(--theme-bg)"
              strokeWidth={3}
              paintOrder="stroke"
              fontSize={11}
              fontWeight={600}
              textAnchor="middle"
            >
              {label}
            </text>
          </g>
        ) : (
          <g key={`vertical-gap-${segmentIndex}`}>
            <line
              x1={line.crossPosition}
              y1={segment.start}
              x2={line.crossPosition}
              y2={segment.end}
              stroke="var(--brand)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={line.crossPosition - 4}
              y1={segment.start}
              x2={line.crossPosition + 4}
              y2={segment.start}
              stroke="var(--brand)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={line.crossPosition - 4}
              y1={segment.end}
              x2={line.crossPosition + 4}
              y2={segment.end}
              stroke="var(--brand)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={line.crossPosition - 6}
              y={middle}
              fill="var(--brand)"
              stroke="var(--theme-bg)"
              strokeWidth={3}
              paintOrder="stroke"
              fontSize={11}
              fontWeight={600}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function SnapLinesOverlay({ lines }: { lines: SnapLine[] }) {
  const { x, y, zoom } = useViewport();
  if (lines.length === 0) return null;
  return (
    <div
      className="pointer-events-none"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 999,
        transform: `translate(${x}px, ${y}px) scale(${zoom})`,
        transformOrigin: '0 0',
      }}
    >
      <svg
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1,
          height: 1,
          overflow: 'visible',
        }}
      >
        {lines.map((line, i) => {
          if (line.kind === 'spacing') {
            return <SpacingGuideMarks key={`spacing-${line.type}-${i}`} line={line} index={i} />;
          }
          return line.type === 'horizontal' ? (
            <line
              key={`h-${i}`}
              x1={-99999}
              y1={line.position}
              x2={99999}
              y2={line.position}
              stroke="var(--brand)"
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.7}
            />
          ) : (
            <line
              key={`v-${i}`}
              x1={line.position}
              y1={-99999}
              x2={line.position}
              y2={99999}
              stroke="var(--brand)"
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.7}
            />
          );
        })}
      </svg>
    </div>
  );
}

function CanvasInner() {
  const nodes = useAppStore((s) => s.nodes);
  const edges = useAppStore((s) => s.edges);
  const selectedNodeIds = useAppStore((s) => s.selectedNodeIds);
  const onConnect = useAppStore((s) => s.onConnect);
  const setEdges = useAppStore((s) => s.setEdges);
  const setSelectedNodeIds = useAppStore((s) => s.setSelectedNodeIds);
  const applyStableNodeChanges = useAppStore((s) => s.onNodesChange);
  const handleEdgesChange = useAppStore((s) => s.onEdgesChange);
  const clearGroupedSelection = useAppStore((s) => s.clearGroupedSelection);
  const settleNodeGroupingOnDragStop = useAppStore((s) => s.settleNodeGroupingOnDragStop);
  const duplicateNode = useAppStore((s) => s.duplicateNode);
  const commitToHistory = useAppStore((s) => s.commitToHistory);
  const minimapVisible = useAppStore((s) => s.minimapVisible);
  const closeNodeDialog = useAppStore((s) => s.closeNodeDialog);
  const interactionMode = useAppStore((s) => s.config.interactionMode ?? 'default');
  const canvasBackground = useAppStore((s) => s.config.canvasBackground);
  const canvasNoteToolbarVisible = useAppStore((s) => s.config.canvasNoteToolbarVisible !== false);
  const interaction = interactionMode === 'classic' ? CLASSIC_INTERACTION : DEFAULT_INTERACTION;
  // 閸欐娊鏁?effect 閻?ref 鐠囪褰囧Ο鈥崇础閿涘矂浼╅崗宥嗗Ω interactionMode 閸旂姾绻?effect 娓氭繆绂嗛懓灞筋嚤閼峰娲冮崥顒€娅掗柌宥嗗瘯
  const interactionModeRef = useRef(interactionMode);
  useEffect(() => {
    interactionModeRef.current = interactionMode;
  }, [interactionMode]);
  const reactFlowInstance = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const activeCanvasPanRef = useRef<{
    startX: number;
    startY: number;
    detail: CanvasPanByDetail;
  } | null>(null);

  useEffect(() => registerCanvasViewportController({
    getSnapshot: () => {
      const viewport = reactFlowInstance.getViewport();
      const topLeft = reactFlowInstance.screenToFlowPosition({ x: 0, y: 0 });
      const bottomRight = reactFlowInstance.screenToFlowPosition({
        x: window.innerWidth,
        y: window.innerHeight,
      });
      return {
        ...viewport,
        visibleBounds: {
          x: topLeft.x,
          y: topLeft.y,
          width: bottomRight.x - topLeft.x,
          height: bottomRight.y - topLeft.y,
        },
      };
    },
    setViewport: async (viewport, duration = 0) => {
      await reactFlowInstance.setViewport(viewport, { duration });
    },
    fitView: async (options = {}) => {
      const ids = options.nodeIds ? new Set(options.nodeIds) : null;
      const nodes = ids
        ? reactFlowInstance.getNodes().filter((node) => ids.has(node.id))
        : undefined;
      await reactFlowInstance.fitView({
        nodes,
        padding: options.padding ?? 0.25,
        duration: options.duration ?? 0,
      });
    },
  }), [reactFlowInstance]);
  const canvasRootRef = useRef<HTMLDivElement>(null);
  const activeInteractionsRef = useRef(new Set<'node' | 'viewport'>());

  const nodeToolbarScaleRef = useRef(Number.NaN);

  const updateNodeToolbarScale = useCallback((zoom: number) => {
    if (!Number.isFinite(zoom) || zoom <= 0) return;
    const clampedScreenScale = Math.min(
      NODE_TOOLBAR_MAX_SCREEN_SCALE,
      Math.max(NODE_TOOLBAR_MIN_SCREEN_SCALE, zoom),
    );
    const compensation = clampedScreenScale / zoom;
    // 纯平移或极小缩放变化无需写入，避免每帧让全部节点工具条重新计算样式。
    if (Math.abs(compensation - nodeToolbarScaleRef.current) < NODE_TOOLBAR_SCALE_EPSILON) return;
    nodeToolbarScaleRef.current = compensation;
    canvasRootRef.current?.style.setProperty(
      '--node-toolbar-zoom-compensation',
      String(compensation),
    );
  }, []);

  useEffect(() => {
    updateNodeToolbarScale(reactFlowInstance.getViewport().zoom);
  }, [reactFlowInstance, updateNodeToolbarScale]);

  const setCanvasInteraction = useCallback((kind: 'node' | 'viewport', active: boolean) => {
    if (active) activeInteractionsRef.current.add(kind);
    else activeInteractionsRef.current.delete(kind);
    document.documentElement.classList.toggle(
      CANVAS_INTERACTING_CLASS,
      activeInteractionsRef.current.size > 0,
    );
  }, []);

  useEffect(() => () => {
    document.documentElement.classList.remove(CANVAS_INTERACTING_CLASS);
  }, []);

  const handleCanvasViewportMoveStart = useCallback<OnMove>(() => {
    setCanvasInteraction('viewport', true);
  }, [setCanvasInteraction]);

  const handleCanvasViewportMoveEnd = useCallback<OnMove>(() => {
    setCanvasInteraction('viewport', false);
  }, [setCanvasInteraction]);

  const handleCanvasViewportMove = useCallback<OnMove>((_, viewport) => {
    updateNodeToolbarScale(viewport.zoom);
    const activePan = activeCanvasPanRef.current;
    if (!activePan) return;
    activePan.detail.onProgress?.({
      deltaX: viewport.x - activePan.startX,
      deltaY: viewport.y - activePan.startY,
    });
  }, [updateNodeToolbarScale]);

  // 閼哄倻鍋ｆ潻娑樻簚閸斻劎鏁鹃敍鍧眗anslateY閿涘绱扮拋?React Flow 閸︺劍瀵曟潪鐣岀仜闂傚瓨绁村妤€浜哥粔鑽ゆ畱 handle 闁挎氨鍋ｉ獮鍓佺处鐎涙﹫绱?
  // 鐎佃壈鍤ф潻鐐靛殠鐠ч攱顒涢悙褰掓晩娴ｅ秲鈧倽绻橀崷鍝勫З閻㈣崵绮ㄩ弶鐕傜礄閽€鎴掔秴 translateY:0閿涘鎮楅柌宥嗘煀濞村鍣虹拠銉ㄥΝ閻愬湱娈?handle閵?
  useEffect(() => {
    const onAnimEnd = (e: AnimationEvent) => {
      if (e.animationName !== 'nodeIn') return;
      const el = (e.target as HTMLElement | null)?.closest?.('.react-flow__node');
      const id = el?.getAttribute('data-id');
      if (id) updateNodeInternals(id);
    };
    document.addEventListener('animationend', onAnimEnd);
    return () => document.removeEventListener('animationend', onAnimEnd);
  }, [updateNodeInternals]);

  const {
    isDragOver,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    onDoubleClick,
  } = useNodeCreation();

  const {
    activeTool: activeDrawingTool,
    chooseTool: chooseDrawingTool,
    selectedNoteNode,
    panelNote,
    pendingImage,
    draftNode,
    applyNotePatch,
    beginNoteChange,
    endNoteChange,
    duplicateSelectedNote,
    deleteSelectedNote,
    moveSelectedNoteLayer,
    requestCrop,
    handlePointerDownCapture: handleDrawingPointerDown,
    handlePointerMoveCapture: handleDrawingPointerMove,
    handlePointerUpCapture: handleDrawingPointerUp,
  } = useCanvasDrawing();

  useEffect(() => {
    if (!canvasNoteToolbarVisible && activeDrawingTool !== 'select') {
      chooseDrawingTool('select');
    }
  }, [activeDrawingTool, canvasNoteToolbarVisible, chooseDrawingTool]);

  const drawingActive = activeDrawingTool !== 'select';
  const {
    position: radialMenuPosition,
    holdPosition: radialMenuHoldPosition,
    close: closeRadialMenu,
  } = useCanvasLongPressRadialMenu(canvasRootRef, !drawingActive);
  const drawingInteraction = useMemo(() => ({
    ...interaction,
    ...(drawingActive ? {
      panOnDrag: false,
      selectionOnDrag: false,
    } : {}),
    // React Flow 娴兼艾鎷烽悾銉ュ綁閸?undefined 閻ㄥ嫬褰堥幒褍鐫橀幀褝绱濋崶鐘愁劃缂佹挻娼紒妯烘禈閺冭泛绻€妞ょ粯妯夊蹇斾划婢跺秲鈧?
    nodesDraggable: !drawingActive,
    elementsSelectable: !drawingActive,
  }), [drawingActive, interaction]);

  // 閳光偓閳光偓 UI toggles (persisted to localStorage) 閳光偓閳光偓
  const [showGrid, setShowGrid] = useState(() => localStorage.getItem('canvas-showGrid') !== 'false');
  const [smoothLine, setSmoothLine] = useState(() => localStorage.getItem('canvas-smoothLine') !== 'false');

  useEffect(() => { localStorage.setItem('canvas-showGrid', String(showGrid)); }, [showGrid]);
  useEffect(() => { localStorage.setItem('canvas-smoothLine', String(smoothLine)); }, [smoothLine]);

  // Sync existing edges when line type changes
  useEffect(() => {
    setEdges(edges.map((e) => ({ ...e, type: smoothLine ? 'smoothstep' : 'default' })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smoothLine]);

  // Track the live canvas pointer so keyboard-created nodes can place their top-left corner here.
  const handleCanvasPointer = useCallback(
    (e: React.MouseEvent) => {
      const flowPos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setCanvasPointerPosition(flowPos);

      const toolbar = e.target instanceof Element
        ? e.target.closest<HTMLElement>('.node-floating-toolbar')
        : null;
      if (toolbar) {
        const rect = toolbar.getBoundingClientRect();
        toolbar.style.setProperty('--toolbar-pointer-x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
        toolbar.style.setProperty('--toolbar-pointer-y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
      }
    },
    [reactFlowInstance],
  );

  const handleCanvasPaneClick = useCallback(() => {
    closeNodeDialog();
  }, [closeNodeDialog]);

  const toggleGrid = useCallback(() => setShowGrid((v) => !v), []);
  const fitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2, maxZoom: 1 });
  }, [reactFlowInstance]);
  const openShortcuts = useCallback(() => {
    useAppStore.getState().setSettingsOpen(true, 'shortcuts');
  }, []);

  // 閳光偓閳光偓 Connection drop menu 閳光偓閳光偓
  const {
    menu: connectionMenu,
    menuRef: connectionMenuRef,
    handleConnectEnd,
    handleSelect: handleConnectionMenuSelect,
    connectionMenuMap,
    sourceNode,
  } = useConnectionDropMenu(smoothLine);

  // 閳光偓閳光偓 Node context menu 閳光偓閳光偓
  const {
    menu: nodeCtxMenu,
    menuRef: nodeCtxMenuRef,
    openMenu: openNodeCtxMenu,
    handleCopy,
    handleCut,
    handleCopyText,
    handleCutText,
    handleDuplicate,
    handleToggleLock,
    isNodeLocked,
    handleConvertImage,
    showImageConversion,
    imageConversionLabel,
    handleUngroup,
    handleOpenGroupFolder,
    handleDelete,
    handleShowInFolder,
    showInFolder,
    handleSaveAs,
    showSaveAs,
    handleOpenInPS,
    showOpenInPS,
    handleEditVideo,
    showEditVideo,
    editVideoLabel,
    handleOpenInJianying,
    handleOpenInPremiere,
    showOpenInVideoEditor,
    handleCopyMedia,
    showCopyMedia,
    copyMediaLabel,
    characterCaptureNodeId,
    handleAddToCharacter,
    closeCharacterCapture,
    showAddToCharacter,
    pluginTools,
    handlePluginTool,
  } = useNodeContextMenu();
  const isGroupNode = nodeCtxMenu.nodeId
    ? nodes.find((n) => n.id === nodeCtxMenu.nodeId && n.type === 'group') != null
    : false;

  // 閳光偓閳光偓 Canvas context menu 閳光偓閳光偓
  const {
    menu: ctxMenu,
    menuRef: ctxMenuRef,
    submenuRef: ctxSubmenuRef,
    openMenu: openCtxMenu,
    addNodeAtCtxPos,
    addPluginNodeAtCtxPos,
    pluginNodes,
    handleUndo: handleCtxUndo,
    handleRedo: handleCtxRedo,
    handlePaste: handleCtxPaste,
    handleCreateFolder: handleCtxCreateFolder,
    handleDelete: handleCtxDelete,
    handleCopyNodes: handleCtxCopyNodes,
    handleCopyFiles: handleCtxCopyFiles,
    handleOpenProjectDir: handleCtxOpenProjectDir,
    hasSelection: ctxHasSelection,
    showSubmenu,
    hideSubmenu,
  } = useCanvasContextMenu();

  useCanvasSecondaryClickMenu({
    interactionModeRef,
    openNodeMenu: openNodeCtxMenu,
    openCanvasMenu: openCtxMenu,
  });

  // 閳光偓閳光偓 External clipboard paste (native paste event 閳?DataTransfer) 閳光偓閳光偓
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      // Skip if user is editing an input
      if (isEditableTarget(e.target)) return;
      // Skip if internal clipboard has nodes (handled by keyboard shortcut)
      if (useAppStore.getState().clipboard.nodes.length > 0) return;

      e.preventDefault();
      e.stopPropagation();

      const vp = reactFlowInstance.getViewport();
      const centerX = (window.innerWidth / 2 - vp.x) / vp.zoom;
      const centerY = (window.innerHeight / 2 - vp.y) / vp.zoom;
      useAppStore.getState().pasteExternalFromDataTransfer(e.clipboardData, { x: centerX, y: centerY });
    };
    window.addEventListener('paste', handler, true);
    return () => window.removeEventListener('paste', handler, true);
  }, [reactFlowInstance]);

  // 閳光偓閳光偓 Fit view event (project switch / F key) 閳光偓閳光偓
  useEffect(() => {
    const handler = () => {
      // Wait one frame for React to finish rendering new nodes/edges
      requestAnimationFrame(() => {
        void reactFlowInstance.fitView(FIT_VIEW_OPTIONS);
      });
    };
    window.addEventListener('canvas-fit-view', handler);
    return () => window.removeEventListener('canvas-fit-view', handler);
  }, [reactFlowInstance]);

  // 閳光偓閳光偓 Keep anchored overlays visible by panning the whole canvas 閳光偓閳光偓
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<CanvasPanByDetail>).detail;
      if (!detail) return;
      const { deltaX, deltaY, duration = CANVAS_PAN_DURATION_MS } = detail;
      if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;

      const viewport = reactFlowInstance.getViewport();
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const activePan = {
        startX: viewport.x,
        startY: viewport.y,
        detail,
      };
      activeCanvasPanRef.current = activePan;

      void reactFlowInstance.setViewport(
        {
          x: viewport.x + deltaX,
          y: viewport.y + deltaY,
          zoom: viewport.zoom,
        },
        {
          duration: reduceMotion ? 0 : duration,
          ease: easeOutCubic,
          interpolate: 'linear',
        },
      ).finally(() => {
        if (activeCanvasPanRef.current !== activePan) return;
        const finalViewport = reactFlowInstance.getViewport();
        const progress = {
          deltaX: finalViewport.x - activePan.startX,
          deltaY: finalViewport.y - activePan.startY,
        };
        detail.onProgress?.(progress);
        detail.onComplete?.(progress);
        activeCanvasPanRef.current = null;
      });
    };

    window.addEventListener(CANVAS_PAN_BY_EVENT, handler);
    return () => {
      activeCanvasPanRef.current = null;
      window.removeEventListener(CANVAS_PAN_BY_EVENT, handler);
    };
  }, [reactFlowInstance]);

  // 閳光偓閳光偓 Focus node events (history / Agent-created node batch) 閳光偓閳光偓
  useEffect(() => {
    const scheduledFrames = new Set<number>();
    const focusNodes = (
      nodeIds: string[],
      options?: { padding?: number; maxZoom?: number; duration?: number },
    ) => {
      if (nodeIds.length === 0) return;
      const firstFrame = requestAnimationFrame(() => {
        scheduledFrames.delete(firstFrame);
        const secondFrame = requestAnimationFrame(() => {
          scheduledFrames.delete(secondFrame);
          const targetIds = new Set(nodeIds);
          const targetNodes = reactFlowInstance.getNodes().filter((node) => targetIds.has(node.id));
          if (targetNodes.length === 0) return;
          const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          void reactFlowInstance.fitView({
            nodes: targetNodes,
            padding: options?.padding ?? (targetNodes.length === 1 ? 0.45 : 0.3),
            minZoom: targetNodes.length > 6 ? 0.18 : 0.28,
            maxZoom: options?.maxZoom ?? (targetNodes.length === 1 ? 1.1 : 0.95),
            duration: reduceMotion ? 0 : (options?.duration ?? 420),
          });
        });
        scheduledFrames.add(secondFrame);
      });
      scheduledFrames.add(firstFrame);
    };
    const handleSingleNodeFocus = (e: Event) => {
      const detail = (e as CustomEvent<{ nodeId: string }>).detail;
      if (detail?.nodeId) focusNodes([detail.nodeId], { maxZoom: 1, duration: 400 });
    };
    const handleNodeBatchFocus = (e: Event) => {
      const detail = (e as CustomEvent<{
        nodeIds: string[];
        padding?: number;
        maxZoom?: number;
        duration?: number;
      }>).detail;
      if (detail?.nodeIds?.length) focusNodes(detail.nodeIds, detail);
    };
    window.addEventListener('canvas-focus-node', handleSingleNodeFocus);
    window.addEventListener('canvas-focus-nodes', handleNodeBatchFocus);
    return () => {
      window.removeEventListener('canvas-focus-node', handleSingleNodeFocus);
      window.removeEventListener('canvas-focus-nodes', handleNodeBatchFocus);
      for (const frameId of scheduledFrames) cancelAnimationFrame(frameId);
    };
  }, [reactFlowInstance]);

  // 閳光偓閳光偓 Node click 閳?AI dialog 閳光偓閳光偓
  const openNodeDialog = useAppStore((s) => s.openNodeDialog);
  const inlineEditClickTimerRef = useRef<number | null>(null);
  const openDialogForNode = useCallback(
    (node: RFNode<BaseNodeData>) => {
      const el = document.querySelector(`.react-flow__node[data-id="${node.id}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        openNodeDialog(node.id, { x: rect.left + rect.width / 2, y: rect.bottom });
        return;
      }
      openNodeDialog(node.id);
    },
    [openNodeDialog],
  );

  useEffect(() => () => {
    if (inlineEditClickTimerRef.current !== null) {
      window.clearTimeout(inlineEditClickTimerRef.current);
    }
  }, []);

  const onNodeClick = useCallback(
    (e: React.MouseEvent, node: RFNode<BaseNodeData>) => {
      if (inlineEditClickTimerRef.current !== null) {
        window.clearTimeout(inlineEditClickTimerRef.current);
        inlineEditClickTimerRef.current = null;
      }
      // Shift+click is for multi-select, don't open dialog
      if (e.shiftKey) return;
      const target = e.target instanceof Element ? e.target : null;
      const isEmptyTextEditTrigger = target?.closest('[data-inline-edit-trigger]')
        && node.data?.type === 'ai-text'
        && node.data?.role !== 'source';
      if (isEmptyTextEditTrigger) {
        // 缁楊兛绔村▎锛勫仯閸戣鍘涚拋?React Flow 鐎瑰本鍨氶柅澶夎厬閿涙稓顑囨禍灞绢偧閻愮懓鍤导姘絿濞戝牆鑴婄粣妤€鑻熸禍銈囩舶 TextNode 閻ㄥ嫬寮婚崙鑽ょ椽鏉堟垯鈧?
        if (e.detail > 1) return;
        inlineEditClickTimerRef.current = window.setTimeout(() => {
          inlineEditClickTimerRef.current = null;
          const latestNode = useAppStore.getState().nodes.find((item) => item.id === node.id);
          if (!latestNode?.selected || latestNode.data.output) return;
          openDialogForNode(latestNode);
        }, INLINE_EDIT_DOUBLE_CLICK_DELAY_MS);
        return;
      }
      // Non-generative canvas elements have no AI dialog.
      if (node.type === 'group') return;
      if (node.type === 'canvas-note') return;
      if (node.data?.type === 'ai-markdown') return;
      if (node.data?.role === 'source') return;
      if (node.data?.type === 'ai-text' && node.data?.output) return;
      if (node.data?.type === 'ai-image' && node.data?.imageUrl) return;
      if (node.data?.type === 'ai-animation' && node.data?.imageUrl) return;
      if (node.data?.type === 'ai-panorama' && node.data?.imageUrl) return;
      if (node.data?.type === 'ai-video' && node.data?.videoUrl) return;

      openDialogForNode(node);
    },
    [openDialogForNode],
  );

  // 閳光偓閳光偓 Selection sync 閳光偓閳光偓
  const onSelectionChange = useCallback(
    (changes: OnSelectionChangeParams) => {
      const sel = changes.nodes;
      const nonGroup = sel.filter((n) => n.type !== 'group');
      // 濡楀棝鈧鎷烽悾銉ュ瀻缂佸嫯濡悙鐧哥窗娑撳骸鍙剧€瑰啳濡悙閫涚閸氬矁顫﹂柅澶夎厬閺冭绱漵tore 闁灏崜鏃堟珟閸掑棛绮嶉敍鍫濆灩闂?閸掑棛绮嶆稉宥嗗皾閸欏﹤顔愰崳顭掔礆閿?
      // 閸楁洜瀚悙鐟板毊閸掑棛绮嶆禒宥勭箽閻ｆ瑱绱欐笟澶哥艾閸掔娀娅?鐟欙絾鏆庨敍澶堚偓淇丗 鐟欏棜顫庨崢濠氣偓澶婃躬 onSelectionEnd 婢跺嫮鎮婇妴?
      const next = nonGroup.length > 0 ? nonGroup : sel;
      setSelectedNodeIds(next.map((n) => n.id));
    },
    [setSelectedNodeIds],
  );

  // 濡楀棝鈧绮ㄩ弶鐔锋倵閿涙俺瀚㈤崚鍡欑矋閼哄倻鍋ｆ稉搴″従鐎瑰啳濡悙閫涚閸氬矁顫﹀鍡曡厬閿涘苯褰囧☉鍫濆瀻缂佸嫯濡悙鍦畱闁鑵戦敍宀勪缉閸忓秹娈㈤崥搴ゎ潶娑撯偓鐠ч攱瀚嬮崝?
  const onSelectionEnd = useCallback(() => {
    clearGroupedSelection();
  }, [clearGroupedSelection]);

  // 閳光偓閳光偓 Node snap 閳光偓閳光偓
  const {
    snapLines,
    onNodeDragStart,
    applySnap,
    onNodeDragStop,
    onResizeStart,
    applyResizeSnap,
    onResizeStop,
  } = useNodeSnap();

  // 缂傗晜鏂侀崥鎼佹濡椼儲甯撮敍姘鼻旂€规艾绱╅悽銊┾偓蹇庣炊缂佹瑨濡悙鐟板敶閻?ResizeHandle閿涘牏绮?Context閿?
  const resizeSnapApi = useMemo(
    () => ({ onResizeStart, applyResizeSnap, onResizeStop }),
    [onResizeStart, applyResizeSnap, onResizeStop],
  );

  // 閹稿缍?Ctrl/閳?瀵偓婵瀚嬮幏?閳?閸︺劌甯担宥咁槻閸掓湹绔存稉顏囧Ν閻愮櫢绱欓幏鏍уЗ閻ㄥ嫪绮涢弰顖氬斧閼哄倻鍋ｉ敍宀€鐡戞禍?閹锋牕鍤稉鈧稉顏勫閺?閿?
  const handleNodeDragStart = useCallback(
    (evt: React.MouseEvent, node: RFNode<BaseNodeData>) => {
      setCanvasInteraction('node', true);
      if (node.type === 'canvas-note') commitToHistory();
      if ((evt.ctrlKey || evt.metaKey) && node.type !== 'group') {
        duplicateNode(node.id);
      }
      onNodeDragStart(evt, node);
    },
    [commitToHistory, duplicateNode, onNodeDragStart, setCanvasInteraction],
  );

  // 娴犲懎婀痪鍨€烽崚鍥ㄥ床閺冨爼鍣稿鐚寸礉闁灝鍘ゅВ蹇撴姎閺傛澘顕挒陇袝閸?React Flow 閸愬懘鍎撮弴瀛樻煀
  const defaultEdgeOptions = useMemo(
    () => ({
      type: smoothLine ? 'smoothstep' : 'default',
      style: DEFAULT_EDGE_STYLE,
      animated: false,
    }),
    [smoothLine],
  );

  const renderableGraph = useMemo(
    () => filterHiddenCanvasElements(nodes, edges),
    [edges, nodes],
  );
  const renderedCanvasNodes = useMemo(() => {
    const graphNodes = draftNode ? [...renderableGraph.nodes, draftNode] : renderableGraph.nodes;
    return graphNodes.map((node) => node.type === 'canvas-note'
      ? {
          ...node,
          style: {
            ...node.style,
            // 缁楁棁顔囬惃鍕偓蹇旀婢舵牗甯撮惌鈺佽埌娑撳秷鍏橀柆顔藉皡娑撳鏌熼懞鍌滃仯閿涙稑褰茬憴浣稿敶鐎圭懓婀?canvas-drawing.css 娑擃厽浠径宥呮嚒娑擃厹鈧?
            pointerEvents: 'none' as const,
          },
        }
      : node);
  }, [draftNode, renderableGraph.nodes]);

  // 娴犲懏娣抽悽鐔歌閺屾挾濮搁幀渚婄礉娑撳秵濡搁梾鎰閸滃矁濡悙褰掆偓澶夎厬閺佸牊鐏夐崘娆忔礀閸欘垱瀵旀稊鍛閻ㄥ嫯绔熼弫鐗堝祦閵?
  const renderedEdges = useMemo(() => {
    const selectedIds = selectedNodeIds.length > 0 ? new Set(selectedNodeIds) : null;
    return renderableGraph.edges.map((edge) => {
      const baseEdgeType = edge.type === 'smoothstep' || (!edge.type && smoothLine)
        ? 'smoothstep'
        : 'default';
      return {
        ...edge,
        type: 'scissor-hover',
        style: edge.style ?? DEFAULT_EDGE_STYLE,
        data: {
          ...edge.data,
          baseEdgeType,
          selectedNodeFlow: selectedIds !== null && (selectedIds.has(edge.source) || selectedIds.has(edge.target)),
        },
      };
    });
  }, [renderableGraph.edges, selectedNodeIds, smoothLine]);

  // 閳光偓閳光偓 Node change handler 閳光偓閳光偓
  const handleNodesChange = useCallback(
    (changes: NodeChange<RFNode<BaseNodeData>>[]) => {
      const lockedNodeIds = new Set(
        useAppStore.getState().nodes
          .filter((node) => node.draggable === false)
          .map((node) => node.id),
      );
      const unlockedChanges = changes.filter(
        (change) => change.type !== 'position' || !lockedNodeIds.has(change.id),
      );
      if (unlockedChanges.length === 0) return;

      // 閹跺﹤鎯涢梽鍕倵閻ㄥ嫪缍呯純顔炬纯閹恒儲鏁為崗?React Flow 閻ㄥ嫬褰夐弴瀵割吀缁?
      // 閿涘牊鍨氭稉鍝勬暜娑撯偓閻喓娴夊┃鎰剁礉闁灝鍘ゆ禍灞绢偧 setNodes 鐟曞棛娲婄€佃壈鍤ч惃鍕磽缁?濮楋紕姣婄粵瀣剁礆閵?
      // 濞夈劍鍓伴敍姘緱閹靛鍋呮稉鈧敮?dragging=false 娑旂喕顩﹂崥鎼佹閿涘苯鎯侀崚娆庣窗瀵懓娲栭崢鐔奉潗閽€鐣屽仯閿涘牅缍呯粔浼欑礆閵?
      // applySnap 閸︺劑娼幏鏍ㄥ閺堢噦绱檇ragCtx 娑撹櫣鈹栭敍澶嬫Ц閺冪姴澹囨担婊呮暏閻╂挳鈧熬绱濋弫鍛￥闂団偓閸掋倖鏌?dragging閵?
      const draggingPosChanges = unlockedChanges.filter(
        (c) => c.type === 'position' && c.position,
      );
      let snapped = unlockedChanges;
      if (draggingPosChanges.length > 0) {
        const dc = draggingPosChanges[0];
        if (dc.type === 'position' && dc.position) {
          const snappedPos = applySnap(dc.id, dc.position);
          const correctionX = snappedPos.x - dc.position.x;
          const correctionY = snappedPos.y - dc.position.y;
          const draggedIds = new Set(
            draggingPosChanges.flatMap((change) => change.type === 'position' ? [change.id] : []),
          );
          snapped = changes.map((change) => {
            if (change.type !== 'position' || !change.position || !draggedIds.has(change.id)) return change;
            return {
              ...change,
              position: {
                x: change.position.x + correctionX,
                y: change.position.y + correctionY,
              },
            };
          });
        }
      }

      // Detect group node removals 閳?convert to ungroup
      const removedIds = snapped
        .filter((c) => c.type === 'remove')
        .map((c) => c.id);

      // 韫囶偊鈧喕鐭惧鍕剁窗缁绢垱瀚嬮幏?闁瀚ㄩ崣妯绘纯閿涘牊妫ら崚鐘绘珟閿涘鈧柡鈧?閻劌鍤遍弫鏉跨础閺囧瓨鏌婇敍灞筋潗缂佸牆鐔€娴滃孩娓堕弬?
      // store.nodes閿涘矂浼╅崗宥呮彥闁喐瀚嬮崝銊︽闂傤厼瀵?nodes 鏉╁洦婀＄€佃壈鍤ч惃鍕閸斻劌宕辨い瑁も偓?
      if (removedIds.length === 0) {
        useAppStore.setState((s) => ({
          nodes: applyNodeChanges(snapped, s.nodes) as RFNode<BaseNodeData>[],
        }));
        return;
      }

      applyStableNodeChanges(snapped);
    },
    [applySnap, applyStableNodeChanges],
  );

  // 閳光偓閳光偓 閹锋牕鍙嗙€诡偅鐗搁崚鍡涙殔閿涙俺绻橀崗銉ㄥΝ閻愮瀵栭崶瀛樻▔缁€铏圭級閻ｃ儱娴橀敍灞藉涧閺堝鈹栭弽鐓庡帒鐠佸憡鏂佺純?閳光偓閳光偓
  const sbDropTarget = useRef<HTMLElement | null>(null);
  const [dropGhost, setDropGhost] = useState<{
    url: string;
    x: number;
    y: number;
    canDrop: boolean;
  } | null>(null);
  const ghostNodeId = useRef<string | null>(null);
  const shotlistDropTarget = useRef<HTMLElement | null>(null);

  const clearGhostNodeHidden = useCallback(() => {
    if (ghostNodeId.current) {
      document.querySelector(`.react-flow__node[data-id="${ghostNodeId.current}"]`)?.classList.remove('sb-drop-hidden');
      ghostNodeId.current = null;
    }
  }, []);

  const clearSbDropTarget = useCallback(() => {
    sbDropTarget.current?.classList.remove('sb-cell--drop-target');
    sbDropTarget.current = null;
  }, []);

  const clearShotlistDropTarget = useCallback(() => {
    shotlistDropTarget.current?.classList.remove('shot-frame--drop-target');
    shotlistDropTarget.current = null;
  }, []);

  // 拖到折叠分组（文件夹）上：文件夹打开，被拖节点缩小并微微倾斜
  const folderDropTarget = useRef<HTMLElement | null>(null);
  const folderDropNode = useRef<HTMLElement | null>(null);
  const clearFolderDropTarget = useCallback(() => {
    folderDropTarget.current?.classList.remove('is-folder-drop-target');
    folderDropTarget.current = null;
    folderDropNode.current?.classList.remove('folder-drop-shrink');
    folderDropNode.current = null;
  }, []);

  /**
   * 閸涙垝鑵戦崚鍡涙殔鐞涖劎娈戦悽濠氭桨閺嶇鈧?
   * 娑撳骸顔傞弽闂寸瑝閸氬矉绱濆鑼拨鐎规氨娈戦弽鐓庣摍娑旂喐甯撮崣妤佹杹缂冾喒鈧柡鈧梻娲块幒銉﹀床缂佹埊绱濆В鏂垮帥鐟欙絿绮﹂崘宥嗗珛娑撯偓濞嗭繝銆庨幍瀣ㄢ偓?
   */
  const findShotlistDropHit = useCallback((
    node: RFNode,
    clientX: number,
    clientY: number,
  ): HTMLElement | null => {
    if (!SHOTLIST_FRAME_SOURCE_TYPES.includes(node.type ?? '')) return null;
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const el of stack) {
      const shotlist = el.closest<HTMLElement>('.shotlist-node');
      if (!shotlist) continue;
      if (shotlist.closest(`.react-flow__node[data-id="${node.id}"]`)) continue;
      const cell = el.closest<HTMLElement>('[data-shot-frame-row]');
      return cell?.closest('.shotlist-node') === shotlist ? cell : null;
    }
    return null;
  }, []);

  // 閹稿绱堕弽鍥︾秴缂冾喖鎳℃稉顓烆唫閺嶈壈濡悙閫涚瑢閻喎鐤勭粚鐑樼壐閿涘苯鍚嬬€瑰湱缂夐弨鎯ф嫲闂堢偛娼庨崠鈧懛顏勭暰娑斿顔傞弽绗衡偓?
  const findStoryboardDropHit = useCallback((
    node: RFNode,
    clientX: number,
    clientY: number,
  ): { storyboard: HTMLElement; emptyCell: HTMLElement | null } | null => {
    if (!STORYBOARD_CELL_SOURCE_TYPES.includes(node.type ?? '')) return null;
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const el of stack) {
      const storyboard = el.closest<HTMLElement>('.storyboard-node');
      if (!storyboard) continue;
      if (storyboard.closest(`.react-flow__node[data-id="${node.id}"]`)) continue;
      const cell = el.closest<HTMLElement>('[data-sb-cell-idx]');
      const emptyCell = cell?.closest('.storyboard-node') === storyboard
        && cell.classList.contains('sb-cell--empty')
        ? cell
        : null;
      return { storyboard, emptyCell };
    }
    return null;
  }, []);

  const handleNodeDrag = useCallback(
    (e: React.MouseEvent, node: RFNode) => {
      const folder = node.type === 'group'
        ? null
        : document.elementsFromPoint(e.clientX, e.clientY)
          .map((el) => el.closest<HTMLElement>('.canvas-group-folder'))
          .find((el): el is HTMLElement => el != null) ?? null;
      if (folder !== folderDropTarget.current) {
        clearFolderDropTarget();
        if (folder) {
          folder.classList.add('is-folder-drop-target');
          folderDropTarget.current = folder;
          const dragged = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${node.id}"]`);
          dragged?.classList.add('folder-drop-shrink');
          folderDropNode.current = dragged;
        }
      }

      const hit = findStoryboardDropHit(node, e.clientX, e.clientY);
      const cell = hit?.emptyCell ?? null;
      if (cell !== sbDropTarget.current) {
        clearSbDropTarget();
        if (cell) { cell.classList.add('sb-cell--drop-target'); sbDropTarget.current = cell; }
      }
      // 鏉╂稑鍙嗙€诡偅鐗搁懞鍌滃仯閸氬酣娈ｉ挊蹇曟埂鐎圭偠濡悙鐧哥幢缁岀儤鐗告稉濠傗偓鐐灘鐞涖劎銇氶崣顖涙杹缂冾噯绱濋崡鐘垫暏閸栧搫鐓欐穱婵囧瘮濮樻潙閽╅妴?
      const url = (node.data?.imageUrl || node.data?.thumbnailUrl) as string | undefined;
      if (hit && url) {
        setDropGhost({ url, x: e.clientX, y: e.clientY, canDrop: cell != null });
        if (ghostNodeId.current !== node.id) {
          clearGhostNodeHidden();
          document.querySelector(`.react-flow__node[data-id="${node.id}"]`)?.classList.add('sb-drop-hidden');
          ghostNodeId.current = node.id;
        }
      } else {
        setDropGhost(null);
        clearGhostNodeHidden();
      }

      // 閸掑棝鏆呯悰銊ф暰闂堛垺鐗搁敍姘涧閸嬫岸鐝禍顕嗙礉娑撳秹娈ｉ挊蹇氼潶閹锋牜娈戦懞鍌滃仯閳ユ柡鈧梻绮︾€规艾鎮楃€瑰啩绮涚憰浣烘殌閸︺劎鏁剧敮鍐х瑐
      const frameCell = findShotlistDropHit(node, e.clientX, e.clientY);
      if (frameCell !== shotlistDropTarget.current) {
        clearShotlistDropTarget();
        if (frameCell) {
          frameCell.classList.add('shot-frame--drop-target');
          shotlistDropTarget.current = frameCell;
        }
      }
    },
    [findStoryboardDropHit, clearSbDropTarget, clearGhostNodeHidden, findShotlistDropHit, clearShotlistDropTarget, clearFolderDropTarget],
  );

  // 閳光偓閳光偓 Auto group/ungroup on drag stop 閳光偓閳光偓
  const handleNodeDragStop = useCallback(
    (event: React.MouseEvent, node: RFNode) => {
      setCanvasInteraction('node', false);
      const cell = findStoryboardDropHit(node, event.clientX, event.clientY)?.emptyCell ?? null;
      const frameCell = findShotlistDropHit(node, event.clientX, event.clientY);
      clearSbDropTarget();
      clearShotlistDropTarget();
      clearFolderDropTarget();
      setDropGhost(null);
      clearGhostNodeHidden();
      if (frameCell) {
        const shotlistId = frameCell.closest('.react-flow__node')?.getAttribute('data-id');
        const rowId = frameCell.dataset.shotFrameRow;
        if (shotlistId && shotlistId !== node.id && rowId) {
          useAppStore.getState().bindShotlistFrame(shotlistId, rowId, node.id);
          onNodeDragStop();
          return;
        }
      }
      if (cell) {
        const sbId = cell.closest('.react-flow__node')?.getAttribute('data-id');
        const idx = Number(cell.dataset.sbCellIdx);
        if (sbId && sbId !== node.id && !Number.isNaN(idx)) {
          useAppStore.getState().fillStoryboardCell(sbId, idx, node.id);
          onNodeDragStop();
          return;
        }
      }
      settleNodeGroupingOnDragStop(node as RFNode<BaseNodeData>);
      onNodeDragStop();
    },
    [onNodeDragStop, settleNodeGroupingOnDragStop, findStoryboardDropHit, clearSbDropTarget, clearGhostNodeHidden, setCanvasInteraction, findShotlistDropHit, clearShotlistDropTarget, clearFolderDropTarget],
  );

  return (
    <ResizeSnapContext.Provider value={resizeSnapApi}>
    <div
      ref={canvasRootRef}
      className={`absolute inset-0 canvas-drawing-root is-tool-${activeDrawingTool}`}
      onPointerDownCapture={handleDrawingPointerDown}
      onPointerMoveCapture={handleDrawingPointerMove}
      onPointerUpCapture={handleDrawingPointerUp}
    >
      <ReactFlow
        nodes={renderedCanvasNodes}
        edges={renderedEdges}
        onConnect={onConnect}
        onConnectEnd={handleConnectEnd}
        isValidConnection={isCanvasConnectionValid}
        onNodeClick={onNodeClick}
        onDoubleClick={onDoubleClick}
        onSelectionChange={onSelectionChange}
        onSelectionEnd={onSelectionEnd}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={64}
        onlyRenderVisibleElements
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.1}
        maxZoom={5}
        defaultEdgeOptions={defaultEdgeOptions}
        proOptions={PRO_OPTIONS}
        {...drawingInteraction}
        onContextMenu={(e) => e.preventDefault()}
        onMove={handleCanvasViewportMove}
        onMoveStart={handleCanvasViewportMoveStart}
        onMoveEnd={handleCanvasViewportMoveEnd}
        onPaneClick={handleCanvasPaneClick}
        onMouseMove={handleCanvasPointer}
        onMouseUp={handleCanvasPointer}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Snap alignment lines */}
        <SnapLinesOverlay lines={snapLines} />

        {/* Grid background */}
        {showGrid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color={canvasBackground === 'off-white' ? 'rgba(51,54,77,0.18)' : 'var(--theme-hover)'}
            />
        )}


        {/* Mini Map 閳?interactive navigator, toggle with M key */}
        {minimapVisible && (
          <>
            <MiniMap
              position="bottom-right"
              pannable
              zoomable
              nodeColor={minimapNodeColor}
              nodeStrokeColor="var(--theme-border)"
              nodeStrokeWidth={1.5}
              nodeBorderRadius={35}
              bgColor="var(--theme-surface)"
              maskColor="var(--minimap-mask)"
              maskStrokeColor="var(--brand)"
              maskStrokeWidth={2}
              style={MINIMAP_STYLE}
              className="!bottom-12 !right-1 max-[900px]:!bottom-28"
            />
            <RoundedMiniMapMask />
          </>
        )}

        {/* 閹垮秳缍旂拋鏉跨秿 閳?閹俱倝鏀?/ 鏉╂ê甯?+ 閸欘垰娲栧┃顖滄畱閹垮秳缍旈崚妤勩€?*/}
        <Panel position="top-right" className="canvas-history-slot">
          <HistoryTimelinePanel />
        </Panel>

        {canvasNoteToolbarVisible && (
          <Panel position="bottom-left" className="canvas-drawing-toolbar-slot canvas-drawing-ui">
            <CanvasDrawingToolbar
              activeTool={activeDrawingTool}
              imageReady={Boolean(pendingImage)}
              onSelectTool={chooseDrawingTool}
            />
          </Panel>
        )}

        {panelNote && (
          <Panel position="top-left" className="canvas-note-style-panel-slot canvas-drawing-ui">
            <CanvasNoteStylePanel
              key={selectedNoteNode?.id ?? activeDrawingTool}
              note={panelNote}
              selected={Boolean(selectedNoteNode)}
              onPatch={(patch) => { applyNotePatch(patch); }}
              onTransientPatch={(patch) => { applyNotePatch(patch, true); }}
              onBeginChange={beginNoteChange}
              onEndChange={endNoteChange}
              onDuplicate={() => { duplicateSelectedNote(); }}
              onDelete={() => { deleteSelectedNote(); }}
              onMoveLayer={(direction) => { moveSelectedNoteLayer(direction); }}
              onCrop={requestCrop}
            />
          </Panel>
        )}

        {/* Toolbar */}
        <Panel position="bottom-right" className="flex items-center gap-2">
          <CanvasToolbar
            showGrid={showGrid}
            smoothLine={smoothLine}
            onToggleGrid={toggleGrid}
            onToggleLine={() => setSmoothLine((v) => !v)}
            onOpenShortcuts={openShortcuts}
            onFitView={fitView}
          />
        </Panel>

        {/* Empty state */}
        {nodes.length === 0 && <CanvasEmptyState />}

        {/* Drop zone overlay */}
        {isDragOver && (
          <Panel position="top-left" className="!m-0 !inset-0 pointer-events-none z-50">
            <div className="absolute inset-0 border-2 border-dashed border-indigo-400/60 rounded-2xl m-3 flex items-center justify-center">
            </div>
          </Panel>
        )}

      </ReactFlow>

      {radialMenuHoldPosition && (
        <CanvasLongPressIndicator position={radialMenuHoldPosition} />
      )}
      {radialMenuPosition && (
        <CanvasRadialMenu position={radialMenuPosition} onClose={closeRadialMenu} />
      )}

      {/* Connection drop menu */}
      <ConnectionMenu
        visible={connectionMenu.visible}
        position={connectionMenu.position}
        sourceNodeType={connectionMenu.sourceNodeType}
        direction={connectionMenu.direction}
        sourceNode={sourceNode}
        menuRef={connectionMenuRef}
        onSelect={handleConnectionMenuSelect}
        connectionMenuMap={connectionMenuMap}
      />

      {/* Context menu */}
      <CanvasContextMenu
        visible={ctxMenu.visible}
        position={ctxMenu.position}
        hoverMenu={ctxMenu.hoverMenu}
        menuRef={ctxMenuRef}
        submenuRef={ctxSubmenuRef}
        onAddNode={addNodeAtCtxPos}
        onAddPluginNode={addPluginNodeAtCtxPos}
        pluginNodes={pluginNodes}
        onUndo={handleCtxUndo}
        onRedo={handleCtxRedo}
        onPaste={handleCtxPaste}
        onCreateFolder={handleCtxCreateFolder}
        onDelete={handleCtxDelete}
        onCopyNodes={handleCtxCopyNodes}
        onCopyFiles={handleCtxCopyFiles}
        hasSelection={ctxHasSelection}
        onOpenProjectDir={handleCtxOpenProjectDir}
        onShowSubmenu={showSubmenu}
        onHideSubmenu={hideSubmenu}
      />

      {/* Node context menu */}
      <NodeContextMenu
        visible={nodeCtxMenu.visible}
        position={nodeCtxMenu.position}
        menuRef={nodeCtxMenuRef}
        onCopy={handleCopy}
        onCut={handleCut}
        hasTextSelection={nodeCtxMenu.textSelection != null}
        onCopyText={handleCopyText}
        onCutText={handleCutText}
        onDuplicate={handleDuplicate}
        onToggleLock={handleToggleLock}
        isLocked={isNodeLocked}
        onConvertImage={showImageConversion ? handleConvertImage : undefined}
        imageConversionLabel={imageConversionLabel}
        onAddToCharacter={showAddToCharacter ? handleAddToCharacter : undefined}
        onUngroup={isGroupNode ? handleUngroup : undefined}
        onOpenGroupFolder={isGroupNode ? handleOpenGroupFolder : undefined}
        onDelete={handleDelete}
        onShowInFolder={showInFolder ? handleShowInFolder : undefined}
        onSaveAs={showSaveAs ? handleSaveAs : undefined}
        onOpenInPS={showOpenInPS ? handleOpenInPS : undefined}
        onEditVideo={showEditVideo ? handleEditVideo : undefined}
        editVideoLabel={editVideoLabel}
        onOpenInJianying={showOpenInVideoEditor ? handleOpenInJianying : undefined}
        onOpenInPremiere={showOpenInVideoEditor ? handleOpenInPremiere : undefined}
        onCopyMedia={showCopyMedia ? handleCopyMedia : undefined}
        copyMediaLabel={copyMediaLabel}
        pluginTools={pluginTools}
        onPluginTool={handlePluginTool}
      />

      {characterCaptureNodeId ? createPortal(
        <Suspense fallback={null}>
          <CharacterAssetDialog
            isOpen
            sourceNodeId={characterCaptureNodeId}
            onClose={closeCharacterCapture}
          />
        </Suspense>,
        document.body,
      ) : null}

      {/* Multi-select toolbar */}
      <MultiSelectToolbar />
    </div>

    {/* 閹锋牕鍙嗙€诡偅鐗搁敍姘冲Ν閻愮瀵栭崶鏉戝敶閺勫墽銇氱紓鈺冩殣閸ユ拝绱濈粚鐑樼壐娑撳﹤鈧偓鏋╃悰銊с仛閸欘垱鏂佺純?*/}
    {dropGhost && createPortal(
      <div
        className={`sb-drag-ghost${dropGhost.canDrop ? '' : ' sb-drag-ghost--over-storyboard'}`}
        style={{ left: dropGhost.x, top: dropGhost.y }}
      >
        <div className="sb-drag-ghost-clip">
          <img src={dropGhost.url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      </div>,
      document.body,
    )}
    </ResizeSnapContext.Provider>
  );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
