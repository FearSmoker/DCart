import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/firebaseAdmin";
import { hashPassword } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(null, { status: 400 });
    }

    // fetch user from firestore
    const userRef = adminDB.collection("users").doc(email);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json(null, { status: 401 });
    }

    const userData = userSnap.data();
    if (!userData || userData.provider !== "credentials") {
      return NextResponse.json(null, { status: 401 });
    }

    const inputHash = hashPassword(password);
    if (inputHash !== userData.passwordHash) {
      return NextResponse.json(null, { status: 401 });
    }

    // return the user object that nextauth expects
    return NextResponse.json({
      id: email,
      name: userData.name,
      email: userData.email,
      image: null,
      role: userData.role || "consumer",
      sellerStatus: userData.sellerStatus || null,
      vendorId: userData.vendorId || null,
    });
  } catch (error) {
    console.error("[Verify API] Error:", error);
    return NextResponse.json(null, { status: 500 });
  }
}
