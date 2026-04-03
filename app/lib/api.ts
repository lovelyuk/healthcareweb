import type { BodyPayload } from "./bodyAnalysis";

export interface AnalyzeBodyResponse {
  summary: string;
  risk_points: string[];
  guide: string[];
}

function getApiBase(): string {
  const env = process.env.NEXT_PUBLIC_AI_SERVER_URL;
  if (env && env.trim().length > 0) return env;

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://127.0.0.1:5000";
    }
  }

  return "";
}

function normalizeResponse(raw: any): AnalyzeBodyResponse {
  const summary = String(raw?.summary ?? raw?.result?.summary ?? "Analysis complete.");

  const risk = raw?.risk_points ?? raw?.result?.risk_points ?? raw?.problem_points;
  const guide = raw?.guide ?? raw?.result?.guide ?? raw?.recommendations;

  return {
    summary,
    risk_points: Array.isArray(risk) ? risk.map(String) : [],
    guide: Array.isArray(guide) ? guide.map(String) : [],
  };
}

export async function analyzeBody(data: BodyPayload): Promise<AnalyzeBodyResponse> {
  const base = getApiBase();
  const url = `${base}/api/body/summary`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`Body analysis request failed (${res.status})`);
  }

  const json = await res.json();
  return normalizeResponse(json);
}
