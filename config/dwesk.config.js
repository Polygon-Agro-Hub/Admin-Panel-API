require("dotenv").config();

for (const k of ["DWESK_GATEWAY_BASE", "DWESK_API_KEY"]) {
  if (!process.env[k]) throw new Error(`Missing env var: ${k}`);
}

module.exports = {
  gatewayBase: process.env.DWESK_GATEWAY_BASE.replace(/\/$/, ""),
  apiKey: process.env.DWESK_API_KEY,
  timeoutMs: 30000,
  maxRetries: 2,
  companyName: process.env.COMPANY_NAME || "Polygon Holdings (Pvt) Ltd",
  healthCacheMs: Number(process.env.HEALTH_CACHE_MS || 30000),
};