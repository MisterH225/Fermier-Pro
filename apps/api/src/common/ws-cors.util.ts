/** Origines CORS WebSocket alignées sur CORS_ORIGINS de l'API REST. */
export function websocketCorsOptions() {
  return {
    origin:
      process.env.CORS_ORIGINS?.split(",")
        .map((o) => o.trim())
        .filter(Boolean) ?? ["http://localhost:3001", "http://127.0.0.1:3001"],
    credentials: true as const
  };
}
