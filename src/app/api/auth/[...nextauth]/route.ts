import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

const limitHandler = async (req: NextRequest, originalHandler: (req: NextRequest) => Promise<Response> | Response) => {
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const rateKey = `ratelimit:auth:${ip}`;

  try {
    const { success, remaining } = await rateLimit(rateKey, 20, 60); // 20 requests per minute
    if (!success) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "20",
          "X-RateLimit-Remaining": String(remaining),
        },
      });
    }
  } catch (err) {
    console.error("Rate limiting error:", err);
  }

  return originalHandler(req);
};

export const GET = (req: NextRequest) => limitHandler(req, handlers.GET);
export const POST = (req: NextRequest) => limitHandler(req, handlers.POST);
