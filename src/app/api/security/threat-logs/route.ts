import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export const revalidate = 0;

export async function GET() {
  try {
    const session = await auth();
    // Use role-based check — role is authoritative (stored in JWT from Firestore)
    const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
    }
    const logs = await redis.lrange("dcart:security:threat_logs", 0, -1);
    const parsedLogs = logs.map((logStr) => JSON.parse(logStr));

    return NextResponse.json({
      success: true,
      logs: parsedLogs,
    });
  } catch (error) {
    console.error("Failed to fetch threat logs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch threat logs" },
      { status: 500 }
    );
  }
}
