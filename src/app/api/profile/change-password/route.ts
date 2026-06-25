import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { adminDB } from "@/firebaseAdmin";
import { hashPassword } from "@/lib/auth-helpers";

export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { oldPassword, newPassword } = await req.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: "All password fields are required" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }

    const email = session.user.email;
    const userRef = adminDB.collection("users").doc(email);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    const userData = userSnap.data();

    // check if user is oauth user...
    if (userData?.provider !== "credentials") {
      return NextResponse.json({ error: "OAuth accounts (Google/GitHub) cannot change password here." }, { status: 400 });
    }

    // verify current password hash
    const currentHash = userData?.passwordHash;
    if (hashPassword(oldPassword) !== currentHash) {
      return NextResponse.json({ error: "Incorrect old password." }, { status: 400 });
    }

    // update password hash
    await userRef.update({
      passwordHash: hashPassword(newPassword),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("[Profile Change Password API] Error:", error);
    return NextResponse.json({ error: "Failed to change password." }, { status: 500 });
  }
}
