import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateSession } from './middleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const mocks = vi.hoisted(() => {
  return {
    hasEnvVars: true,
    mockGetClaims: vi.fn(),
  };
});

// Mock the utils to control hasEnvVars
vi.mock('../utils', () => ({
  get hasEnvVars() {
    return mocks.hasEnvVars;
  }
}));

// Mock Next.js Server Request and Response
vi.mock('next/server', () => {
  return {
    NextRequest: class {
      url: string;
      nextUrl: { pathname: string; clone: () => any };
      cookies: { getAll: () => any[]; set: () => void };

      constructor(url: string) {
        this.url = url;
        const parsedUrl = new URL(url);
        this.nextUrl = {
          pathname: parsedUrl.pathname,
          clone: vi.fn().mockReturnValue({ pathname: parsedUrl.pathname, href: parsedUrl.href })
        };
        this.cookies = {
          getAll: vi.fn().mockReturnValue([]),
          set: vi.fn()
        };
      }
    },
    NextResponse: {
      next: vi.fn().mockImplementation(({ request }) => ({
        request,
        cookies: {
          setAll: vi.fn(),
          set: vi.fn(),
          getAll: vi.fn().mockReturnValue([])
        },
        status: 200,
      })),
      redirect: vi.fn().mockImplementation((url) => ({
        url,
        status: 307, // Standard temporary redirect status
      })),
    }
  };
});

// Mock Supabase
vi.mock('@supabase/ssr', () => {
  return {
    createServerClient: vi.fn().mockImplementation(() => ({
      auth: {
        getClaims: mocks.mockGetClaims
      }
    })),
  };
});

describe('updateSession middleware', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY = 'anon-key';
    mocks.hasEnvVars = true; // reset to default
  });

  it('skips processing if env vars are missing', async () => {
    mocks.hasEnvVars = false; // Override for this test
    const request = new NextRequest('http://localhost:3000/some-path');

    const response = await updateSession(request);

    expect(createServerClient).not.toHaveBeenCalled();
    expect(response.status).toBe(200); // the response returned from NextResponse.next()
  });

  it('creates supabase client and sets up cookie handlers', async () => {
    mocks.mockGetClaims.mockResolvedValue({ data: { claims: null } });
    const request = new NextRequest('http://localhost:3000/some-path');

    await updateSession(request);

    expect(createServerClient).toHaveBeenCalledWith(
      'http://localhost',
      'anon-key',
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        })
      })
    );
  });

  describe('cookie handling inside supabase client setup', () => {
     it('handles cookies correctly when setAll is called', async () => {
       mocks.mockGetClaims.mockResolvedValue({ data: { claims: null } });

       const mockCookieSet = vi.fn();
       // Temporarily overwrite request mock specifically for this test
       const request = new NextRequest('http://localhost:3000/some-path');
       request.cookies.set = mockCookieSet;

       // capture the options passed to createServerClient
       let capturedOptions: any;
       vi.mocked(createServerClient).mockImplementationOnce((url, key, options) => {
         capturedOptions = options;
         return { auth: { getClaims: mocks.mockGetClaims } } as any;
       });

       await updateSession(request);

       expect(capturedOptions).toBeDefined();

       // test setAll
       capturedOptions.cookies.setAll([{ name: 'test-cookie', value: '123' }]);
       expect(mockCookieSet).toHaveBeenCalledWith('test-cookie', '123');

       // The second iteration inside setAll updates the response cookies
       // Next.js response cookies are mocked inside NextResponse.next()
     });
  });

  describe('Route handling and Authentication', () => {

    it('allows access to root path ("/") without authentication', async () => {
      mocks.mockGetClaims.mockResolvedValue({ data: { claims: null } });
      const request = new NextRequest('http://localhost:3000/');

      const response = await updateSession(request);

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('allows access to auth paths ("/auth/*") without authentication', async () => {
      mocks.mockGetClaims.mockResolvedValue({ data: { claims: null } });
      const request = new NextRequest('http://localhost:3000/auth/login');

      const response = await updateSession(request);

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('allows temporary debug access to dashboard paths ("/dashboard/*") without authentication', async () => {
      mocks.mockGetClaims.mockResolvedValue({ data: { claims: null } });
      const request = new NextRequest('http://localhost:3000/dashboard/settings');

      const response = await updateSession(request);

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('redirects to "/auth/login" when accessing a protected route without authentication', async () => {
      mocks.mockGetClaims.mockResolvedValue({ data: { claims: null } });
      const request = new NextRequest('http://localhost:3000/protected-page');

      const response = await updateSession(request);

      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectCallArg = vi.mocked(NextResponse.redirect).mock.calls[0][0] as any;
      expect(redirectCallArg.pathname).toBe('/auth/login');
    });

    it('allows access to protected routes when authenticated', async () => {
      mocks.mockGetClaims.mockResolvedValue({ data: { claims: { sub: 'user-123' } } });
      const request = new NextRequest('http://localhost:3000/protected-page');

      const response = await updateSession(request);

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

  });

});
