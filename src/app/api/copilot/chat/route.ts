import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { askGemini } from "@/lib/gemini";
import { getProductsData } from "@/lib/getData";
import { rateLimit } from "@/lib/rateLimit";

export const revalidate = 0;

export async function POST(request: NextRequest) {
  // Require authentication — prevents unauthenticated API abuse
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Sign in required to use the shopping copilot" },
      { status: 401 }
    );
  }

  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  // Use user email for rate limiting (more accurate than IP for authenticated users)
  const rateKey = `ratelimit:copilot:${session.user.email ?? ip}`;

  try {
    const { success, remaining } = await rateLimit(rateKey, 20, 60); // 20 requests per minute
    if (!success) {
      return NextResponse.json(
        { success: false, error: "Too Many Requests. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "20",
            "X-RateLimit-Remaining": String(remaining),
          },
        }
      );
    }
  } catch (err) {
    console.error("Rate limiting error on copilot:", err);
  }

  try {
    const { message, history } = await request.json();

    if (!message) {
      return NextResponse.json({ success: false, error: "Missing message parameter" }, { status: 400 });
    }

    const pythonServiceUrl = process.env.RECOMMENDATION_SERVICE_URL || "http://127.0.0.1:8000";

    try {
      const res = await fetch(`${pythonServiceUrl}/copilot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
        next: { revalidate: 0 }
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (err) {
      console.warn("[Copilot API Gateway] Python AI service offline. Running Gemini fallback.", err);
    }

    // fetch real product catalog
    const products = await getProductsData();
    const catalogContext = products.map((p) => ({
      id: p._id,
      title: p.title,
      brand: p.brand,
      price: p.price,
      quantity: p.quantity,
      description: p.description,
      category: p.category?.map((c) => c.name).join(", ") || "General",
      slug: p.slug?.current || "",
    }));

    const systemInstruction = `You are the DCart AI Shopping Copilot — an intelligent shopping assistant exclusively for the DCart online store. Your only purpose is to help users discover products, compare items, get recommendations, and make smart purchasing decisions within the DCart store.

CURRENT PRODUCT CATALOG (these are ALL available products — do NOT invent any other products):
${JSON.stringify(catalogContext, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━
STRICT SCOPE RULES:
━━━━━━━━━━━━━━━━━━━━━━
You ONLY answer questions related to:
✅ DCart products, categories, brands
✅ Product recommendations, comparisons, suggestions
✅ Budget-based product searches (e.g., "best phone under ₹25000")
✅ Product features, specs, descriptions
✅ General shopping advice within the DCart catalog

You MUST REFUSE to answer anything outside this scope, including:
❌ Coding help, programming questions, algorithms
❌ General knowledge, science, history, geography
❌ Math problems, homework, or academic questions  
❌ General AI questions or chatbot questions
❌ News, politics, entertainment unrelated to our products
❌ Medical, legal, financial advice
❌ Any random topics not related to shopping at DCart

When someone asks something out of scope, respond EXACTLY like this (adjust naturally):
"I'm your DCart Shopping Copilot, so I can only help with shopping-related queries! 😊 Try asking me things like:
* *Best smartphone under ₹20,000*
* *Compare two products*
* *Gaming accessories recommendations*"

━━━━━━━━━━━━━━━━━━━━━━
PRODUCT RECOMMENDATION RULES:
━━━━━━━━━━━━━━━━━━━━━━
1. ONLY recommend products that exist in the catalog above — never invent or hallucinate products.
2. For budget queries (e.g., "under ₹25000"), filter strictly by the price field. If no product matches the criteria, say:
   "We currently don't have any [category] under ₹X in stock. Our closest options are..." and list nearest alternatives.
3. For comparison requests, create a clear markdown table with relevant specs from the catalog data.
4. Always provide clickable product links using: [Product Title](/product/SLUG) — replace SLUG with the actual slug from catalog.
5. Keep responses friendly, concise, and well-formatted in Markdown.
6. Understand conversational context — if a user says "show me cheaper ones" they are continuing from their previous topic.
7. When you list products, always show: Name, Price (₹), Brand, and a one-line description.`;

    const reply = await askGemini(systemInstruction, message, history || []);
    return NextResponse.json({
      success: true,
      response: reply,
      mode: "gemini_ai_copilot"
    });

  } catch (error) {
    console.error("Copilot API error:", error);
    return NextResponse.json({ success: false, error: "Failed to process chat message" }, { status: 500 });
  }
}
