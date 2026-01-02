// /app/api/gemini/route.ts
import { NextResponse } from "next/server";

const endpoint =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

function parseJsonObjectFromText(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { conversation } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY" },
        { status: 500 }
      );
    }

    if (!Array.isArray(conversation) || conversation.length === 0) {
      return NextResponse.json(
        { error: "Missing conversation" },
        { status: 400 }
      );
    }

    const body = {
      systemInstruction: {
        parts: [
          {
            text:
              "You are Rubber Duck AI.\n" +
              "You ONLY ask questions to help the user think.\n" +
              "NEVER provide answers, fixes, steps, or code.\n" +
              "Return ONLY valid JSON that matches the schema. No preamble, no markdown.\n" +
              "Ask 1–2 short questions maximum.",
          },
        ],
      },
      contents: conversation,
      generationConfig: {
        max_output_tokens: 256,
        temperature: 0.2,
        response_mime_type: "application/json",
        response_json_schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 2,
            },
          },
          required: ["questions"],
        },
      },
    };

    const res = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Gemini API error: ${res.status}`, details: errText },
        { status: res.status }
      );
    }

    const data = await res.json();

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // In true JSON mode this should already be JSON text, but we parse defensively
    const parsed =
      parseJsonObjectFromText(text) ??
      (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })();

    const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
    if (questions.length) return NextResponse.json({ questions });

    return NextResponse.json({
      questions: [
        "What outcome are you expecting, and what are you observing instead?",
      ],
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
