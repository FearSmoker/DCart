import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Lightweight health check endpoint — no DB / auth dependencies.
// Used by Docker HEALTHCHECK, CI, and load-balancers.
export async function GET() {
  return NextResponse.json(
    { status: "ok", service: "nextjs", timestamp: new Date().toISOString() },
    { status: 200 }
  );
}
