import { Hono } from "hono";
import { handle } from "hono/vercel";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export const config = {
  runtime: "edge",
};

export const app = new Hono().basePath("/api");

app.post("/generate", async (c) => {
  const { messages } = await c.req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages,
  });

  return result.toTextStreamResponse();
});

export default handle(app);
