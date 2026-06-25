import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { adminDB } from "@/firebaseAdmin";

export const revalidate = 0;

export async function GET() {
  try {
    const session = await auth();
    // Use role-based check — role is authoritative (stored in JWT from Firestore)
    const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    const usersSnap = await adminDB.collection("users").get();
    
    const consumers: Array<{ name: string; email: string }> = [];
    const sellers: Array<{ name: string; email: string; storeName?: string; status?: string }> = [];

    usersSnap.docs.forEach((doc) => {
      const data = doc.data();
      const user = {
        name: data.name || "N/A",
        email: data.email || doc.id,
      };

      if (data.role === "seller") {
        sellers.push({
          ...user,
          status: data.sellerStatus || "pending",
        });
      } else if (data.role === "consumer") {
        consumers.push(user);
      } else if (data.role === "admin") {
        // exclude admin or count differently? let's...
      } else {
        // fallback default: treat as consumer
        consumers.push(user);
      }
    });

    return NextResponse.json({
      success: true,
      totalConsumers: consumers.length,
      totalSellers: sellers.length,
      consumers,
      sellers,
    });
  } catch (error) {
    console.error("[Admin Users API] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
