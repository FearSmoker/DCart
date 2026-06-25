import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { adminDB } from "@/firebaseAdmin";

export const revalidate = 0;

interface Address {
  id: string;
  name: string;
  contactNo: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  label: "Home" | "Office" | "Others";
  isPrimary: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action, address, addressId } = await req.json();
    const email = session.user.email;
    const userRef = adminDB.collection("users").doc(email);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userSnap.data();
    let addresses: Address[] = userData?.addresses || [];

    if (action === "add") {
      if (!address) {
        return NextResponse.json({ error: "Address details are required." }, { status: 400 });
      }

      const newAddress: Address = {
        id: crypto.randomUUID(),
        name: address.name,
        contactNo: address.contactNo,
        street: address.street,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        label: address.label || "Home",
        isPrimary: addresses.length === 0 ? true : !!address.isPrimary,
      };

      if (newAddress.isPrimary) {
        addresses = addresses.map((addr) => ({ ...addr, isPrimary: false }));
      }

      addresses.push(newAddress);
    } else if (action === "delete") {
      if (!addressId) {
        return NextResponse.json({ error: "Address ID is required for deletion." }, { status: 400 });
      }

      const targetAddress = addresses.find((addr) => addr.id === addressId);
      addresses = addresses.filter((addr) => addr.id !== addressId);

      // if we deleted the primary address...
      if (targetAddress?.isPrimary && addresses.length > 0) {
        addresses[0].isPrimary = true;
      }
    } else if (action === "setPrimary") {
      if (!addressId) {
        return NextResponse.json({ error: "Address ID is required to set primary." }, { status: 400 });
      }

      addresses = addresses.map((addr) => ({
        ...addr,
        isPrimary: addr.id === addressId,
      }));
    } else {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    await userRef.update({
      addresses,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      addresses,
    });
  } catch (error) {
    console.error("[Profile Addresses API] Error:", error);
    return NextResponse.json({ error: "Failed to process address request." }, { status: 500 });
  }
}
