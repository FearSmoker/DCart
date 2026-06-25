interface ChatMessage {
  role: string;
  content: string;
}

export async function askGemini(
  systemInstruction: string,
  message: string,
  history: ChatMessage[] = []
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[Gemini API] GEMINI_API_KEY is not configured in environment.");
    return "Error: Gemini API Key is missing. Please check your .env configuration.";
  }

  // map history to gemini's expected format...
  const contents = [];
  for (const h of history) {
    const role = h.role === "assistant" || h.role === "model" ? "model" : "user";
    contents.push({
      role,
      parts: [{ text: h.content }],
    });
  }

  // append user's current message
  contents.push({
    role: "user",
    parts: [{ text: message }],
  });

  const payload = {
    contents,
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4000,
    },
  };

  const models = ["gemini-1.5-flash", "gemini-1.5-pro"];

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    console.log(`[Gemini API] Trying model ${model}...`);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error(`[Gemini API] Error ${res.status} from ${model}:`, errorData);
        
        if (res.status === 429 || res.status >= 500) {
          if (i < models.length - 1) {
            console.warn(`[Gemini API] Retrying with next model...`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
        }
        throw new Error(`Gemini API error: ${res.statusText}`);
      }

      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!reply) {
        console.error(`[Gemini API] No content returned from ${model}`, data);
        throw new Error("Empty response from Gemini API");
      }

      return reply;
    } catch (error) {
      console.error(`[Gemini API] Failed to reach ${model}:`, error);
      if (i === models.length - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error("All Gemini models failed");
}

export async function askGeminiVision(
  fileBuffer: Buffer,
  mimeType: string,
  promptText: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment.");
  }

  const base64Data = fileBuffer.toString("base64");

  const payload = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
          {
            text: promptText,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1000,
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error("[Gemini Vision API] Error:", errorData);
    throw new Error(`Gemini Vision API error: ${res.statusText}`);
  }

  const data = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) {
    throw new Error("Empty response from Gemini Vision API");
  }

  return reply;
}
