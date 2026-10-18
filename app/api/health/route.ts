// Liveness probe for load balancers and uptime checks. Route handlers are not
// cached by default, so every request reports the current time.
export function GET() {
  return Response.json({ status: "ok", timestamp: new Date().toISOString() });
}
