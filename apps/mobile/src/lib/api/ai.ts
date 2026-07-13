import { apiPostJson } from "./http";

export type AIInsightDto = {
  type: string;
  priority: "critical" | "warning" | "info";
  title: string;
  message: string;
  action_label?: string | null;
  action_route?: string | null;
};

export type AIRecommendationsResponseDto = {
  items: AIInsightDto[];
  generatedAt: string;
  insufficient?: boolean;
  unavailable?: boolean;
};

export function fetchAIRecommendations(
  accessToken: string,
  body: { farmId: string; module: string },
  activeProfileId?: string | null
): Promise<AIRecommendationsResponseDto> {
  return apiPostJson<AIRecommendationsResponseDto>(
    "/ai/recommendations",
    body,
    accessToken,
    activeProfileId
  );
}
