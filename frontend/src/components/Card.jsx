export default function Card({ title, children, className = '' }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {title && <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>}
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = 'default' }) {
  const toneClasses = {
    default: 'text-slate-900',
    danger: 'text-red-600',
    warning: 'text-amber-600',
    success: 'text-emerald-600',
  };
  const testId = `stat-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p data-testid={testId} className={`mt-2 text-2xl font-semibold ${toneClasses[tone] || toneClasses.default}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
