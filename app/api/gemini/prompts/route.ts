import { NextResponse } from "next/server";

const endpoint =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }

    // Accept optional context: { recentConversations: [{ title, lastMessage }] }
    let payload: any = {};
    try {
      payload = (await req.json()) || {};
    } catch (e) {
      payload = {};
    }

    const systemText =
      "You are Rubber Duck AI. Provide a short list (3–6) of concise starter prompts (3–10 words each) that a user could ask to start a helpful conversation. Return ONLY valid JSON that matches the schema. No preamble, no markdown.";

    const contents: any[] = [];

    if (Array.isArray(payload.recentConversations) && payload.recentConversations.length) {
      // Build a compact context string to send to Gemini
      const ctx = payload.recentConversations
        .slice(0, 3)
        .map((c: any, i: number) => {
          const title = c.title ? `Title: ${c.title}` : "";
          const last = c.lastMessage ? `Last message: ${c.lastMessage}` : "";
          return `Conversation ${i + 1}: ${title}${last ? " — " + last : ""}`;
        })
        .join("\n");

      contents.push({ role: "system", parts: [{ text: `Use the following previous conversation context to make suggestions:
${ctx}` }] });
    }

    contents.push({ role: "user", parts: [{ text: "Provide starter prompts" }] });

    const body = {
      systemInstruction: { parts: [{ text: systemText }] },
      contents,
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
              minItems: 1,
              maxItems: 6,
            },
          },
          required: ["prompts"],
        },
      },
    };

    const res = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    let data: any = null;
    let text = "";
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Gemini API returned non-OK status", res.status, errText, "payload:", payload);
      // don't early-return; allow retry/fallback logic below to provide suggestions
    } else {
      data = await res.json();
      text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    }

    // Helper: try several strategies to extract an array of prompt strings from Gemini text
    function extractPromptsFromText(raw: string): string[] {
      if (!raw || !raw.trim()) return [];

      // 1) Try to parse as JSON directly
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(0, 6);
        if (Array.isArray(parsed.prompts)) return parsed.prompts.slice(0, 6);
      } catch (e) {}

      // 2) Extract first JSON object if present and parse
      try {
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
          const parsed = JSON.parse(raw.slice(start, end + 1));
          if (Array.isArray(parsed.prompts)) return parsed.prompts.slice(0, 6);
        }
      } catch (e) {}

      // 3) Extract an array literal from the text like ["a","b"]
      try {
        const arrMatch = raw.match(/\[([\s\S]*?)\]/);
        if (arrMatch && arrMatch[1]) {
          const inner = arrMatch[1];
          const stringMatches = [...inner.matchAll(/\"([^\"]+)\"|\'([^\']+)\'/g)].map((m) => m[1] || m[2]).filter(Boolean);
          if (stringMatches.length) return stringMatches.slice(0, 6);
          // fallback split by comma
          const items = inner.split(",").map((s) => s.replace(/["'\n\r]/g, "").trim()).filter(Boolean);
          if (items.length) return items.slice(0, 6);
        }
      } catch (e) {}

      // 4) Fallback: take useful lines from the text
      const lines = raw
        .split(/\r?\n/)
        .map((l) => l.replace(/^[-\d\.\)\s•\*]+/, "").trim())
        .filter((l) => l.length > 3);
      if (lines.length) return lines.slice(0, 6);

      return [];
    }

    let prompts = extractPromptsFromText(text);

    // Log raw text if we couldn't extract prompts for debugging
    if ((!prompts || prompts.length === 0) && text) {
      console.error("Gemini prompts parse failed, raw response:", text, "payload:", payload);
    }

    if (prompts.length) return NextResponse.json({ prompts });

    // If we had recent conversation context, try again with an explicit prompt embedding that context (and use robust extraction)
    if (Array.isArray(payload.recentConversations) && payload.recentConversations.length) {
      try {
        const ctx = payload.recentConversations
          .slice(0, 3)
          .map((c: any, i: number) => {
            const title = c.title ? `Title: ${c.title}` : "";
            const last = c.lastMessage ? `Last message: ${c.lastMessage}` : "";
            return `Conversation ${i + 1}: ${title}${last ? " — " + last : ""}`;
          })
          .join("\n");

        const altBody = {
          systemInstruction: { parts: [{ text: systemText }] },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    `Here is the recent conversation context:\n${ctx}\n\nUsing that context, provide 3–6 concise starter prompts (3–10 words each) that would be relevant to this user. Return ONLY valid JSON {"prompts": ["..."]} with no extra text or markdown.`,
                },
              ],
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
                  minItems: 1,
                  maxItems: 6,
                },
              },
              required: ["prompts"],
            },
          },
        };

        const retryRes = await fetch(`${endpoint}?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(altBody),
        });

        if (retryRes.ok) {
          const retryData = await retryRes.json();
          const retryText = retryData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          const retryPrompts = extractPromptsFromText(retryText);
          if (retryPrompts.length) return NextResponse.json({ prompts: retryPrompts });

          // log retry raw text for debugging
          console.error("Gemini prompts retry parse failed, raw response:", retryText, "payload:", payload);
        }
      } catch (e) {
        console.error("Retry for prompts failed:", e);
      }
    }

    // Fallback suggestions
    const fallback = [
      "What's the main challenge I'm facing?",
      "How can I improve this idea?",
      "What am I missing in my approach?",
    ];

    return NextResponse.json({ prompts: fallback });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
