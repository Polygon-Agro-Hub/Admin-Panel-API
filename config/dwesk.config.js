require("dotenv").config({ override: true }); // .env wins over any old system/PM2/Docker value

const clean = (v) => (v || "").trim().replace(/^["']|["']$/g, "");

const GATEWAY_BASE = clean(process.env.DWESK_GATEWAY_BASE).replace(/\/+$/, "");
const API_KEY = clean(process.env.DWESK_API_KEY);

if (!GATEWAY_BASE || !API_KEY) throw new Error("Missing DWESK_GATEWAY_BASE or DWESK_API_KEY");

// TEMPORARY: remove after it works (never log the full key)
console.log(`Dwesk: base=${GATEWAY_BASE} key starts "${API_KEY.slice(0, 4)}" length=${API_KEY.length}`);
// ---- Dashboard settings (edit here) ----
const COMPANY_NAME = "Polygon Holdings (Pvt) Ltd";
const ANSWER_RATE_TARGET = 95;
const WORKING_HOURS_START = 8;
const WORKING_HOURS_END = 18;
const AGENT_DOMAIN = "dwesk.cloud"; // shown as 779994374@dwesk.cloud

module.exports = {
    gatewayBase: GATEWAY_BASE,
    apiKey: API_KEY,
    timeoutMs: 30000,
    maxRetries: 2,

    companyName: COMPANY_NAME,
    answerRateTarget: ANSWER_RATE_TARGET,
    workingHoursStart: WORKING_HOURS_START,
    workingHoursEnd: WORKING_HOURS_END,
    agentDomain: AGENT_DOMAIN,
};