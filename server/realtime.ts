import type { Server as HttpServer, IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { verifyFirebaseToken } from "./firebase-admin";

type Client = WebSocket & {
  userId?: string;
  isAlive?: boolean;
  parcelSubscriptions?: Set<string>;
};

const clientsByUser = new Map<string, Set<Client>>();
const lastSeenByUser = new Map<string, number>();
let wssRef: WebSocketServer | null = null;

function addClient(userId: string, ws: Client) {
  let set = clientsByUser.get(userId);
  if (!set) {
    set = new Set();
    clientsByUser.set(userId, set);
  }
  const wasOffline = set.size === 0;
  set.add(ws);
  if (wasOffline) {
    broadcastPresence(userId, true);
  }
}

function removeClient(userId: string, ws: Client) {
  const set = clientsByUser.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    clientsByUser.delete(userId);
    lastSeenByUser.set(userId, Date.now());
    broadcastPresence(userId, false);
  }
}

function send(ws: WebSocket, data: any) {
  if (ws.readyState === ws.OPEN) {
    try {
      ws.send(JSON.stringify(data));
    } catch (err) {
      console.error("WS send error:", err);
    }
  }
}

export function isUserOnline(userId: string): boolean {
  const set = clientsByUser.get(userId);
  return !!set && set.size > 0;
}

export function getLastSeen(userId: string): number | null {
  return lastSeenByUser.get(userId) ?? null;
}

export function broadcastToUser(userId: string, event: any) {
  const set = clientsByUser.get(userId);
  if (!set) return;
  for (const ws of set) send(ws, event);
}

export function broadcastToUsers(userIds: (string | null | undefined)[], event: any) {
  const seen = new Set<string>();
  for (const id of userIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    broadcastToUser(id, event);
  }
}

function broadcastPresence(userId: string, online: boolean) {
  if (!wssRef) return;
  const payload = {
    type: "presence:update",
    userId,
    online,
    lastSeen: online ? null : lastSeenByUser.get(userId) ?? Date.now(),
  };
  for (const ws of wssRef.clients) {
    send(ws, payload);
  }
}

export function setupRealtime(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  wssRef = wss;

  wss.on("connection", async (ws: Client, req: IncomingMessage) => {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      const token = url.searchParams.get("token");
      if (!token) {
        ws.close(4001, "Missing token");
        return;
      }
      let decoded: any;
      try {
        decoded = await verifyFirebaseToken(token);
      } catch {
        ws.close(4002, "Invalid token");
        return;
      }
      const userId = decoded.uid as string;
      ws.userId = userId;
      ws.isAlive = true;
      ws.parcelSubscriptions = new Set();
      addClient(userId, ws);

      send(ws, { type: "connected", userId });

      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("message", (raw) => {
        let msg: any;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (!msg || typeof msg !== "object") return;

        if (msg.type === "ping") {
          send(ws, { type: "pong" });
          return;
        }
        if (msg.type === "subscribe:parcel" && typeof msg.parcelId === "string") {
          ws.parcelSubscriptions!.add(msg.parcelId);
          return;
        }
        if (msg.type === "unsubscribe:parcel" && typeof msg.parcelId === "string") {
          ws.parcelSubscriptions!.delete(msg.parcelId);
          return;
        }
        if (msg.type === "typing" && typeof msg.parcelId === "string" && Array.isArray(msg.recipientIds)) {
          broadcastToUsers(msg.recipientIds, {
            type: "typing",
            parcelId: msg.parcelId,
            userId,
            isTyping: !!msg.isTyping,
          });
          return;
        }
      });

      ws.on("close", () => {
        if (ws.userId) removeClient(ws.userId, ws);
      });

      ws.on("error", () => {
        if (ws.userId) removeClient(ws.userId, ws);
      });
    } catch (err) {
      console.error("WS connection error:", err);
      try { ws.close(1011, "Server error"); } catch {}
    }
  });

  // Heartbeat — kill dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const c = ws as Client;
      if (c.isAlive === false) {
        try { c.terminate(); } catch {}
        return;
      }
      c.isAlive = false;
      try { c.ping(); } catch {}
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  console.log("Realtime WebSocket server listening on /ws");
  return wss;
}
