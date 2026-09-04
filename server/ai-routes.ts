import type { Express } from "express";
import { requireAuth, type AuthenticatedRequest } from "./firebase-admin";
import {
  improveParcelDescription,
  suggestCompensation,
  suggestSmartReplies,
  assistantChat,
  suggestRouteStops,
  analyzeParcelPhoto,
  parseSearchIntent,
  summarizeMatchingParcels,
  isAIEnabled,
} from "./ai-service";

function handleAIError(res: any, error: any) {
  console.error("[AI]", error);
  if (!isAIEnabled()) {
    return res
      .status(503)
      .json({ error: "AI features are not configured. Please add an OpenAI API key." });
  }
  const msg = error?.message || "AI request failed";
  res.status(500).json({ error: msg });
}

export function registerAIRoutes(app: Express) {
  app.get("/api/ai/status", (_req, res) => {
    res.json({ enabled: isAIEnabled() });
  });

  app.post(
    "/api/ai/parcel/description",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const text = await improveParcelDescription(req.body || {});
        res.json({ description: text });
      } catch (e) {
        handleAIError(res, e);
      }
    },
  );

  app.post(
    "/api/ai/parcel/price",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await suggestCompensation(req.body || {});
        res.json(result);
      } catch (e) {
        handleAIError(res, e);
      }
    },
  );

  app.post(
    "/api/ai/chat/replies",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { history, role } = req.body || {};
        const replies = await suggestSmartReplies(
          Array.isArray(history) ? history : [],
          role === "carrier" ? "carrier" : "sender",
        );
        res.json({ replies });
      } catch (e) {
        handleAIError(res, e);
      }
    },
  );

  app.post(
    "/api/ai/route/stops",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const body = req.body || {};
        if (!body.origin || !body.destination) {
          return res.status(400).json({ error: "origin and destination are required" });
        }
        const stops = await suggestRouteStops(body);
        res.json({ stops });
      } catch (e) {
        handleAIError(res, e);
      }
    },
  );

  app.post(
    "/api/ai/parcel/photo",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { image } = req.body || {};
        if (!image || typeof image !== "string") {
          return res.status(400).json({ error: "image (data URL or http URL) is required" });
        }
        const details = await analyzeParcelPhoto(image);
        res.json(details);
      } catch (e) {
        handleAIError(res, e);
      }
    },
  );

  app.post(
    "/api/ai/search/parse",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { query } = req.body || {};
        if (!query || typeof query !== "string") {
          return res.status(400).json({ error: "query is required" });
        }
        const filters = await parseSearchIntent(query);
        res.json({ filters });
      } catch (e) {
        handleAIError(res, e);
      }
    },
  );

  app.post(
    "/api/ai/route/match-insights",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { route, parcels } = req.body || {};
        if (!route || !Array.isArray(parcels)) {
          return res.status(400).json({ error: "route and parcels[] are required" });
        }
        const insights = await summarizeMatchingParcels({ route, parcels: parcels.slice(0, 10) });
        res.json({ insights });
      } catch (e) {
        handleAIError(res, e);
      }
    },
  );

  app.post(
    "/api/ai/assistant",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { messages } = req.body || {};
        const reply = await assistantChat(Array.isArray(messages) ? messages : []);
        res.json({ reply });
      } catch (e) {
        handleAIError(res, e);
      }
    },
  );
}
