import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { adminDB } from "@/firebaseAdmin";

export const revalidate = 0;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userDoc = await adminDB.collection("users").doc(session.user.email).get();
    if (!userDoc.exists) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();
    return NextResponse.json({
      success: true,
      user: {
        email: session.user.email,
        name: userData?.name || session.user.name,
        image: session.user.image,
        role: userData?.role || "consumer",
        sellerStatus: userData?.sellerStatus || null,
        vendorId: userData?.vendorId || null,
        phone: userData?.phone || null,
        addresses: userData?.addresses || [],
      }
    });
  } catch (error) {
    console.error("[Profile API] Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
