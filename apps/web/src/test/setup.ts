import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { queryClient } from '../lib/query-client';

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.restoreAllMocks();
});
