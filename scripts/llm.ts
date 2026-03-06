import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export interface LLMConfig {
  provider: "anthropic" | "google" | "openai";
  model: string;
  temperature: number;
}

export async function llmGenerate(
  config: LLMConfig,
  prompt: string,
): Promise<string> {
  switch (config.provider) {
    case "anthropic":
      return anthropicGenerate(config, prompt);
    case "google":
      return googleGenerate(config, prompt);
    case "openai":
      return openaiGenerate(config, prompt);
  }
}

async function anthropicGenerate(
  config: LLMConfig,
  prompt: string,
): Promise<string> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: config.model,
    max_tokens: 4096,
    temperature: config.temperature,
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return block.text;
}

async function googleGenerate(
  config: LLMConfig,
  prompt: string,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });
  const response = await ai.models.generateContent({
    model: config.model,
    contents: prompt,
    config: { temperature: config.temperature },
  });
  return response.text ?? "";
}

async function openaiGenerate(
  config: LLMConfig,
  prompt: string,
): Promise<string> {
  const client = new OpenAI();
  const response = await client.chat.completions.create({
    model: config.model,
    temperature: config.temperature,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0].message.content ?? "";
}
