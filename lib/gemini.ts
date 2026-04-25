import { GoogleGenAI } from "@google/genai";

const apiKey =
  process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY is not set. Add it to .env.local and run scripts with `npm run script <path>`."
  );
}

export const genai = new GoogleGenAI({ apiKey });

export const TRIAGE_MODEL = "gemini-2.5-flash";
export const SYNTHESIS_MODEL = "gemini-2.5-pro";

/**
 * Plain-text completion. Used by the hello-world script and any
 * non-structured calls. Returns the concatenated text response.
 */
export async function generateText(opts: {
  model: string;
  prompt: string;
}): Promise<string> {
  const response = await genai.models.generateContent({
    model: opts.model,
    contents: opts.prompt,
  });
  return response.text ?? "";
}
