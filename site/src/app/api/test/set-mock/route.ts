import { NextRequest, NextResponse } from 'next/server';

// Use global to ensure the store is shared across all Next.js module instances
// (route handlers, server actions, server components may load modules in different contexts)
const g = global as typeof globalThis & { __playwright_mock_store__?: Map<string, unknown> };
if (!g.__playwright_mock_store__) {
  g.__playwright_mock_store__ = new Map<string, unknown>();
}
const mockStore = g.__playwright_mock_store__;

export function getTestMock(urlPath: string): unknown | null {
  if (process.env.NODE_ENV === 'production') return null;
  // Check for exact match first, then pattern match
  for (const [pattern, response] of mockStore.entries()) {
    if (urlPath === pattern || (pattern.endsWith('*') && urlPath.startsWith(pattern.slice(0, -1)))) {
      return response;
    }
  }
  return null;
}

export function setTestMock(urlPath: string, response: unknown): void {
  if (process.env.NODE_ENV === 'production') return;
  mockStore.set(urlPath, response);
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  const { pattern, response } = await request.json();
  mockStore.set(pattern, response);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  if (body.pattern) {
    mockStore.delete(body.pattern);
  } else {
    mockStore.clear();
  }
  return NextResponse.json({ success: true });
}
