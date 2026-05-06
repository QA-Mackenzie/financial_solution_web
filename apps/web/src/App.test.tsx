import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

function mockJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

describe('App', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/login');
  });

  it('mostra a tela de login para visitantes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ session: null }),
    );

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Entre na plataforma' }),
      ).toBeInTheDocument();
    });
  });

  it('renderiza o dashboard quando existe sessao', async () => {
    window.history.pushState({}, '', '/app');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({
        session: {
          user: {
            id: '92f49d09-7671-4518-bd08-c566ce68636a',
            name: 'Alexandre Demo',
            email: 'alexandre@example.com',
          },
          issuedAt: '2026-01-01T12:00:00.000Z',
        },
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: 'Base web pronta para evoluir os modulos financeiros.',
        }),
      ).toBeInTheDocument();
    });
  });
});