import { createClient } from "./server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

describe("createClient", () => {
  const mockCreateServerClient = createServerClient as jest.MockedFunction<typeof createServerClient>;
  const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

  let mockCookieStore: any;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-url.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY = "mock-anon-key";

    mockCookieStore = {
      getAll: jest.fn().mockReturnValue([{ name: "test-cookie", value: "test-value" }]),
      set: jest.fn(),
    };

    // @ts-ignore
    mockCookies.mockResolvedValue(mockCookieStore);
    mockCreateServerClient.mockReturnValue({} as any);
  });

  afterAll(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY;
  });

  it("should create a server client with correct environment variables", async () => {
    await createClient();

    expect(mockCreateServerClient).toHaveBeenCalledWith(
      "https://mock-url.supabase.co",
      "mock-anon-key",
      expect.any(Object)
    );
  });

  it("should provide cookie methods to the client options", async () => {
    await createClient();

    const optionsArg = mockCreateServerClient.mock.calls[0][2] as any;
    expect(optionsArg).toBeDefined();
    expect(optionsArg.cookies).toBeDefined();
    expect(typeof optionsArg.cookies.getAll).toBe("function");
    expect(typeof optionsArg.cookies.setAll).toBe("function");
  });

  it("getAll should return cookies from the cookie store", async () => {
    await createClient();

    const optionsArg = mockCreateServerClient.mock.calls[0][2] as any;
    const result = optionsArg.cookies.getAll();

    expect(mockCookieStore.getAll).toHaveBeenCalled();
    expect(result).toEqual([{ name: "test-cookie", value: "test-value" }]);
  });

  it("setAll should set cookies correctly in the cookie store", async () => {
    await createClient();

    const optionsArg = mockCreateServerClient.mock.calls[0][2] as any;
    const cookiesToSet = [
      { name: "cookie1", value: "value1", options: { path: "/" } },
      { name: "cookie2", value: "value2", options: { path: "/app" } },
    ];

    optionsArg.cookies.setAll(cookiesToSet);

    expect(mockCookieStore.set).toHaveBeenCalledTimes(2);
    expect(mockCookieStore.set).toHaveBeenNthCalledWith(1, "cookie1", "value1", { path: "/" });
    expect(mockCookieStore.set).toHaveBeenNthCalledWith(2, "cookie2", "value2", { path: "/app" });
  });

  it("setAll should catch and ignore errors when setting cookies fails (Server Component check)", async () => {
    mockCookieStore.set.mockImplementation(() => {
      throw new Error("Setting cookie from Server Component");
    });

    await createClient();

    const optionsArg = mockCreateServerClient.mock.calls[0][2] as any;
    const cookiesToSet = [{ name: "cookie1", value: "value1", options: { path: "/" } }];

    // Should not throw
    expect(() => optionsArg.cookies.setAll(cookiesToSet)).not.toThrow();
  });
});
