export default function EmptyState({ title = 'Nothing here yet', message }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {message && <p className="mt-1 text-sm text-slate-500">{message}</p>}
    </div>
  );
}
