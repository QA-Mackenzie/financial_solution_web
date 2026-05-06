import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
            emailVerifiedAt: null,
          },
          expiresAt: '2026-01-08T12:00:00.000Z',
          issuedAt: '2026-01-01T12:00:00.000Z',
        },
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: 'Identidade, sessao segura e dominio compartilhado prontos.',
        }),
      ).toBeInTheDocument();
    });
  });

  it('mostra a tela de cadastro com o consentimento obrigatorio', async () => {
    window.history.pushState({}, '', '/cadastro');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ session: null }),
    );

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', {
          name: /li e aceito a politica de privacidade/i,
        }),
      ).toBeInTheDocument();
    });
  });

  it('mostra a tela de recuperacao de senha para visitantes', async () => {
    window.history.pushState({}, '', '/esqueci-senha');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ session: null }),
    );

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Recupere seu acesso' }),
      ).toBeInTheDocument();
    });
  });

  it('mostra a tela de redefinicao de senha para visitantes', async () => {
    window.history.pushState({}, '', '/redefinir-senha?token=preview-token');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ session: null }),
    );

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Defina uma nova senha' }),
      ).toBeInTheDocument();
    });
  });
});