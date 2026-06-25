import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/searchService";
import { getSession } from "@/lib/manageSession";
import { publishEvent } from "@/lib/kafka";

export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get("q") || "";

    // Limit query length to prevent abuse
    const query = rawQuery.slice(0, 200);

    const limitParam = searchParams.get("limit");
    const rawLimit = limitParam ? parseInt(limitParam, 10) : undefined;
    // Clamp limit between 1 and 100 to prevent extreme values
    const limit = rawLimit !== undefined && !isNaN(rawLimit)
      ? Math.min(Math.max(1, rawLimit), 100)
      : undefined;

    const products = await searchProducts(query);

    const results = limit ? products.slice(0, limit) : products;

    // track search query event for recommendations
    try {
      const session = await getSession();
      if (session?.user?.email && query.trim()) {
        await publishEvent("search-item", {
          email: session.user.email,
          query: query.trim(),
        });
      }
    } catch (err) {
      console.warn("Failed to publish search event:", err);
    }

    return NextResponse.json({ success: true, products: results });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to perform search" },
      { status: 500 }
    );
  }
}
