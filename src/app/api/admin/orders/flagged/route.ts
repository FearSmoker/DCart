import { NextResponse } from "next/server";
import { adminDB } from "@/firebaseAdmin";
import { getSession } from "@/lib/manageSession";

export const revalidate = 0;

export async function GET() {
  try {
    const session = await getSession();
    // Use role-based check — role is authoritative (stored in JWT from Firestore)
    const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
    }

    // check for fraud
    const snapshot = await adminDB.collectionGroup("orders").get();
    const flaggedOrders = snapshot.docs
      .filter((doc) => {
        const data = doc.data() as { value?: { status?: string } };
        return data.value?.status === "Flagged Fraud";
      })
      .map((doc) => {
        const email = doc.ref.parent.parent?.id || "";
        return {
          id: doc.id,
          email,
          ...(doc.data() as Record<string, unknown>),
        };
      });

    // sort newest first
    flaggedOrders.sort((a, b) => {
      const ta = (a as { timestamp?: string }).timestamp || "";
      const tb = (b as { timestamp?: string }).timestamp || "";
      return tb.localeCompare(ta);
    });

    return NextResponse.json({ success: true, orders: flaggedOrders });
  } catch (error) {
    console.error("Failed to fetch flagged orders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch flagged orders" },
      { status: 500 }
    );
  }
}
