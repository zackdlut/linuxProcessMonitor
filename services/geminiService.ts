import { GoogleGenAI, Type } from "@google/genai";
import { CpuLogEntry, AnalysisResult } from "../types";

export const analyzeCpuData = async (data: CpuLogEntry[]): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found. Please ensure process.env.API_KEY is set.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Downsample if too many points to save tokens, take every nth point if > 100
  const step = Math.ceil(data.length / 100);
  const sampledData = data.filter((_, index) => index % step === 0);

  const prompt = `
    Analyze the following CPU usage log data for a Linux process. 
    The data is a time series of User CPU % and System CPU %.
    
    Data (Sampled):
    ${JSON.stringify(sampledData)}

    Please provide:
    1. A brief summary of the performance characteristics.
    2. Specific recommendations to optimize the process based on whether it's user-bound or kernel-bound (sys).
    3. A severity level (LOW, MEDIUM, HIGH) based on total CPU saturation.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            recommendations: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            severity: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] }
          },
          required: ["summary", "recommendations", "severity"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No response from Gemini");

    return JSON.parse(resultText) as AnalysisResult;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      summary: "Failed to generate analysis using AI.",
      recommendations: ["Check your network connection", "Verify API Key"],
      severity: "LOW"
    };
  }
};