import { NextResponse } from "next/server";
import { adminDB } from "@/firebaseAdmin";
import { getSession } from "@/lib/manageSession";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email;
    const snapshot = await adminDB
      .collection("users")
      .doc(email)
      .collection("orders")
      .get();

    const orders = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Record<string, unknown>),
    }));

    // sort newest first by timestamp
    orders.sort((a, b) => {
      const ta = (a as { timestamp?: string }).timestamp || "";
      const tb = (b as { timestamp?: string }).timestamp || "";
      return tb.localeCompare(ta);
    });

    return NextResponse.json({ success: true, orders });
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
