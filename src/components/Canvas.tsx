/**
 * Canvas 鐢诲竷涓荤粍浠?鈥?React Flow 鐢诲竷鏍稿績锛岀鐞嗚妭鐐?杈规覆鏌撱€佹嫋鏀俱€佽繛绾裤€佸彸閿彍鍗曘€佺┖鐘舵€?
 */
import { lazy, Suspense, useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ReactFlow,
  Background,
  Controls,
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

// 鎳掑姞杞斤細鍏ㄦ櫙鑺傜偣寮曞叆 three锛堜綋绉ぇ鎴凤級锛岀敾甯冧笂鍑虹幇鍏ㄦ櫙鑺傜偣鏃舵墠鍔犺浇
const PanoramaNodeLazy = lazy(() => import('./nodes/PanoramaNode'));
function PanoramaNode(props: { id: string; data: BaseNodeData; selected?: boolean }) {
  return <Suspense fallback={null}><PanoramaNodeLazy {...props} /></Suspense>;
}

// 鎳掑姞杞斤細3D 瀵兼紨鍙拌妭鐐规寜闇€杩炴帴鏈湴 Tauri 鐙珛绐楀彛
const DirectorDeskNodeLazy = lazy(() => import('./nodes/DirectorDeskNode'));
function DirectorDeskNode(props: { id: string; data: BaseNodeData; selected?: boolean }) {
  return <Suspense fallback={null}><DirectorDeskNodeLazy {...props} /></Suspense>;
}

const CharacterAssetDialog = lazy(() => import('./CharacterAssetDialog'));

// 鈹€鈹€ Node types mapping 鈹€鈹€
/**
 * 缁欐瘡涓妭鐐圭粍浠跺寘涓€灞傞敊璇竟鐣岋細鍗曚釜鑺傜偣娓叉煋鎶涢敊锛堣剰鏁版嵁銆佸鍏ユ枃浠躲€佹棫鐗堣縼绉绘畫鐣欙級
 * 鍙檷绾ф垚涓€寮犲崰浣嶅崱锛岀敾甯冨叾浣欓儴鍒嗙户缁彲鐢ㄣ€?
 * 鍙湪妯″潡椤跺眰璋冪敤涓€娆?鈥斺€?React Flow 瑕佹眰 nodeTypes 涓庡叾涓殑缁勪欢韬唤淇濇寔绋冲畾銆?
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

// 鈹€鈹€ Stable ReactFlow props (hoisted to avoid new identities every render,
//    which makes React Flow re-run internal effects and drop frames on drag) 鈹€鈹€
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

// 鈹€鈹€ 浜や簰妯″紡棰勮锛堝喕缁撳璞★紝閬垮厤姣忔 render 浜х敓鏂拌韩浠斤紝瀵艰嚧 React Flow 鍐呴儴 effect 閲嶈窇銆佹嫋鎷芥帀甯э級鈹€鈹€
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
  panOnScrollMode: PanOnScrollMode.Free, // Free 鎵嶈兘鍏奸【 Shift+婊氳疆姘村钩骞崇Щ涓庢櫘閫氭粴杞瀭鐩村钩绉?
  panOnScrollSpeed: 0.5,
  zoomOnScroll: false,
  zoomOnPinch: true,
  zoomOnDoubleClick: false, // 鍏抽棴鍙屽嚮缂╂斁锛岄伩鍏嶄笌銆屽弻鍑荤┖鐧藉垱寤烘枃鏈妭鐐广€嶅啿绐?
  zoomActivationKeyCode: 'Control', // Ctrl+婊氳疆缂╂斁
  panOnDrag: PAN_ON_DRAG_CLASSIC,
  selectionOnDrag: false,
  selectionKeyCode: 'Shift', // Shift+宸﹂敭鎷栨嫿 鈫?妗嗛€?
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

// 鈹€鈹€ Snap lines overlay 鈹€鈹€
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
  const canvasNoteToolbarVisible = useAppStore((s) => s.config.canvasNoteToolbarVisible !== false);
  const interaction = interactionMode === 'classic' ? CLASSIC_INTERACTION : DEFAULT_INTERACTION;
  // 鍙抽敭 effect 鐢?ref 璇诲彇妯″紡锛岄伩鍏嶆妸 interactionMode 鍔犺繘 effect 渚濊禆鑰屽鑷寸洃鍚櫒閲嶆寕
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

  // 鑺傜偣杩涘満鍔ㄧ敾锛坱ranslateY锛変細璁?React Flow 鍦ㄦ寕杞界灛闂存祴寰楀亸绉荤殑 handle 閿氱偣骞剁紦瀛橈紝
  // 瀵艰嚧杩炵嚎璧锋鐐归敊浣嶃€傝繘鍦哄姩鐢荤粨鏉燂紙钀戒綅 translateY:0锛夊悗閲嶆柊娴嬮噺璇ヨ妭鐐圭殑 handle銆?
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
    // React Flow 浼氬拷鐣ュ彉鍥?undefined 鐨勫彈鎺у睘鎬э紝鍥犳缁撴潫缁樺浘鏃跺繀椤绘樉寮忔仮澶嶃€?
    nodesDraggable: !drawingActive,
    elementsSelectable: !drawingActive,
  }), [drawingActive, interaction]);

  // 鈹€鈹€ UI toggles (persisted to localStorage) 鈹€鈹€
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

  // 鈹€鈹€ Connection drop menu 鈹€鈹€
  const {
    menu: connectionMenu,
    menuRef: connectionMenuRef,
    handleConnectEnd,
    handleSelect: handleConnectionMenuSelect,
    connectionMenuMap,
    sourceNode,
  } = useConnectionDropMenu(smoothLine);

  // 鈹€鈹€ Node context menu 鈹€鈹€
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

  // 鈹€鈹€ Canvas context menu 鈹€鈹€
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

  // 鈹€鈹€ External clipboard paste (native paste event 鈫?DataTransfer) 鈹€鈹€
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

  // 鈹€鈹€ Fit view event (project switch / F key) 鈹€鈹€
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

  // 鈹€鈹€ Keep anchored overlays visible by panning the whole canvas 鈹€鈹€
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

  // 鈹€鈹€ Focus node events (history / Agent-created node batch) 鈹€鈹€
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

  // 鈹€鈹€ Node click 鈫?AI dialog 鈹€鈹€
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
        // 绗竴娆＄偣鍑诲厛璁?React Flow 瀹屾垚閫変腑锛涚浜屾鐐瑰嚮浼氬彇娑堝脊绐楀苟浜ょ粰 TextNode 鐨勫弻鍑荤紪杈戙€?
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

  // 鈹€鈹€ Selection sync 鈹€鈹€
  const onSelectionChange = useCallback(
    (changes: OnSelectionChangeParams) => {
      const sel = changes.nodes;
      const nonGroup = sel.filter((n) => n.type !== 'group');
      // 妗嗛€夊拷鐣ュ垎缁勮妭鐐癸細涓庡叾瀹冭妭鐐逛竴鍚岃閫変腑鏃讹紝store 閫夊尯鍓旈櫎鍒嗙粍锛堝垹闄?鍒嗙粍涓嶆尝鍙婂鍣級锛?
      // 鍗曠嫭鐐瑰嚮鍒嗙粍浠嶄繚鐣欙紙渚夸簬鍒犻櫎/瑙ｆ暎锛夈€俁F 瑙嗚鍘婚€夊湪 onSelectionEnd 澶勭悊銆?
      const next = nonGroup.length > 0 ? nonGroup : sel;
      setSelectedNodeIds(next.map((n) => n.id));
    },
    [setSelectedNodeIds],
  );

  // 妗嗛€夌粨鏉熷悗锛氳嫢鍒嗙粍鑺傜偣涓庡叾瀹冭妭鐐逛竴鍚岃妗嗕腑锛屽彇娑堝垎缁勮妭鐐圭殑閫変腑锛岄伩鍏嶉殢鍚庤涓€璧锋嫋鍔?
  const onSelectionEnd = useCallback(() => {
    clearGroupedSelection();
  }, [clearGroupedSelection]);

  // 鈹€鈹€ Node snap 鈹€鈹€
  const {
    snapLines,
    onNodeDragStart,
    applySnap,
    onNodeDragStop,
    onResizeStart,
    applyResizeSnap,
    onResizeStop,
  } = useNodeSnap();

  // 缂╂斁鍚搁檮妗ユ帴锛氱ǔ瀹氬紩鐢ㄩ€忎紶缁欒妭鐐瑰唴鐨?ResizeHandle锛堢粡 Context锛?
  const resizeSnapApi = useMemo(
    () => ({ onResizeStart, applyResizeSnap, onResizeStop }),
    [onResizeStart, applyResizeSnap, onResizeStop],
  );

  // 鎸変綇 Ctrl/鈱?寮€濮嬫嫋鎷?鈫?鍦ㄥ師浣嶅鍒朵竴涓妭鐐癸紙鎷栧姩鐨勪粛鏄師鑺傜偣锛岀瓑浜?鎷栧嚭涓€涓壇鏈?锛?
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

  // 浠呭湪绾垮瀷鍒囨崲鏃堕噸寤猴紝閬垮厤姣忓抚鏂板璞¤Е鍙?React Flow 鍐呴儴鏇存柊
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
            // 绗旇鐨勯€忔槑澶栨帴鐭╁舰涓嶈兘閬尅涓嬫柟鑺傜偣锛涘彲瑙佸唴瀹瑰湪 canvas-drawing.css 涓仮澶嶅懡涓€?
            pointerEvents: 'none' as const,
          },
        }
      : node);
  }, [draftNode, renderableGraph.nodes]);

  // 浠呮淳鐢熸覆鏌撶姸鎬侊紝涓嶆妸闅愯棌鍜岃妭鐐归€変腑鏁堟灉鍐欏洖鍙寔涔呭寲鐨勮竟鏁版嵁銆?
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

  // 鈹€鈹€ Node change handler 鈹€鈹€
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

      // 鎶婂惛闄勫悗鐨勪綅缃洿鎺ユ敞鍏?React Flow 鐨勫彉鏇寸绾?
      // 锛堟垚涓哄敮涓€鐪熺浉婧愶紝閬垮厤浜屾 setNodes 瑕嗙洊瀵艰嚧鐨勬紓绉?姗＄毊绛嬶級銆?
      // 娉ㄦ剰锛氭澗鎵嬮偅涓€甯?dragging=false 涔熻鍚搁檮锛屽惁鍒欎細寮瑰洖鍘熷钀界偣锛堜綅绉伙級銆?
      // applySnap 鍦ㄩ潪鎷栨嫿鏈燂紙dragCtx 涓虹┖锛夋槸鏃犲壇浣滅敤鐩撮€氾紝鏁呮棤闇€鍒ゆ柇 dragging銆?
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

      // Detect group node removals 鈥?convert to ungroup
      const removedIds = snapped
        .filter((c) => c.type === 'remove')
        .map((c) => c.id);

      // 蹇€熻矾寰勶細绾嫋鎷?閫夋嫨鍙樻洿锛堟棤鍒犻櫎锛夆€斺€?鐢ㄥ嚱鏁板紡鏇存柊锛屽缁堝熀浜庢渶鏂?
      // store.nodes锛岄伩鍏嶅揩閫熸嫋鍔ㄦ椂闂寘 nodes 杩囨湡瀵艰嚧鐨勬姈鍔ㄥ崱椤裤€?
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

  // 鈹€鈹€ 鎷栧叆瀹牸鍒嗛暅锛氳繘鍏ヨ妭鐐硅寖鍥存樉绀虹缉鐣ュ浘锛屽彧鏈夌┖鏍煎厑璁告斁缃?鈹€鈹€
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
   * 鍛戒腑鍒嗛暅琛ㄧ殑鐢婚潰鏍笺€?
   * 涓庡鏍间笉鍚岋紝宸茬粦瀹氱殑鏍煎瓙涔熸帴鍙楁斁缃€斺€旂洿鎺ユ崲缁戯紝姣斿厛瑙ｇ粦鍐嶆嫋涓€娆￠『鎵嬨€?
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

  // 鎸夐紶鏍囦綅缃懡涓鏍艰妭鐐逛笌鐪熷疄绌烘牸锛屽吋瀹圭缉鏀惧拰闈炲潎鍖€鑷畾涔夊鏍笺€?
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
      // 杩涘叆瀹牸鑺傜偣鍚庨殣钘忕湡瀹炶妭鐐癸紱绌烘牸涓婂€炬枩琛ㄧず鍙斁缃紝鍗犵敤鍖哄煙淇濇寔姘村钩銆?
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

      // 鍒嗛暅琛ㄧ敾闈㈡牸锛氬彧鍋氶珮浜紝涓嶉殣钘忚鎷栫殑鑺傜偣鈥斺€旂粦瀹氬悗瀹冧粛瑕佺暀鍦ㄧ敾甯冧笂
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

  // 鈹€鈹€ Auto group/ungroup on drag stop 鈹€鈹€
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
            color="var(--theme-hover)"
          />
        )}


        {/* Mini Map 鈥?interactive navigator, toggle with M key */}
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

        {/* Canvas Controls */}
        <Controls
          className="canvas-controls !bg-canvas-card !border-canvas-border !shadow-lg !rounded-xl overflow-hidden"
          showInteractive={false}
        />

        {/* 鎿嶄綔璁板綍 鈥?鎾ら攢 / 杩樺師 + 鍙洖婧殑鎿嶄綔鍒楄〃 */}
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

    {/* 鎷栧叆瀹牸锛氳妭鐐硅寖鍥村唴鏄剧ず缂╃暐鍥撅紝绌烘牸涓婂€炬枩琛ㄧず鍙斁缃?*/}
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
