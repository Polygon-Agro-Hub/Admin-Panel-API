const ValidateSchema = require("../validations/CallCenter-validation");
const dwesk = require("../clients/dwesk.client");
const cfg = require("../config/dwesk.config");
const { colomboIso, colomboDate, TZ } = require("../utils/time");
const AppError = require("../utils/AppError");

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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SIZE = 100;

const store = new Map();      
let cursor = null;          
let nextPollAfter = 0;     
let lastSyncedAt = null;
let syncing = null;

async function syncCallRecords() {
  if (syncing) return syncing;                      
  if (cursor && Date.now() < nextPollAfter) return;

  syncing = (async () => {
    try {
      let hasMore = true;
      while (hasMore) {
        const { data } = await dwesk.get("/call-records", {
          params: { limit: 1000, ...(cursor ? { cursor } : {}) },
        });
        for (const r of data.records) {
          const prev = store.get(r.channelId);
          if (!prev || Date.parse(r.updatedAt) >= Date.parse(prev.updatedAt)) {
            store.set(r.channelId, r);
          }
        }
        cursor = data.nextCursor;
        hasMore = data.hasMore;
        nextPollAfter = data.nextPollAfter ? Date.parse(data.nextPollAfter) : 0;
      }
      lastSyncedAt = new Date().toISOString();
    } catch (err) {
      if (store.size && (err.code === "TOO_EARLY" || err.code === "RATE_LIMITED")) return;
      throw err;
    }
  })().finally(() => { syncing = null; });

  return syncing;
}

const toRowTime = (iso) => (iso ? iso.replace("T", " ").slice(0, 19) : null);

function mapStatus(r) {
  switch (r.callStatus) {
    case "ANSWERED":
    case "TRANSFER":
    case "CONFERENCE":
      return "ANSWERED";
    case "FAILED":
    case "VOICEMAIL":
      return "MISSED";
    case null:
    case undefined:
      return r.callEndTime ? "MISSED" : "ONGOING";
    default:
      return "ONGOING";
  }
}

function describe(r) {
  const agent = r.agentCli ? String(r.agentCli) : "-";
  switch (r.callStatus) {
    case "ANSWERED":
      return `Call answered by agent (CLI: ${agent}, AT: ${toRowTime(r.agentConnectTime)})`;
    case "TRANSFER":
      return `Call answered by agent (CLI: ${agent}) and transferred`;
    case "CONFERENCE":
      return `Call answered by agent (CLI: ${agent}) and became a conference`;
    case "VOICEMAIL":
      return "Caller left a voicemail";
    case "FAILED":
      return r.agentRingStartTime ? "Agent was rung but did not answer" : "Call ended without reaching an agent";
    case "WAITING":
      return "Caller is waiting in the queue";
    case "RINGING":
      return "Agent phone is ringing";
    default:
      return r.callEndTime ? "Call ended in IVR" : "Call is in IVR";
  }
}

const mapRecord = (r) => ({
  id: r.id,
  flow: r.callFlowId != null ? String(r.callFlowId) : "-",
  fromMain: r.callerNumber || "",
  fromSub: r.agentCli != null ? String(r.agentCli) : "",
  toMain: r.agentCli != null ? String(r.agentCli) : "",
  toSub: r.callerNumber || "",
  time: toRowTime(r.callStartTime),
  type: r.callType,
  status: mapStatus(r),
  description: describe(r),
});

const phoneMatches = (row, term) => {
  const t = term.replace(/^0+/, "");
  return [row.fromMain, row.fromSub, row.toMain, row.toSub]
    .some((v) => v && v.replace(/\D/g, "").includes(t));
};

exports.getIvrLiveCalls = async (req, res) => {
  const { from, to } = req.query;
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
    throw new AppError("from/to must be yyyy-MM-dd", { status: 400, code: "INVALID_RANGE" });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const size = Math.min(MAX_SIZE, Math.max(1, parseInt(req.query.size, 10) || 10));

  const statuses = String(req.query.status || "")
    .split(",").map((s) => s.trim().toUpperCase())
    .filter((s) => s === "ANSWERED" || s === "MISSED");
  const search = String(req.query.search || "").replace(/\D/g, "");

  await syncCallRecords();

  let rows = Array.from(store.values())
    .sort((a, b) => Date.parse(b.callStartTime) - Date.parse(a.callStartTime) || b.id - a.id)
    .map(mapRecord);

  if (from) rows = rows.filter((r) => r.time && r.time.slice(0, 10) >= from);
  if (to) rows = rows.filter((r) => r.time && r.time.slice(0, 10) <= to);
  if (statuses.length) rows = rows.filter((r) => statuses.includes(r.status));
  if (search) rows = rows.filter((r) => phoneMatches(r, search));

  const totalItems = rows.length;
  res.json({
    page, size, totalItems,
    totalPages: Math.ceil(totalItems / size),
    syncedAt: lastSyncedAt,
    nextSyncAfter: nextPollAfter ? new Date(nextPollAfter).toISOString() : null,
    items: rows.slice((page - 1) * size, page * size),
  });
};