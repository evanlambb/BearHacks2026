/**
 * Block 1 verification: confirm both Gemini models respond from Node.
 * Run with: npm run script scripts/hello.ts
 */
import { generateText, TRIAGE_MODEL, SYNTHESIS_MODEL } from "../lib/gemini";

async function ping(model: string) {
  const start = Date.now();
  try {
    const text = await generateText({
      model,
      prompt:
        "Respond with exactly the sentence: Hello, I am online. (no quotes, no extra words)",
    });
    const ms = Date.now() - start;
    console.log(`[OK]  ${model.padEnd(18)}  ${ms}ms  -> ${text.trim()}`);
  } catch (err) {
    const ms = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[ERR] ${model.padEnd(18)}  ${ms}ms  -> ${msg}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log("Pinging Gemini models...\n");
  await ping(TRIAGE_MODEL);
  await ping(SYNTHESIS_MODEL);
}

main();
