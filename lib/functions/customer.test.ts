import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCustomers } from './customer';
import { createClient } from '@/lib/supabase/client';

// Mock the Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

describe('getCustomers', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn(),
    };

    (createClient as any).mockReturnValue(mockSupabase);
  });

  it('should return an array of customers when the fetch is successful', async () => {
    const mockCustomers = [
      { id: '1', name: 'Customer A' },
      { id: '2', name: 'Customer B' },
    ];

    mockSupabase.select.mockResolvedValueOnce({
      data: mockCustomers,
      error: null,
    });

    const result = await getCustomers();

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(mockSupabase.from).toHaveBeenCalledWith('customers');
    expect(mockSupabase.select).toHaveBeenCalledWith('*');
    expect(result).toEqual(mockCustomers);
  });

  it('should return an empty array and log an error when the fetch fails', async () => {
    const mockError = new Error('Database error');

    // Mock console.error and console.log to keep test output clean
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockSupabase.select.mockResolvedValueOnce({
      data: null,
      error: mockError,
    });

    const result = await getCustomers();

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(mockSupabase.from).toHaveBeenCalledWith('customers');
    expect(mockSupabase.select).toHaveBeenCalledWith('*');
    expect(result).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching customers:', mockError);
    expect(consoleLogSpy).toHaveBeenCalledWith(mockError);

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
});
