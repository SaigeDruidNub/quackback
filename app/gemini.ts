// gemini.ts
// Handles communication with the Gemini AI API

export interface GeminiMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

export async function askGemini(
  conversation: GeminiMessage[]
): Promise<string[]> {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ conversation }),
  });

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const data = await res.json();
  return data.questions || [];
}
