export default function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center" role="alert">
      <p className="text-sm font-medium text-red-800">{message || 'Something went wrong while loading this data.'}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      )}
    </div>
  );
}
