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

    const { name, phone } = await req.json();
    const email = session.user.email;
    const userRef = adminDB.collection("users").doc(email);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    const userData = userSnap.data();
    const currentPhone = userData?.phone;

    // check if phone number is already...
    if (currentPhone && currentPhone.trim() !== "") {
      if (phone && phone.trim() !== currentPhone.trim()) {
        return NextResponse.json({ error: "Phone number cannot be modified once set." }, { status: 400 });
      }
    }

    const updateData: Record<string, string | null> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined && name.trim() !== "") {
      updateData.name = name;
    }

    if (phone !== undefined) {
      updateData.phone = phone;
    }

    await userRef.update(updateData);

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
    });
  } catch (error) {
    console.error("[Profile Update API] Error:", error);
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
