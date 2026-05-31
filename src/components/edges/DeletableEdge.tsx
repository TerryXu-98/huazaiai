import { useRef, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import { X } from 'lucide-react';

export default function DeletableEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    style,
    markerEnd,
    selected,
    data,
  } = props;
  const { setEdges } = useReactFlow();
  const flowActive = !!(data as any)?.flowActive;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [hover, setHover] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const show = () => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setHover(true);
  };
  const scheduleHide = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setHover(false), 80);
  };

  const visible = hover || !!selected;

  const handleCut = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEdges((eds) => eds.filter((ed) => ed.id !== id));
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerEnd={markerEnd}
        interactionWidth={24}
      />
      {flowActive && (
        <path
          d={edgePath}
          fill="none"
          className="huazai-edge-flow-path"
          pointerEvents="none"
        />
      )}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        style={{ cursor: 'pointer' }}
        pointerEvents="stroke"
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: visible ? 'all' : 'none',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.15s, transform 0.15s',
            zIndex: 1000,
          }}
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
        >
          <button
            type="button"
            onClick={handleCut}
            onMouseDown={(e) => e.stopPropagation()}
            title="断开连线"
            aria-label="断开连线"
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--hz-surface-strong, #fff)',
              border: '1px solid var(--hz-danger, #ef4444)',
              color: 'var(--hz-danger, #ef4444)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
              padding: 0,
              transition: 'transform 0.15s, background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--hz-danger, #ef4444)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--hz-accent-ink, #fff)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--hz-surface-strong, #fff)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--hz-danger, #ef4444)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            }}
          >
            <X size={13} strokeWidth={1.8} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
