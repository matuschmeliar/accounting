import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export const maxDuration = 30;

export async function GET() {
  console.log("[test] env check:", {
    anthropic_set: !!process.env.ANTHROPIC_API_KEY,
    anthropic_len: process.env.ANTHROPIC_API_KEY?.length,
    anthropic_prefix: process.env.ANTHROPIC_API_KEY?.slice(0, 12),
    datamap_set: !!process.env.DATAMAP_API_KEY,
    pwd_set: !!process.env.APP_PASSWORD,
  });
  try {
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: "https://api.anthropic.com/v1",
    });

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-5"),
      prompt: "Povedz ahoj v 5 slovách",
    });
    return Response.json({ ok: true, text });
  } catch (e) {
    return Response.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
      { status: 500 }
    );
  }
}
