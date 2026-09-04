import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey });
  }
  return cachedClient;
}

export function isAIEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export type ParcelContext = {
  origin?: string;
  destination?: string;
  size?: "small" | "medium" | "large";
  weight?: number | null;
  isFragile?: boolean | null;
  description?: string | null;
  distanceKm?: number | null;
};

export async function improveParcelDescription(ctx: ParcelContext): Promise<string> {
  const client = getOpenAIClient();
  const prompt = `You are helping a user write a clear, friendly parcel description for a peer-to-peer delivery app.

Parcel details:
- Origin: ${ctx.origin || "(not set)"}
- Destination: ${ctx.destination || "(not set)"}
- Size: ${ctx.size || "(not set)"}
- Weight: ${ctx.weight ? `${ctx.weight} kg` : "(not set)"}
- Fragile: ${ctx.isFragile ? "Yes" : "No"}
- User notes: ${ctx.description || "(none)"}

Write a concise (1-2 sentences, max 200 characters) description that helps a carrier understand what they'd be transporting. Be specific and practical. Do not include the origin/destination. Reply with only the description text, no quotes.`;

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.6,
    max_tokens: 120,
  });
  return (res.choices[0]?.message?.content || "").trim().replace(/^"|"$/g, "");
}

export async function suggestCompensation(ctx: ParcelContext): Promise<{
  amount: number;
  reasoning: string;
}> {
  const client = getOpenAIClient();
  const prompt = `You are pricing a peer-to-peer parcel delivery in South Africa (currency: ZAR).

Parcel:
- Origin: ${ctx.origin || "(not set)"}
- Destination: ${ctx.destination || "(not set)"}
- Distance: ${ctx.distanceKm ? `${ctx.distanceKm.toFixed(0)} km` : "(unknown)"}
- Size: ${ctx.size || "medium"}
- Weight: ${ctx.weight ? `${ctx.weight} kg` : "(unknown)"}
- Fragile: ${ctx.isFragile ? "Yes" : "No"}

Suggest a fair compensation amount in ZAR (Rand) that the sender should pay the carrier. Account for distance, size, weight, and fragility. Typical baseline: R30-R50 short trips, +R3-R5 per km for longer routes, premium for fragile/large items.

Respond with valid JSON only: {"amount": <integer>, "reasoning": "<one short sentence>"}`;

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 120,
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw);
  const amount = Math.max(20, Math.round(Number(parsed.amount) || 0));
  const reasoning = String(parsed.reasoning || "Based on distance, size, and weight.");
  return { amount, reasoning };
}

export type ChatTurn = { role: "sender" | "carrier"; text: string };

export async function suggestSmartReplies(
  history: ChatTurn[],
  myRole: "sender" | "carrier",
): Promise<string[]> {
  const client = getOpenAIClient();
  const transcript = history
    .slice(-10)
    .map((m) => `${m.role === myRole ? "Me" : "Them"}: ${m.text}`)
    .join("\n");

  const prompt = `You are helping a ${myRole} on a parcel delivery app reply to a chat with the other party. Suggest 3 short, natural reply options (each under 80 characters). They should be polite, practical, and varied (e.g. confirm, ask a question, propose a time).

Recent conversation:
${transcript || "(no messages yet)"}

Respond with valid JSON only: {"replies": ["...", "...", "..."]}`;

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 200,
    response_format: { type: "json_object" },
  });
  const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
  const replies = Array.isArray(parsed.replies) ? parsed.replies : [];
  return replies.map((r: any) => String(r)).filter(Boolean).slice(0, 3);
}

export type RouteStopSuggestion = {
  name: string;
  fullAddress: string;
  lat: number;
  lng: number;
  reason?: string;
};

export async function suggestRouteStops(input: {
  origin: string;
  destination: string;
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  existing?: string[];
}): Promise<RouteStopSuggestion[]> {
  const client = getOpenAIClient();
  const prompt = `You are helping a driver plan a route in South Africa. Suggest up to 5 useful intermediate stops (towns or cities) that lie roughly along the road between the origin and destination. Prefer real, well-known places that a delivery carrier could realistically pass through.

Origin: ${input.origin}${input.originLat ? ` (${input.originLat}, ${input.originLng})` : ""}
Destination: ${input.destination}${input.destinationLat ? ` (${input.destinationLat}, ${input.destinationLng})` : ""}
Already added stops (do not repeat): ${input.existing?.join(", ") || "(none)"}

For each stop provide: name (short), fullAddress (city, province, country), approximate lat/lng (decimal degrees), and a short reason (under 60 chars) why it's a useful stop.

Respond with valid JSON only: {"stops": [{"name": "...", "fullAddress": "...", "lat": -26.2, "lng": 28.04, "reason": "..."}]}`;

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    max_tokens: 600,
    response_format: { type: "json_object" },
  });
  const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
  const stops = Array.isArray(parsed.stops) ? parsed.stops : [];
  return stops
    .map((s: any) => ({
      name: String(s.name || "").trim(),
      fullAddress: String(s.fullAddress || s.name || "").trim(),
      lat: Number(s.lat),
      lng: Number(s.lng),
      reason: s.reason ? String(s.reason).trim() : undefined,
    }))
    .filter((s: RouteStopSuggestion) => s.name && Number.isFinite(s.lat) && Number.isFinite(s.lng))
    .slice(0, 5);
}

export type ParcelDetailsFromPhoto = {
  size: "small" | "medium" | "large";
  weight: number;
  isFragile: boolean;
  description: string;
  confidence: "low" | "medium" | "high";
};

