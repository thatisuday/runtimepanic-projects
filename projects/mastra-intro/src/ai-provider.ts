import "@dotenvx/dotenvx/config";
import { openai } from "@ai-sdk/openai";

// Keep provider creation behind a helper so agents/workflows do not care which
// OpenAI ChatGPT model is selected through configuration.
export const provider = (modelId: string = process.env.LLM_MODEL ?? "gpt-4o") =>
  openai(modelId);
