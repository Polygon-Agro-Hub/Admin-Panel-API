const ValidateSchema = require("../validations/CallCenter-validation");
const dwesk = require("../clients/dwesk.client");
const cfg = require("../config/dwesk.config");
const { colomboIso, colomboDate, TZ } = require("../utils/time");

exports.getCallCenterDashbord = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    // const validatedQuery = await collectionofficerValidate.getPurchaseReport.validateAsync(req.query);

    console.log({data: 'data'});
    res.json({data: 'data'});
  } catch (err) {
    console.error("Error fetching daily report:", err);
    res.status(500).send("An error occurred while fetching the report.");
  }
};

exports.triggerRejectOffficerCache = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const officersData = await triggeGetRejectOfficers();

    
    res.json(officersData);
  } catch (err) {
    console.error("Error fetching daily report:", err);
    res.status(500).send("An error occurred while fetching the report.");
  }
};

/* ------------------------------------------------------------------ *
 * Gateway health check (used by A1 "telemetry status")
 * Dwesk has no PBX telemetry endpoint, so we call /call-records/counts
 * for today: if it answers, gateway + API key work => "active".
 * Cached so dashboard refreshes don't use the 60 req/min limit.
 * ------------------------------------------------------------------ */
let healthCache = { at: 0, value: null };
let healthInflight = null;
 
async function checkGateway() {
  const today = colomboDate();
  try {
    await dwesk.get("/call-records/counts", { params: { from: today, to: today } });
    return { status: "active", lastUpdated: colomboIso() };
  } catch (err) {
    console.error(`Gateway health check failed [${err.code}] ${err.message}`, err.transactionId || "");
    // keep the last good timestamp
    return { status: "offline", lastUpdated: healthCache.value?.lastUpdated || null };
  }
}
 
function getGatewayHealth() {
  if (healthCache.value && Date.now() - healthCache.at < cfg.healthCacheMs) {
    return Promise.resolve(healthCache.value);
  }
  if (!healthInflight) {
    healthInflight = checkGateway()
      .then((value) => {
        healthCache = { at: Date.now(), value };
        return value;
      })
      .finally(() => { healthInflight = null; });
  }
  return healthInflight;
}
 
/* ------------------------------------------------------------------ *
 * A1. Header banner
 * GET /api/call-center/header-banner
 * ------------------------------------------------------------------ */
exports.getHeaderBanner = async (req, res) => {
  const health = await getGatewayHealth();
  res.json({
    companyName: cfg.companyName,        // A1.1
    telemetryStatus: health.status,      // A1.2  "active" | "offline"
    lastUpdated: health.lastUpdated,     // A1.3
    currentDateTime: colomboIso(),       // A1.4
    timezone: TZ,
  });
};