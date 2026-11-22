import type {VisualPointer} from './config';

const PALETTE = ['#0ea5e9', '#f97316', '#10b981', '#a855f7', '#ec4899'];

export function PointerOverlay({
  stageEl,
  pointers,
}: {
  stageEl: HTMLDivElement | null;
  pointers: readonly VisualPointer[];
}) {
  if (!stageEl || pointers.length === 0) return null;
  const rect = stageEl.getBoundingClientRect();
  const pts = pointers.map(p => ({...p, lx: p.x - rect.left, ly: p.y - rect.top}));
  const cx = pts.reduce((s, p) => s + p.lx, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.ly, 0) / pts.length;
  const spanRadius =
    pts.length >= 2
      ? Math.hypot(
          (pts.reduce((s, p) => s + Math.abs(p.lx - cx), 0) / pts.length) * 2,
          (pts.reduce((s, p) => s + Math.abs(p.ly - cy), 0) / pts.length) * 2
        ) / 2
      : 0;

  return (
    <svg
      id="pointerOverlay"
      aria-hidden="true"
      viewBox={`0 0 ${Math.max(1, rect.width)} ${Math.max(1, rect.height)}`}
    >
      {pts.length >= 2 && (
        <>
          {pts.map(p => (
            <line
              key={`l-${p.id}`}
              x1={cx}
              y1={cy}
              x2={p.lx}
              y2={p.ly}
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeDasharray="4 4"
            />
          ))}
          <circle
            cx={cx}
            cy={cy}
            r={Math.max(4, spanRadius)}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.28"
          />
        </>
      )}
      <circle cx={cx} cy={cy} r="5" fill="currentColor" fillOpacity="0.65" />
      {pts.map(p => {
        const color = PALETTE[Math.abs(p.id) % PALETTE.length];
        return (
          <g key={p.id}>
            <circle
              cx={p.lx}
              cy={p.ly}
              r={18 + p.pressure * 10}
              fill={color}
              fillOpacity="0.2"
              stroke={color}
              strokeWidth="2"
            />
            <text x={p.lx + 22} y={p.ly - 10} fill={color} fontSize="11" fontFamily="monospace">
              #{p.id} {p.type}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
