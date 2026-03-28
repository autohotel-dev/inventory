import { getCustomerSales } from "./customer";
import { createClient } from "@/lib/supabase/client";

// Mock the createClient module
jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(),
}));

describe("getCustomerSales", () => {
  let mockSupabase: any;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create a chainable mock object to simulate Supabase API
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn(),
    };

    // Make createClient return our mock object
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it("should return customer sales data when successful", async () => {
    // Arrange
    const customerId = "cust-123";
    const mockSalesData = [
      { id: "sale-1", customer_id: customerId, total_amount: 100 },
      { id: "sale-2", customer_id: customerId, total_amount: 200 },
    ];

    // Setup the mock chain to return successful data
    mockSupabase.eq.mockResolvedValueOnce({
      data: mockSalesData,
      error: null,
    });

    // Act
    const result = await getCustomerSales(customerId);

    // Assert
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(mockSupabase.from).toHaveBeenCalledWith("sales_orders");
    expect(mockSupabase.select).toHaveBeenCalledWith("*");
    expect(mockSupabase.eq).toHaveBeenCalledWith("customer_id", customerId);
    expect(result).toEqual(mockSalesData);
  });

  it("should return an empty array and log error when supabase returns an error", async () => {
    // Arrange
    const customerId = "cust-error-456";
    const mockError = new Error("Database error");

    // Spy on console.error and console.log to prevent test output clutter and verify they are called
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    // Setup the mock chain to return an error
    mockSupabase.eq.mockResolvedValueOnce({
      data: null,
      error: mockError,
    });

    // Act
    const result = await getCustomerSales(customerId);

    // Assert
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(mockSupabase.from).toHaveBeenCalledWith("sales_orders");
    expect(mockSupabase.select).toHaveBeenCalledWith("*");
    expect(mockSupabase.eq).toHaveBeenCalledWith("customer_id", customerId);

    // Verify error handling
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching customer sales:", mockError);
    expect(consoleLogSpy).toHaveBeenCalledWith(mockError);
    expect(result).toEqual([]);

    // Cleanup
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
});
