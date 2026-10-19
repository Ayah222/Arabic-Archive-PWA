import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

export type ArchiveAiTask = "extract" | "ask";

export async function runArchiveAi(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("ميزة الذكاء الاصطناعي غير مهيأة. أضف GEMINI_API_KEY إلى أسرار المشروع.");
  }

  // Keep provider construction isolated so another AI SDK provider can replace
  // Gemini without changing the archive routes or their UI contract.
  const google = createGoogleGenerativeAI({ apiKey });
  const result = await generateText({
    model: google("gemini-2.5-flash"),
    prompt,
    maxOutputTokens: 2048,
    temperature: 0.2,
  });

  return result.text.trim();
}
