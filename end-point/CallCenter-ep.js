const ValidateSchema = require("../validations/CallCenter-validation");
const dwesk = require("../clients/dwesk.client");
const cfg = require("../config/dwesk.config");
const { colomboIso, colomboDate, TZ } = require("../utils/time");
const AppError = require("../utils/AppError");

// GET /api/call-center/ivr/call-summary
exports.getIvrCallSummary = async (req, res) => {
  const { value: params, error } = ValidateSchema.getIvrCallSummarySchema.validate(req.query);
  if (error) {
    const invalidDate = error.details.some(({ path }) => path[0] === "from" || path[0] === "to");
    throw new AppError(error.details.map(({ message }) => message).join("; "), {
      status: 400,
      code: invalidDate ? "INVALID_RANGE" : "INVALID_PARAMETER",
    });
  }

  // Calendar days are interpreted by Dwesk in Asia/Colombo. UTC arithmetic
  // here only measures the distance between the supplied calendar dates.
  const days = (Date.parse(`${params.to}T00:00:00Z`) - Date.parse(`${params.from}T00:00:00Z`)) / 86400000;
  if (days < 0 || days > 31) {
    throw new AppError("to must be on or after from and no more than 31 days later", {
      status: 400, code: "INVALID_RANGE",
    });
  }

  const { data } = await dwesk.get("/ivr/call-summary", { params });
  res.json(data);
};

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
