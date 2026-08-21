import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AiInsights from './AiInsights';
import { aiApi } from '../services/api';

vi.mock('../services/api', async () => {
  const actual = await vi.importActual('../services/api');
  return { ...actual, aiApi: { ask: vi.fn() } };
});

describe('AiInsights page', () => {
  it('renders the question form and example prompts', () => {
    render(<AiInsights />);

    expect(screen.getByPlaceholderText(/ask about sales/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^ask$/i })).toBeInTheDocument();
    expect(screen.getByText('Which products are at risk of stockout?')).toBeInTheDocument();
  });

  it('submits a question and renders the grounded answer', async () => {
    aiApi.ask.mockResolvedValue({
      answer: 'Widget A has 2 days of cover and is at HIGH risk.',
      intent: 'stockout',
      grounded: true,
    });
    const user = userEvent.setup();

    render(<AiInsights />);

    await user.type(screen.getByPlaceholderText(/ask about sales/i), 'Which products are at risk?');
    await user.click(screen.getByRole('button', { name: /^ask$/i }));

    expect(await screen.findByText(/Widget A has 2 days of cover/)).toBeInTheDocument();
    expect(aiApi.ask).toHaveBeenCalledWith('Which products are at risk?');
  });

  it('shows an error message when the assistant call fails', async () => {
    aiApi.ask.mockRejectedValue(new Error('AI provider is unavailable'));
    const user = userEvent.setup();

    render(<AiInsights />);

    await user.click(screen.getByText('What is total sales this month?'));

    expect(await screen.findByRole('alert')).toHaveTextContent('AI provider is unavailable');
  });
});
