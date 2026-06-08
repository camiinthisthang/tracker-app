// Pin the server timezone at startup so weekly/daily goal-ring boundaries
// ("this week", per-day buckets) align with the agency's operating timezone
// instead of the host's. Vercel runs in UTC, which rolls the week over at
// Sun 7pm Central and blanks every creator's rings until Monday fills up.
//
// `TZ` is a reserved env-var name on Vercel, so we can't set it through the
// dashboard — we set it here instead. Node re-reads process.env.TZ when it
// changes, so subsequent Date math uses this zone. Force-assign rather than
// fall back to the existing value, since the platform sets TZ=UTC.
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.TZ = "America/Chicago";
  }
}
