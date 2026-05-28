// 自定义边组件:鼠标悬停时在中点显示剪刀按钮,点击可断开连线
import { useRef, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import { Scissors } from 'lucide-react';

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
  } = props;
  const { setEdges } = useReactFlow();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // 用延迟关闭避免鼠标从 path 切到按钮的瞬间闪烁
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
      {/* 透明的加宽 hit area,捕捉鼠标 hover (BaseEdge 的 interactionWidth 已自带,这里再补一层,确保事件有响应) */}
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
            title="点击断开连线"
            aria-label="断开连线"
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: '#fff',
              border: '1.5px solid #ef4444',
              color: '#ef4444',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
              padding: 0,
              transition: 'transform 0.15s, background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#ef4444';
              (e.currentTarget as HTMLButtonElement).style.color = '#fff';
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.15)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#fff';
              (e.currentTarget as HTMLButtonElement).style.color = '#ef4444';
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            }}
          >
            <Scissors size={14} strokeWidth={2.2} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
