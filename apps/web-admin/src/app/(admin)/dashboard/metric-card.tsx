import clsx from 'clsx';

type Tone = 'neutral' | 'danger' | 'warning' | 'success';

export function MetricCard({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: number | string;
  tone?: Tone;
  hint?: string;
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-accentDanger'
      : tone === 'warning'
        ? 'text-accent'
        : tone === 'success'
          ? 'text-accentSuccess'
          : 'text-text';
  return (
    <div className="card">
      <div className="text-xs text-textMuted">{label}</div>
      <div className={clsx('mt-2 text-2xl font-semibold tabular-nums', toneClass)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-textMuted">{hint}</div>}
    </div>
  );
}
