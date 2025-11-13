import { vi } from 'vitest';

// Mock chrome API globally for all tests
global.chrome = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
    },
  },
} as any;

global.browser = undefined as any;
