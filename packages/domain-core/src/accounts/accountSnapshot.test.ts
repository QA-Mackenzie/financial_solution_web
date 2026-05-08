import { describe, expect, it } from 'vitest';

import { buildAccountsSnapshot } from './accountSnapshot';

describe('buildAccountsSnapshot', () => {
  it('separates active and archived accounts and sums the active balance', () => {
    const snapshot = buildAccountsSnapshot(
      [
        {
          id: '1',
          name: 'Conta corrente',
          type: 'checking',
          openingBalanceInCents: 125000,
          isArchived: false,
          archivedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: '2',
          name: 'Carteira antiga',
          type: 'cash',
          openingBalanceInCents: 5000,
          isArchived: true,
          archivedAt: '2026-01-10T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-10T00:00:00.000Z',
        },
      ],
      {
        '1': -25000,
        '2': 900,
      },
    );

    expect(snapshot.consolidatedBalanceInCents).toBe(100000);
    expect(snapshot.activeAccounts).toHaveLength(1);
    expect(snapshot.archivedAccounts).toHaveLength(1);
    expect(snapshot.activeAccounts[0]?.currentBalanceInCents).toBe(100000);
    expect(snapshot.archivedAccounts[0]?.currentBalanceInCents).toBe(5900);
  });
});
