const realtimeToken = import.meta.env.VITE_REALTIME_API_TOKEN?.trim();

export function getRealtimeWebSocketUrl(): string | null {
  if (!realtimeToken) return null;

  const url = new URL("/realtime", window.location.href);
  url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", realtimeToken);
  return url.toString();
}

export function getRealtimeAuthorizationHeaders(): HeadersInit {
  return realtimeToken
    ? { Authorization: `Bearer ${realtimeToken}` }
    : {};
}
