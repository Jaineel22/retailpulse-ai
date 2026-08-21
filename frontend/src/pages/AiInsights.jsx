import { useState } from 'react';
import { aiApi } from '../services/api';

const EXAMPLE_QUESTIONS = [
  'Which products are at risk of stockout?',
  'Which vendors are performing poorly?',
  'What are the biggest sales anomalies?',
  'What are the current inventory risks?',
  'What is total sales this month?',
];

export default function AiInsights() {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submitQuestion(q) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError('');
    try {
      const result = await aiApi.ask(trimmed);
      setHistory((prev) => [...prev, { question: trimmed, ...result }]);
      setQuestion('');
    } catch (err) {
      setError(err.message || 'The AI assistant could not answer that question right now.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    submitQuestion(question);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Insights</h1>
        <p className="text-sm text-slate-500">
          Ask questions about RetailPulse operational data. Answers are grounded only in data retrieved from the backend — the
          assistant never invents numbers and never accesses the database directly.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => submitQuestion(q)}
            disabled={loading}
            className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="min-h-[200px] space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        {history.length === 0 && !loading && (
          <p className="text-sm text-slate-400">Ask a question above to get started.</p>
        )}
        {history.map((entry, i) => (
          <div key={i} className="space-y-1 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
            <p className="text-sm font-medium text-slate-800">You asked: {entry.question}</p>
            <p className="text-sm text-slate-600">{entry.answer}</p>
            {!entry.grounded && <p className="text-xs italic text-amber-600">This question didn't match a supported data area.</p>}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
            Thinking…
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about sales, inventory, vendors, anomalies, or forecasts…"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
