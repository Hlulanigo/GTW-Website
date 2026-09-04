import { useEffect, useRef, useState } from "react";
import { auth } from "./firebase";

type RealtimeEvent =
  | { type: "connected"; userId: string }
  | { type: "message:new"; parcelId: string; message: any }
  | { type: "parcel:status"; parcelId: string; status: string; onTheMove: boolean }
  | { type: "presence:update"; userId: string; online: boolean; lastSeen: number | null }
  | { type: "typing"; parcelId: string; userId: string; isTyping: boolean }
  | { type: "pong" };

type Listener = (event: RealtimeEvent) => void;

const listeners = new Set<Listener>();
let socket: WebSocket | null = null;
let reconnectTimer: any = null;
let reconnectAttempts = 0;
let pingInterval: any = null;
let currentUserId: string | null = null;
const presenceCache = new Map<string, { online: boolean; lastSeen: number | null }>();

function emit(event: RealtimeEvent) {
  if (event.type === "presence:update") {
    presenceCache.set(event.userId, { online: event.online, lastSeen: event.lastSeen });
  }
  for (const l of listeners) {
    try { l(event); } catch (err) { console.error("Realtime listener error:", err); }
  }
}

function buildWsUrl(token: string): string {
  const origin = window.location.origin;
  const wsUrl = origin.replace(/^http/, "ws").replace(/\/$/, "");
  return `${wsUrl}/ws?token=${encodeURIComponent(token)}`;
}

async function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  const user = auth?.currentUser;
  if (!user) return;
  let token: string;
  try {
    token = await user.getIdToken();
  } catch (err) {
    console.error("Realtime: token fetch failed", err);
    scheduleReconnect();
    return;
  }
  try {
    const ws = new WebSocket(buildWsUrl(token));
    socket = ws;

    ws.onopen = () => {
      reconnectAttempts = 0;
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ type: "ping" })); } catch {}
        }
      }, 25000);
    };

    ws.onmessage = (e) => {
      try {
        emit(JSON.parse(typeof e.data === "string" ? e.data : e.data.toString()));
      } catch {}
    };

    ws.onclose = () => {
      socket = null;
      if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
      if (currentUserId) scheduleReconnect();
    };
  } catch (err) {
    console.error("Realtime: connect failed", err);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts++));
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function disconnect() {
  currentUserId = null;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
  if (socket) { try { socket.close(); } catch {} socket = null; }
  presenceCache.clear();
}

/**
 * Mount once at the app root. Connects when user is signed in.
 */
export function useRealtimeMount() {
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user?.uid) {
        currentUserId = user.uid;
        connect();
      } else {
        disconnect();
      }
    });
    return () => { unsub(); };
  }, []);
}

export function useRealtimeEvents(handler: Listener, deps: any[] = []) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const wrapped: Listener = (e) => ref.current(e);
    listeners.add(wrapped);
    return () => { listeners.delete(wrapped); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function usePresence(userIds: (string | null | undefined)[]) {
  const ids = userIds.filter((x): x is string => !!x);
  const key = ids.slice().sort().join(",");
  const [presence, setPresence] = useState<Record<string, { online: boolean; lastSeen: number | null }>>({});

  useEffect(() => {
    let cancelled = false;
    if (ids.length === 0) { setPresence({}); return; }
    (async () => {
      try {
        const res = await fetch(`/api/users/online?ids=${encodeURIComponent(key)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          for (const [uid, p] of Object.entries(data)) presenceCache.set(uid, p as any);
          setPresence({ ...data });
        }
      } catch {}
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useRealtimeEvents((e) => {
    if (e.type === "presence:update" && ids.includes(e.userId)) {
      setPresence(prev => ({ ...prev, [e.userId]: { online: e.online, lastSeen: e.lastSeen } }));
    }
  }, [key]);

  return presence;
}
