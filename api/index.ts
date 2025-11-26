import { Hono } from "hono";
import { handle } from "hono/vercel";
import { streamText, generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

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

type ChildNode = {
  id: string;
  label: string;
  prompt: string;
};

app.post("/choose-child", async (c) => {
  const { messages, conditionPrompt, children } = (await c.req.json()) as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    conditionPrompt: string;
    children: ChildNode[];
  };

  console.log("[choose-child] Request received:", {
    messageCount: messages.length,
    conditionPrompt,
    children: children?.map((c) => ({ id: c.id, label: c.label })),
  });

  if (!children || children.length === 0) {
    console.log("[choose-child] Error: No children provided");
    return c.json({ error: "No children provided" }, 400);
  }

  // Build rich context showing label + prompt for each choice
  const choiceContext = children
    .map(
      (child) =>
        `- "${child.label}" (ID: ${child.id}): ${child.prompt || "No prompt specified"}`
    )
    .join("\n");

  // Create enum values from child IDs
  const childIds = children.map((child) => child.id);

  console.log("[choose-child] Calling generateObject with childIds:", childIds);

  try {
    const result = await generateObject({
      model: openai("gpt-4o"),
      messages: [
        ...messages,
        {
          role: "user",
          content: `Based on our conversation, decide which path to take.\n\nCondition: ${conditionPrompt}\n\nAvailable choices:\n${choiceContext}\n\nRespond with the ID of the child node you choose.`,
        },
      ],
      schema: z.object({
        childId: z
          .enum(childIds as [string, ...string[]])
          .describe("The ID of the child node to execute"),
        reasoning: z
          .string()
          .describe("Brief explanation for why this child was selected"),
      }),
    });

    console.log("[choose-child] Result:", {
      selectedChildId: result.object.childId,
      reasoning: result.object.reasoning,
    });

    return c.json({
      selectedChildId: result.object.childId,
      reasoning: result.object.reasoning,
    });
  } catch (error) {
    console.error("[choose-child] Error:", error);
    throw error;
  }
});

export default handle(app);
