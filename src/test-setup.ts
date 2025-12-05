import { vi } from 'vitest';

// Mock chrome API globally for all tests
global.chrome = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
    },
    onChanged: {
      addListener: vi.fn(),
    },
  },
} as any;

global.browser = undefined as any;
