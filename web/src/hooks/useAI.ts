import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type ParcelPhotoDetails = {
  size: "small" | "medium" | "large";
  weight: number;
  isFragile: boolean;
  description: string;
  confidence: "low" | "medium" | "high";
};

export function useAnalyzeParcelPhoto() {
  return useMutation({
    mutationFn: (image: string) =>
      api.post<ParcelPhotoDetails>("/api/ai/parcel/photo", { image }),
  });
}

export type SearchFilters = {
  from?: string;
  to?: string;
  size?: "small" | "medium" | "large";
  dateFilter?: "today" | "thisWeek";
  maxPrice?: number;
  minPrice?: number;
  fragile?: boolean;
};

export function useParseSearchIntent() {
  return useMutation({
    mutationFn: (query: string) =>
      api.post<{ filters: SearchFilters }>("/api/ai/search/parse", { query }),
  });
}

export type MatchInsight = {
  parcelId: string;
  reason: string;
  rating: "great" | "good" | "okay";
};

export function useMatchInsights() {
  return useMutation({
    mutationFn: (input: {
      route: { origin: string; destination: string; intermediateStops?: string[] };
      parcels: Array<{
        id: string;
        origin: string;
        destination: string;
        size: string;
        weight?: number | null;
        isFragile?: boolean | null;
        compensation: number;
        senderRating?: number | null;
        description?: string | null;
      }>;
    }) => api.post<{ insights: MatchInsight[] }>("/api/ai/route/match-insights", input),
  });
}

export function useAIStatus() {
  return useMutation({
    mutationFn: () => api.get<{ enabled: boolean }>("/api/ai/status"),
  });
}
