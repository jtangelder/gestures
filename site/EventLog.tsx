import {useState} from 'react';
import type {LogEntry} from './config';

export function EventLog({logs, onClear}: {logs: readonly LogEntry[]; onClear: () => void}) {
  const [filters, setFilters] = useState({lifecycle: true, move: false, dom: false});

  const text = logs
    .filter(e => filters[e.category])
    .slice(-120)
    .reverse()
    .map(
      e =>
        `#${String(e.seq).padStart(3, '0')} +${e.relMs.toFixed(0).padStart(4, ' ')}ms  ${e.name.padEnd(16, ' ')} ${e.summary}`
    )
    .join('\n');

  const toggle = (key: keyof typeof filters, label: string) => (
    <label key={key}>
      <input
        type="checkbox"
        checked={filters[key]}
        onChange={e => setFilters(f => ({...f, [key]: e.target.checked}))}
      />
      {label}
    </label>
  );

  return (
    <article>
      <header>
        <h2>Event Log ({logs.length})</h2>
        <div className="inline-row">
          {toggle('lifecycle', 'Lifecycle')}
          {toggle('move', 'Move')}
          {toggle('dom', 'DOM')}
          <button type="button" className="secondary outline" onClick={onClear}>
            Clear
          </button>
        </div>
      </header>
      <pre id="eventLog" tabIndex={0}>
        <code id="eventLogCode">
          {text || 'Waiting for gestures… Touch, drag, pinch, double-tap, or rotate above.'}
        </code>
      </pre>
    </article>
  );
}
