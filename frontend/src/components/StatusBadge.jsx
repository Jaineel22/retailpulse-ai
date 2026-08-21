const TONE_CLASSES = {
  // Generic status tones
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-100 text-blue-800',
};

const KEY_TONE_MAP = {
  // Inventory status
  in_stock: 'green',
  low_stock: 'amber',
  out_of_stock: 'red',
  // Risk levels / severity
  low: 'green',
  medium: 'amber',
  high: 'red',
  // Order statuses
  pending: 'slate',
  confirmed: 'blue',
  processing: 'blue',
  shipped: 'blue',
  delivered: 'green',
  cancelled: 'red',
  // Integration/sync statuses
  active: 'green',
  inactive: 'slate',
  success: 'green',
  failed: 'red',
  running: 'blue',
};

export default function StatusBadge({ value }) {
  if (!value) return null;
  const key = String(value).toLowerCase();
  const tone = TONE_CLASSES[KEY_TONE_MAP[key]] || TONE_CLASSES.slate;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {String(value).replace(/_/g, ' ')}
    </span>
  );
}
