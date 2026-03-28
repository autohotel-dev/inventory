import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from './client';
import { createBrowserClient } from '@supabase/ssr';

// Mock the @supabase/ssr module
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(),
}));

describe('createClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env and mocks before each test
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore process.env after each test
    process.env = originalEnv;
  });

  it('should call createBrowserClient with correct environment variables', () => {
    // Arrange
    const mockUrl = 'https://test-project.supabase.co';
    const mockKey = 'test-anon-key';

    process.env.NEXT_PUBLIC_SUPABASE_URL = mockUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY = mockKey;

    const mockSupabaseClient = { auth: {} }; // Dummy client object
    vi.mocked(createBrowserClient).mockReturnValue(mockSupabaseClient as any);

    // Act
    const client = createClient();

    // Assert
    expect(createBrowserClient).toHaveBeenCalledTimes(1);
    expect(createBrowserClient).toHaveBeenCalledWith(mockUrl, mockKey);
    expect(client).toBe(mockSupabaseClient);
  });
});
