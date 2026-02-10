import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.warn("VITE_GEMINI_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

console.log('[Gemini] Initializing model gemini-2.5-flash-lite');
export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
});

