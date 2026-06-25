import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { adminDB } from "@/firebaseAdmin";

export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role } = await req.json();

    if (role !== "consumer" && role !== "seller") {
      return NextResponse.json({ error: "Invalid role selection. Must be consumer or seller." }, { status: 400 });
    }

    const email = session.user.email;
    const userRef = adminDB.collection("users").doc(email);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    const updateData: Record<string, string | null> = {
      role,
      updatedAt: new Date().toISOString(),
    };

    if (role === "seller") {
      updateData.sellerStatus = "pending";
    } else {
      updateData.sellerStatus = null;
    }

    await userRef.update(updateData);

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
      role,
      sellerStatus: updateData.sellerStatus,
    });
  } catch (error) {
    console.error("[Complete Profile API] Error:", error);
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
