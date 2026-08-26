import { memo, useState, useRef, useCallback, useEffect, useId } from 'react';
import {
  BaseEdge,
  getBezierPath,
  getSmoothStepPath,
  getEdgeCenter,
  type EdgeProps,
} from '@xyflow/react';
import { Scissors } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const SMOOTHSTEP_TYPE = 'smoothstep';
const SCISSOR_WRAPPER = 36;
const HOVER_DELAY_MS = 300;
const FLOW_HALF_LENGTH = 36;
const FLOW_MASK_HALF_HEIGHT = 16;
const FLOW_MASK_MARGIN = 256;

interface ScissorHoverEdgeData {
  baseEdgeType?: string;
  selectedNodeFlow?: boolean;
}

function ScissorHoverEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerStart,
  markerEnd,
  style,
  interactionWidth,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  data,
}: EdgeProps) {
  const [showScissors, setShowScissors] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEdgesChange = useAppStore((s) => s.onEdgesChange);
  const flowId = useId().replace(/:/g, '');
  const edgeData = data as ScissorHoverEdgeData | undefined;

  const pathParams = {
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  };

  const baseType = edgeData?.baseEdgeType;
  const [edgePath, labelX, labelY] = baseType === SMOOTHSTEP_TYPE
    ? getSmoothStepPath(pathParams)
    : getBezierPath(pathParams);

  const [centerX, centerY] = getEdgeCenter(pathParams);

  const handleMouseEnter = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShowScissors(true);
    }, HOVER_DELAY_MS);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShowScissors(false);
  }, []);

  const handleDelete = useCallback(() => {
    onEdgesChange([{ id, type: 'remove' }]);
  }, [id, onEdgesChange]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const half = SCISSOR_WRAPPER / 2;

  const showFlow = edgeData?.selectedNodeFlow === true;

  const gradientId = `scissor-edge-flow-gradient-${flowId}`;
  const maskId = `scissor-edge-flow-mask-${flowId}`;
  const maskX = Math.min(sourceX, targetX) - FLOW_MASK_MARGIN;
  const maskY = Math.min(sourceY, targetY) - FLOW_MASK_MARGIN;
  const maskWidth = Math.abs(targetX - sourceX) + FLOW_MASK_MARGIN * 2;
  const maskHeight = Math.abs(targetY - sourceY) + FLOW_MASK_MARGIN * 2;

  return (
    <g
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="scissor-hover-edge-group"
    >
      <BaseEdge
        id={id}
        path={edgePath}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={interactionWidth}
        label={label}
        labelX={labelX}
        labelY={labelY}
        labelStyle={labelStyle}
        labelShowBg={labelShowBg}
        labelBgStyle={labelBgStyle}
        labelBgPadding={labelBgPadding}
        labelBgBorderRadius={labelBgBorderRadius}
      />

      {/** Selected-node flow animation overlay */}
      {showFlow && (
        <g className="scissor-edge-flow-group" aria-hidden="true">
          <defs>
            <linearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1={-FLOW_HALF_LENGTH}
              y1="0"
              x2={FLOW_HALF_LENGTH}
              y2="0"
            >
              <stop className="selected-node-edge-flow-stop selected-node-edge-flow-stop--edge" offset="0%" />
              <stop className="selected-node-edge-flow-stop selected-node-edge-flow-stop--shoulder" offset="22%" />
              <stop className="selected-node-edge-flow-stop selected-node-edge-flow-stop--center" offset="50%" />
              <stop className="selected-node-edge-flow-stop selected-node-edge-flow-stop--shoulder" offset="78%" />
              <stop className="selected-node-edge-flow-stop selected-node-edge-flow-stop--edge" offset="100%" />
            </linearGradient>
            <mask
              id={maskId}
              className="selected-node-edge-flow-mask"
              maskUnits="userSpaceOnUse"
              maskContentUnits="userSpaceOnUse"
              x={maskX}
              y={maskY}
              width={maskWidth}
              height={maskHeight}
            >
              <rect
                x={-FLOW_HALF_LENGTH}
                y={-FLOW_MASK_HALF_HEIGHT}
                width={FLOW_HALF_LENGTH * 2}
                height={FLOW_MASK_HALF_HEIGHT * 2}
                fill={`url(#${gradientId})`}
              >
                <animateMotion
                  path={edgePath}
                  dur="1600ms"
                  repeatCount="indefinite"
                  rotate="auto"
                />
              </rect>
            </mask>
          </defs>
          <path
            className="selected-node-edge-flow"
            d={edgePath}
            mask={`url(#${maskId})`}
          />
        </g>
      )}

      {/** Scissors delete button on hover */}
      {showScissors && (
        <foreignObject
          x={centerX - half}
          y={centerY - half}
          width={SCISSOR_WRAPPER}
          height={SCISSOR_WRAPPER}
          className="scissor-hover-edge-btn"
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div className="scissor-hover-edge-btn-inner" onClick={handleDelete} role="button" tabIndex={-1}>
            <Scissors size={18} />
          </div>
        </foreignObject>
      )}
    </g>
  );
}

export default memo(ScissorHoverEdge);
