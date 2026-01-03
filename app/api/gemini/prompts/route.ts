// /app/api/prompts/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const endpoint =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

function noStoreJson(data: any, init?: number | { status?: number }) {
  const status =
    typeof init === "number"
      ? init
      : typeof init === "object"
      ? init.status
      : 200;

  const res = NextResponse.json(data, { status });

  // Prevent Next/Vercel/CDN/browser caching
  res.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
  );
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");

  return res;
}

// Helper: try several strategies to extract an array of prompt strings from Gemini text
function extractPromptsFromText(raw: string): string[] {
  if (!raw || !raw.trim()) return [];

  // 1) Try to parse as JSON directly
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, 6);
    if (Array.isArray(parsed.prompts)) return parsed.prompts.slice(0, 6);
  } catch {}

  // 2) Extract first JSON object if present and parse
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (Array.isArray(parsed.prompts)) return parsed.prompts.slice(0, 6);
    }
  } catch {}

  // 3) Extract an array literal from the text like ["a","b"]
  try {
    const arrMatch = raw.match(/\[([\s\S]*?)\]/);
    if (arrMatch && arrMatch[1]) {
      const inner = arrMatch[1];
      const stringMatches = [...inner.matchAll(/\"([^\"]+)\"|\'([^\']+)\'/g)]
        .map((m) => m[1] || m[2])
        .filter(Boolean);
      if (stringMatches.length) return stringMatches.slice(0, 6);

      // fallback split by comma
      const items = inner
        .split(",")
        .map((s) => s.replace(/["'\n\r]/g, "").trim())
        .filter(Boolean);
      if (items.length) return items.slice(0, 6);
    }
  } catch {}

  // 4) Fallback: take useful lines from the text
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-\d\.\)\s•\*]+/, "").trim())
    .filter((l) => l.length > 3);

  if (lines.length) return lines.slice(0, 6);

  return [];
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return noStoreJson({ error: "Missing GEMINI_API_KEY" }, 500);
    }

    // (Optional) accept payload but DO NOT use it to avoid leaking past context
    // You can remove this entirely if you don't need request body input.
    try {
      await req.json();
    } catch {
      // ignore non-JSON bodies
    }

    // Nonce prevents any intermediate caching / repeated identical outputs
    const nonce =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    const systemText =
      "You are Rubber Duck AI. Provide a short list (3–6) of concise starter prompts " +
      "(3–10 words each) that a user could ask to start a helpful conversation. " +
      "Return ONLY valid JSON that matches the schema. No preamble, no markdown, no code fences.";

    // Prepend the system prompt as the first user message
    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: systemText }],
        },
        {
          role: "user",
          parts: [{ text: `Provide starter prompts. nonce=${nonce}` }],
        },
      ],
      generationConfig: {
        max_output_tokens: 128,
        temperature: 0.2,
        response_mime_type: "application/json",
        response_json_schema: {
          type: "object",
          properties: {
            prompts: {
              type: "array",
              items: { type: "string" },
              minItems: 3,
              maxItems: 6,
            },
          },
          required: ["prompts"],
        },
      },
    };

    // Debug sanity (comment out later)
    // console.log("PROMPTS ROUTE contents:", JSON.stringify(body.contents));

    const geminiRes = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    let text = "";
    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      console.error(
        "Gemini API returned non-OK status",
        geminiRes.status,
        errText
      );
      // allow fallback below
    } else {
      const data: any = await geminiRes.json();
      text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    }

    const prompts = extractPromptsFromText(text);

    if (prompts.length) return noStoreJson({ prompts });

    // Fallback suggestions
    return noStoreJson({
      prompts: [
        "What’s confusing me right now?",
        "What assumption might be wrong?",
        "What changed since it last worked?",
        "What input case breaks this?",
      ],
    });
  } catch (e: any) {
    return noStoreJson({ error: e?.message ?? "Unknown error" }, 500);
  }
}
