import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/firebaseAdmin";
import { publishRealtime } from "@/lib/realtime";
import { publishEvent } from "@/lib/kafka";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// cron: marks dispatched orders as delivered after 5 minutes
export async function GET(req: NextRequest) {
  const session = await auth();
  const secret = req.nextUrl.searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;

  // require session OR valid cron secret
  const hasValidSecret = cronSecret && secret === cronSecret;

  if (!session?.user && !hasValidSecret) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = Date.now();
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    const allOrdersSnap = await adminDB
      .collectionGroup("orders")
      .get();

    const dispatchedDocs = allOrdersSnap.docs.filter((doc) => {
      const data = doc.data() as { value?: { status?: string } };
      return data.value?.status === "Dispatched";
    });

    if (dispatchedDocs.length === 0) {
      return NextResponse.json({ success: true, delivered: 0, message: "No dispatched orders found" });
    }

    const batch = adminDB.batch();
    const deliveredOrders: { orderId: string; email: string }[] = [];

    for (const doc of dispatchedDocs) {
      const data = doc.data() as {
        value?: {
          status?: string;
          dispatched_at?: string;
        };
      };

      const dispatchedAt = data.value?.dispatched_at;
      if (!dispatchedAt) continue;

      const dispatchedTime = new Date(dispatchedAt).getTime();
      const elapsed = now - dispatchedTime;

      if (elapsed < FIVE_MINUTES_MS) continue;

      const email = doc.ref.parent.parent?.id || "";
      const orderId = doc.id;

      batch.update(doc.ref, {
        "value.status": "Delivered",
        "value.delivered_at": new Date().toISOString(),
      });

      deliveredOrders.push({ orderId, email });
    }

    if (deliveredOrders.length === 0) {
      return NextResponse.json({ success: true, delivered: 0, message: "No orders ready for delivery yet" });
    }

    await batch.commit();

    await Promise.allSettled(
      deliveredOrders.map(async ({ orderId, email }) => {
        try {
          await publishRealtime({ type: "order:delivered", data: { email, orderId } });
          await publishRealtime({ type: "analytics:updated", data: {} });
        } catch { /* non-critical */ }

        try {
          await publishEvent("order-delivered", {
            orderId,
            email,
            status: "Delivered",
            timestamp: new Date().toISOString(),
          });
        } catch { /* non-critical */ }
      })
    );

    return NextResponse.json({
      success: true,
      delivered: deliveredOrders.length,
      orders: deliveredOrders,
      message: `${deliveredOrders.length} order(s) marked as Delivered`,
    });
  } catch (error) {
    console.error("[Auto-Deliver Cron] Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}