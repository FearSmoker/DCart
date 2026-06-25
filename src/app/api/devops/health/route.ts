import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export const revalidate = 0;

export async function GET() {
  const session = await auth();
  const isAdmin =
    session?.user?.email === process.env.ADMIN_EMAIL ||
    session?.user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  if (!isAdmin) {
    return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
  }

  const pythonUrl = process.env.RECOMMENDATION_SERVICE_URL || "http://127.0.0.1:8000";

  // ── check each service in parallel ──
  const [redisOk, aiOk, sanityFlagged] = await Promise.all([
    // redis: ping
    redis.ping().then(() => true).catch(() => false),

    // ai service: get /health with 2s timeout
    fetch(`${pythonUrl}/health`, { signal: AbortSignal.timeout(2000) })
      .then((r) => r.ok)
      .catch(() => false),

    // sanity: check unavailability flag in redis
    redis.get("dcart:sanity_unavailable").then((v) => v === "1").catch(() => false),
  ]);

  const services = [
    {
      name: "Next.js App",
      port: "3000",
      status: "Running",
      uptime: "Active",
      cpu: null,
      memory: null,
    },
    {
      name: "AI / Recommendation Service",
      port: "8000",
      status: aiOk ? "Running" : "Stopped",
      uptime: aiOk ? "Active" : "Offline",
      cpu: null,
      memory: null,
    },
    {
      name: "Redis Cache",
      port: "6379",
      status: redisOk ? "Running" : "Stopped",
      uptime: redisOk ? "Active" : "Offline",
      cpu: null,
      memory: null,
    },
    {
      name: "Sanity CMS",
      port: "443",
      status: sanityFlagged ? "Stopped" : "External",
      uptime: sanityFlagged ? "Dataset unavailable" : "External SLA",
      cpu: null,
      memory: null,
    },
    {
      name: "Stripe Payments",
      port: "443",
      status: process.env.STRIPE_SECRET_KEY ? "External" : "Stopped",
      uptime: process.env.STRIPE_SECRET_KEY ? "External SLA" : "No API key",
      cpu: null,
      memory: null,
    },
    {
      name: "Cloudinary CDN",
      port: "443",
      status: process.env.CLOUDINARY_CLOUD_NAME ? "External" : "Stopped",
      uptime: process.env.CLOUDINARY_CLOUD_NAME ? "External SLA" : "No config",
      cpu: null,
      memory: null,
    },
    {
      name: "Firebase / Firestore",
      port: "443",
      status: process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? "External" : "Stopped",
      uptime: process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? "External SLA" : "No config",
      cpu: null,
      memory: null,
    },
  ];

  return NextResponse.json({ success: true, services, checkedAt: new Date().toISOString() });
}
