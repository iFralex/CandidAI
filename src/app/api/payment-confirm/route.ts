// app/api/protected/user/route.js
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { doc, getDoc, updateDoc } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { clientConfig, serverConfig } from '@/config';
import { getApiRequestTokens, getTokens } from 'next-firebase-auth-edge';
import { cookies } from 'next/headers';

// app/api/hello/route.ts
export async function POST() {
  return new Response(JSON.stringify({ message: "OK" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}


export async function GET() {
  return new Response(JSON.stringify({ message: "OK" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