export async function analyzeParcelPhoto(imageDataUrl: string): Promise<ParcelDetailsFromPhoto> {
  const client = getOpenAIClient();
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this parcel photo and extract delivery details. Estimate:
- size: "small" (fits in a backpack), "medium" (fits on a car seat), or "large" (needs trunk space)
- weight in kg (rough estimate, integer 1-30)
- isFragile: true if it looks like glass, electronics, or delicate items
- description: one short sentence (under 100 chars) describing the parcel
- confidence: "low", "medium", or "high" based on how clear the photo is

Respond with valid JSON only: {"size": "...", "weight": 0, "isFragile": false, "description": "...", "confidence": "..."}`,
          },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    temperature: 0.2,
    max_tokens: 200,
    response_format: { type: "json_object" },
  });
  const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
  const size = ["small", "medium", "large"].includes(parsed.size) ? parsed.size : "medium";
  return {
    size: size as "small" | "medium" | "large",
    weight: Math.max(1, Math.min(50, Math.round(Number(parsed.weight) || 1))),
    isFragile: !!parsed.isFragile,
    description: String(parsed.description || "").slice(0, 200),
    confidence: ["low", "medium", "high"].includes(parsed.confidence)
      ? parsed.confidence
      : "medium",
  };
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

export async function parseSearchIntent(query: string): Promise<SearchFilters> {
  const client = getOpenAIClient();
  const prompt = `Parse this natural language parcel search query into filter fields. The user is searching for parcels in a delivery app in South Africa.

Query: "${query}"

Available fields (omit any that don't apply):
- from: origin city/place name (string)
- to: destination city/place name (string)
- size: "small" | "medium" | "large"
- dateFilter: "today" or "thisWeek" (only these two literal values)
- maxPrice: maximum compensation in rand (number)
- minPrice: minimum compensation in rand (number)
- fragile: true if user mentions fragile

Examples:
"fragile boxes to Cape Town this weekend under R200" → {"to": "Cape Town", "fragile": true, "dateFilter": "thisWeek", "maxPrice": 200}
"small parcels from Joburg" → {"from": "Johannesburg", "size": "small"}
"anything to Durban today over R100" → {"to": "Durban", "dateFilter": "today", "minPrice": 100}

Respond with valid JSON only: {"filters": {...}}`;

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 200,
    response_format: { type: "json_object" },
  });
  const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
  const f = parsed.filters || {};
  const out: SearchFilters = {};
  if (typeof f.from === "string") out.from = f.from;
  if (typeof f.to === "string") out.to = f.to;
  if (["small", "medium", "large"].includes(f.size)) out.size = f.size;
  if (f.dateFilter === "today" || f.dateFilter === "thisWeek") out.dateFilter = f.dateFilter;
  if (Number.isFinite(Number(f.maxPrice))) out.maxPrice = Number(f.maxPrice);
  if (Number.isFinite(Number(f.minPrice))) out.minPrice = Number(f.minPrice);
  if (typeof f.fragile === "boolean") out.fragile = f.fragile;
  return out;
}

export type MatchInsight = { parcelId: string; reason: string; rating: "great" | "good" | "okay" };

export async function summarizeMatchingParcels(input: {
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
}): Promise<MatchInsight[]> {
  if (!input.parcels.length) return [];
  const client = getOpenAIClient();
  const prompt = `You're helping a carrier evaluate parcels offered for their route in South Africa.

Carrier's route: ${input.route.origin} → ${input.route.destination}${
    input.route.intermediateStops?.length
      ? ` (via ${input.route.intermediateStops.join(", ")})`
      : ""
  }

Parcels to evaluate:
${input.parcels
  .map(
    (p, i) =>
      `${i + 1}. id=${p.id} | ${p.origin} → ${p.destination} | size:${p.size}${
        p.weight ? ` ${p.weight}kg` : ""
      }${p.isFragile ? " fragile" : ""} | R${p.compensation}${
        p.senderRating ? ` | sender ★${p.senderRating}` : ""
      }${p.description ? ` | "${p.description.slice(0, 60)}"` : ""}`,
  )
  .join("\n")}

For each parcel, give a one-sentence reason (under 90 chars) why it's a good or poor fit, and rate it "great", "good", or "okay" based on alignment with the route, compensation fairness, and any practical concerns.

Respond with valid JSON only: {"insights": [{"parcelId": "...", "reason": "...", "rating": "great|good|okay"}]}`;

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 700,
    response_format: { type: "json_object" },
  });
  const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
  const arr = Array.isArray(parsed.insights) ? parsed.insights : [];
  return arr
    .map((i: any) => ({
      parcelId: String(i.parcelId || ""),
      reason: String(i.reason || "").slice(0, 200),
      rating: ["great", "good", "okay"].includes(i.rating) ? i.rating : "okay",
    }))
    .filter((i: MatchInsight) => i.parcelId && i.reason);
}

export type AssistantTurn = { role: "user" | "assistant"; content: string };

export async function assistantChat(messages: AssistantTurn[]): Promise<string> {
  const client = getOpenAIClient();
  const system = `You are the AI assistant for "The GTW", a parcel route-matching app where users send parcels and carriers transport them along their routes. Help users with:
- How to create a parcel listing or find one to transport
- Pricing guidance for compensation
- Pickup, delivery, and tracking questions
- Safety tips for senders and carriers
- Resolving chat / coordination questions

Be concise, friendly, and practical. If the user asks about something outside the app, gently steer back to delivery topics.`;

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      ...messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
    ],
    temperature: 0.6,
    max_tokens: 400,
  });
  return (res.choices[0]?.message?.content || "").trim();
}
