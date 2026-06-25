import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/firebaseAdmin";
import { hashPassword } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    // check if user already exists
    const userRef = adminDB.collection("users").doc(email);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    // create user document in firestore
    await userRef.set({
      name,
      email,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      provider: "credentials",
      role: role === "seller" ? "seller" : "consumer",
      sellerStatus: role === "seller" ? "pending" : null,
    });

    return NextResponse.json({ success: true, message: "Account created successfully" });
  } catch (error) {
    console.error("[Signup API] Error:", error);
    return NextResponse.json({ error: "Failed to create account. Please try again." }, { status: 500 });
  }
}
