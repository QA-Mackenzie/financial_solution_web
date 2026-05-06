import { describe, expect, it } from 'vitest';

import { roundCurrency } from './roundCurrency';

describe('roundCurrency', () => {
  it('rounds values to two decimal places', () => {
    expect(roundCurrency(10.005)).toBe(10.01);
  });

  it('keeps negative values consistent', () => {
    expect(roundCurrency(-15.335)).toBe(-15.33);
  });
});
