import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { askGemini } from "@/lib/gemini";

export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, category, description } = body;

    if (!title || !category || !description) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: title, category, description" },
        { status: 400 }
      );
    }

    const systemInstruction = `You are an expert product content generator for DCart, a premium e-commerce platform.
Your task is to analyze the product title, category, and description, and generate structured metadata details.
You must return a raw JSON object ONLY, with no markdown code blocks, no backticks, and no extra text.
Do NOT include or generate any field for "Model Specification" or "RAM / Storage" or "modelInfo". That is a separate manual field.
The JSON object must follow this template format exactly:
{
  "brand": "Suggested brand name based on title/description, or Generic",
  "material": "Sensing material details if category is streetwear, e.g. '100% Organic Cotton', or null otherwise",
  "materialsCare": ["exactly 4 care and material instructions/tips"],
  "featuresSpecs": ["exactly 4 key features and specifications, e.g. 'Build: Titanium Frame'"],
  "measurements": ["exactly 4 measurements, e.g., 'Dimensions: 10 x 5 x 2 cm', 'Weight: 150g'"],
  "inTheBox": ["items included in the packaging, number of points is decided by you based on the product type"]
}
Ensure that the JSON is fully valid and parseable. Do not include comments or Markdown.`;

    const userMessage = `Title: ${title}
Category: ${category}
Description: ${description}`;

    const reply = await askGemini(systemInstruction, userMessage);
    let cleanedReply = reply.trim();

    // extract the json object block between...
    const firstBrace = cleanedReply.indexOf("{");
    const lastBrace = cleanedReply.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanedReply = cleanedReply.substring(firstBrace, lastBrace + 1);
    } else if (cleanedReply.startsWith("```")) {
      cleanedReply = cleanedReply
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "");
    }

    try {
      const parsedData = JSON.parse(cleanedReply);
      return NextResponse.json({ success: true, data: parsedData });
    } catch (parseError) {
      console.error("Failed to parse Gemini JSON output:", cleanedReply, parseError);
      return NextResponse.json(
        { success: false, error: "Failed to generate valid structured JSON from AI. Please try again." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in AI details generation route:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
