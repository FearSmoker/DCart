import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/manageSession";
import { adminDB } from "@/firebaseAdmin";
import { askGemini } from "@/lib/gemini";
import { getProductsData } from "@/lib/getData";

export const revalidate = 0;

// ─── static faq knowledge base ───────────────────────────────────────────────
const FAQ_KB: Record<string, string> = {
  refund: `**DCart Refund Policy**
- You can request a refund within **7 days** of delivery.
- Items must be unused and in original packaging.
- Refunds are processed within 5-7 business days.
- To initiate a return, go to your **[Orders page](/orders)** and cancel the order.`,

  shipping: `**DCart Shipping Policy**
- Standard delivery: **3-5 business days** across India.
- Express delivery: **1-2 business days** (select cities).
- Free shipping on orders above **₹499**.
- Shipping charges: ₹49 for orders below ₹499.`,

  payment: `**DCart Payment Options**
- Accepted: Debit/Credit cards, UPI, Net Banking, Cash on Delivery.
- EMI available on orders above ₹5,000.
- All transactions are SSL-encrypted and secure.`,

  cancel: `**How to Cancel an Order**
- Visit your **[Orders page](/orders)** and click "Cancel Order".
- Orders can only be cancelled before they are shipped.
- Cancellation refunds take 3-5 business days.`,

  track: `**Order Tracking**
- After placing an order, you'll receive an email confirmation.
- Visit your **[Orders page](/orders)** for real-time status updates.
- Orders typically ship within 1-2 business days.`,

  warranty: `**Product Warranty**
- Laptops & Phones: 1-year manufacturer warranty.
- Accessories: 6-month warranty.
- Raise warranty claims directly with the brand service center.`,
};

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json() as {
      message: string;
      history?: { role: string; content: string }[];
    };

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Missing message" },
        { status: 400 }
      );
    }

    // get session for personalized order lookups
    const session = await getSession();
    const email = session?.user?.email ?? null;

    const pythonServiceUrl =
      process.env.RECOMMENDATION_SERVICE_URL || "http://127.0.0.1:8000";

    try {
      const res = await fetch(`${pythonServiceUrl}/agent/support`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, email, history: history ?? [] }),
        next: { revalidate: 0 },
      });

      if (!res.ok) throw new Error(`Python service ${res.status}`);

      const data = await res.json();
      return NextResponse.json(data);
    } catch (err) {
      console.warn(
        "[Support Agent API] Python service offline, using Gemini AI agent.",
        err
      );

      // fetch dynamic catalog and orders context
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

      const faqContext = JSON.stringify(FAQ_KB, null, 2);

      let ordersContext = "No orders found for this user.";
      if (email) {
        try {
          const snapshot = await adminDB
            .collection("users")
            .doc(email)
            .collection("orders")
            .get();
          if (!snapshot.empty) {
            const ordersList = snapshot.docs.map(doc => ({
              id: doc.id,
              ...(doc.data() as Record<string, unknown>)
            }));
            ordersContext = JSON.stringify(ordersList, null, 2);
          }
        } catch (err) {
          console.warn("Could not fetch user orders context for support agent:", err);
        }
      }

      const systemInstruction = `You are the DCart Customer Support Agent — a professional, friendly AI assistant exclusively for the DCart online shopping platform. Your ONLY job is to help customers with their shopping experience at DCart.

━━━━━━━━━━━━━━━━━━━━━━
STRICT SCOPE RULES:
━━━━━━━━━━━━━━━━━━━━━━
You ONLY handle:
✅ Order status, tracking, and history
✅ Refund and return requests
✅ Shipping timelines and delivery queries
✅ Payment methods and EMI options
✅ Order cancellations
✅ Product availability and stock queries
✅ Warranty information
✅ DCart policies and FAQs
✅ Navigation help within DCart

You MUST REFUSE anything outside this scope, including:
❌ General coding or programming help
❌ General knowledge questions (history, science, math, etc.)
❌ Medical, legal, or financial advice
❌ Random chitchat unrelated to DCart
❌ AI or chatbot questions

When asked out-of-scope questions, respond EXACTLY like this (adjust naturally):
"I'm DCart's Customer Support Agent, so I can only assist with shopping and order-related queries! 😊 Here's how I can help:
* Track or manage your orders
* Refund and return policies  
* Shipping and delivery info
* Product availability"

━━━━━━━━━━━━━━━━━━━━━━
DCart FAQ & POLICIES:
━━━━━━━━━━━━━━━━━━━━━━
${faqContext}

━━━━━━━━━━━━━━━━━━━━━━
LIVE PRODUCT CATALOG:
━━━━━━━━━━━━━━━━━━━━━━
${JSON.stringify(catalogContext, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━
CUSTOMER INFO:
━━━━━━━━━━━━━━━━━━━━━━
- Email: ${email || "Not signed in"}

━━━━━━━━━━━━━━━━━━━━━━
CUSTOMER ORDER HISTORY:
━━━━━━━━━━━━━━━━━━━━━━
${ordersContext}

━━━━━━━━━━━━━━━━━━━━━━
RESPONSE RULES:
━━━━━━━━━━━━━━━━━━━━━━
1. Be professional, empathetic, and concise. Format responses in clean Markdown.
2. If the user asks about their orders and they are NOT signed in, ask them to **[sign in](/signin)** first.
3. If they ARE signed in, refer to their actual Order History above. Give exact order details, status, and items.
4. For product availability, refer ONLY to the live catalog. Provide clickable links: [Product Name](/product/SLUG).
5. For cancellations, guide them to the **[Orders page](/orders)**.
6. Never make up order information or product details not in the provided context.`;

      const reply = await askGemini(systemInstruction, message, history || []);

      return NextResponse.json({
        success: true,
        reply: reply,
        mode: "gemini_ai_support_agent",
      });
    }
  } catch (error) {
    console.error("Support agent API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process support request" },
      { status: 500 }
    );
  }
}
