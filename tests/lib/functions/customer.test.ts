import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCustomer, getCustomers, getCustomerSales } from '@/lib/functions/customer';
import { createClient } from '@/lib/supabase/client';

// Mock the Supabase client creation
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

describe('customer functions', () => {
  let mockSupabase: any;
  let createClientMock: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Spy on console methods to keep test output clean
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    createClientMock = createClient as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCustomer', () => {
    let mockEq: any;
    let mockSelect: any;
    let mockFrom: any;

    beforeEach(() => {
      // Setup the mock chain for getCustomer
      mockEq = {
        maybeSingle: vi.fn()
      };

      mockSelect = {
        eq: vi.fn().mockReturnValue(mockEq)
      };

      mockFrom = {
        select: vi.fn().mockReturnValue(mockSelect)
      };

      mockSupabase = {
        from: vi.fn().mockReturnValue(mockFrom)
      };

      createClientMock.mockReturnValue(mockSupabase);
    });

    it('should return customer data when API call is successful', async () => {
      // Setup mock data
      const mockCustomerData = { id: '123', name: 'John Doe', email: 'john@example.com' };

      // Configure mock resolution
      mockEq.maybeSingle.mockResolvedValue({ data: mockCustomerData, error: null });

      // Execute the function
      const result = await getCustomer('123');

      // Verify
      expect(createClientMock).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith('customers');
      expect(mockFrom.select).toHaveBeenCalledWith('*');
      expect(mockSelect.eq).toHaveBeenCalledWith('id', '123');
      expect(result).toEqual(mockCustomerData);
    });

    it('should return null when there is an error fetching the customer', async () => {
      // Setup mock error
      const mockError = new Error('Database error');

      // Configure mock resolution
      mockEq.maybeSingle.mockResolvedValue({ data: null, error: mockError });

      // Execute the function
      const result = await getCustomer('123');

      // Verify
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith('Error fetching customer:', mockError);
      expect(console.log).toHaveBeenCalledWith(mockError);
    });

    it('should return null when no customer is found (maybeSingle returns null data and null error)', async () => {
      // Configure mock resolution
      mockEq.maybeSingle.mockResolvedValue({ data: null, error: null });

      // Execute the function
      const result = await getCustomer('123');

      // Verify
      expect(result).toBeNull();
    });
  });

  describe('getCustomers', () => {
    let mockSelect: any;
    let mockFrom: any;

    beforeEach(() => {
      // Setup the mock chain for getCustomers
      // The select method returns the promise directly since there's no chaining
      mockSelect = vi.fn();

      mockFrom = {
        select: mockSelect
      };

      mockSupabase = {
        from: vi.fn().mockReturnValue(mockFrom)
      };

      createClientMock.mockReturnValue(mockSupabase);
    });

    it('should return customers data when API call is successful', async () => {
      // Setup mock data
      const mockCustomersData = [
        { id: '1', name: 'John' },
        { id: '2', name: 'Jane' }
      ];

      // Configure mock resolution
      mockSelect.mockResolvedValue({ data: mockCustomersData, error: null });

      // Execute the function
      const result = await getCustomers();

      // Verify
      expect(createClientMock).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith('customers');
      expect(mockFrom.select).toHaveBeenCalledWith('*');
      expect(result).toEqual(mockCustomersData);
    });

    it('should return empty array when there is an error fetching customers', async () => {
      // Setup mock error
      const mockError = new Error('Database error');

      // Configure mock resolution
      mockSelect.mockResolvedValue({ data: null, error: mockError });

      // Execute the function
      const result = await getCustomers();

      // Verify
      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalledWith('Error fetching customers:', mockError);
      expect(console.log).toHaveBeenCalledWith(mockError);
    });
  });

  describe('getCustomerSales', () => {
    let mockEq: any;
    let mockSelect: any;
    let mockFrom: any;

    beforeEach(() => {
      // Setup the mock chain for getCustomerSales
      mockEq = vi.fn();

      mockSelect = {
        eq: mockEq
      };

      mockFrom = {
        select: vi.fn().mockReturnValue(mockSelect)
      };

      mockSupabase = {
        from: vi.fn().mockReturnValue(mockFrom)
      };

      createClientMock.mockReturnValue(mockSupabase);
    });

    it('should return customer sales data when API call is successful', async () => {
      // Setup mock data
      const mockSalesData = [
        { id: '1', customer_id: '123', total: 100 },
        { id: '2', customer_id: '123', total: 200 }
      ];

      // Configure mock resolution
      mockEq.mockResolvedValue({ data: mockSalesData, error: null });

      // Execute the function
      const result = await getCustomerSales('123');

      // Verify
      expect(createClientMock).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith('sales_orders');
      expect(mockFrom.select).toHaveBeenCalledWith('*');
      expect(mockSelect.eq).toHaveBeenCalledWith('customer_id', '123');
      expect(result).toEqual(mockSalesData);
    });

    it('should return empty array when there is an error fetching customer sales', async () => {
      // Setup mock error
      const mockError = new Error('Database error');

      // Configure mock resolution
      mockEq.mockResolvedValue({ data: null, error: mockError });

      // Execute the function
      const result = await getCustomerSales('123');

      // Verify
      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalledWith('Error fetching customer sales:', mockError);
      expect(console.log).toHaveBeenCalledWith(mockError);
    });
  });
});
