import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AccessPage } from './AccessPage';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function renderAccessPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AccessPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AccessPage', () => {
  it('lista solicitacoes existentes e registra uma nova solicitacao LGPD', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const urlValue = input instanceof Request ? input.url : String(input);
        const pathname = new URL(urlValue).pathname;
        const method = (init?.method ?? 'GET').toUpperCase();

        if (pathname === '/api/v1/session') {
          return jsonResponse({
            session: {
              expiresAt: '2026-06-01T12:00:00.000Z',
              issuedAt: '2026-05-01T12:00:00.000Z',
              user: {
                email: 'alexandre@example.com',
                emailVerifiedAt: null,
                id: '92f49d09-7671-4518-bd08-c566ce68636a',
                name: 'Alexandre Demo',
              },
            },
          });
        }

        if (pathname === '/api/v1/privacy/requests' && method === 'GET') {
          return jsonResponse({
            snapshot: {
              requests: [
                {
                  id: 'c4851471-bf54-43da-bdd5-360f4ab6e9d0',
                  justification: 'Quero revisar o tratamento dos meus dados.',
                  requestType: 'anonymization',
                  requestedAt: '2026-05-10T12:00:00.000Z',
                  resolvedAt: null,
                  status: 'pending',
                },
              ],
            },
          });
        }

        if (pathname === '/api/v1/privacy/requests' && method === 'POST') {
          return jsonResponse(
            {
              request: {
                id: '3ed5f08d-8094-44ac-9119-f0d4af5fe8db',
                justification:
                  'Quero abrir um atendimento formal para encerrar meu cadastro.',
                requestType: 'erasure',
                requestedAt: '2026-05-11T12:00:00.000Z',
                resolvedAt: null,
                status: 'pending',
              },
            },
            201,
          );
        }

        return jsonResponse({});
      });

    renderAccessPage();

    expect(
      await screen.findByText('Quero revisar o tratamento dos meus dados.'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Tipo de solicitacao'), {
      target: {
        value: 'erasure',
      },
    });
    fireEvent.change(screen.getByLabelText('Contexto'), {
      target: {
        value: 'Quero abrir um atendimento formal para encerrar meu cadastro.',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar solicitacao' }));

    expect(
      await screen.findByText(/Solicitacao registrada\./i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/privacy/requests',
        expect.objectContaining({
          body: JSON.stringify({
            justification:
              'Quero abrir um atendimento formal para encerrar meu cadastro.',
            requestType: 'erasure',
          }),
          method: 'POST',
        }),
      );
    });
  });
});