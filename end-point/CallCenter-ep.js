const ValidateSchema = require("../validations/CallCenter-validation");
const dwesk = require("../clients/dwesk.client");
const cfg = require("../config/dwesk.config");
const AppError = require("../utils/AppError");
const { colomboIso, colomboDate, TZ } = require("../utils/time");


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

    console.log({ data: 'data' });
    res.json({ data: 'data' });
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

/* =====================================================================
 * Local call-record store (in memory)
 * Dwesk sends calls, not totals: we keep the records and count them with
 * Dwesk's published rules ("Dashboard Metrics"). Records are fetched with
 * the cursor API: full history on the first request, then only changes,
 * at most every nextPollAfter (5 min; calling earlier returns 429).
 * ===================================================================== */
const store = { records: new Map(), cursor: null, nextPollAfter: null, lastSyncedAt: null, lastError: null };
let syncInflight = null;

async function pullRecords() {
  let page;
  do {
    ({ data: page } = await dwesk.get("/call-records", { params: { cursor: store.cursor || undefined, limit: 1000 } }));
    for (const r of page.records) {
      const old = store.records.get(r.channelId);
      if (!old || new Date(r.updatedAt) >= new Date(old.updatedAt)) store.records.set(r.channelId, r); // 1 row per channelId
    }
    store.cursor = page.nextCursor; // saved per page: a failed run resumes here
  } while (page.hasMore);
  store.nextPollAfter = page.nextPollAfter;
  store.lastSyncedAt = colomboIso();
}

function ensureFresh() {
  const due = !store.cursor || !store.nextPollAfter || Date.now() >= Date.parse(store.nextPollAfter);
  if (!due) return Promise.resolve();
  if (!syncInflight) {
    syncInflight = pullRecords()
      .then(() => { store.lastError = null; })
      .catch((e) => { store.lastError = e; console.error(`Call records sync failed [${e.code}] ${e.message}`, e.transactionId || ""); })
      .finally(() => { syncInflight = null; });
  }
  return syncInflight;
}

/* ===================== helpers (rules from Dashboard Metrics) ===================== */
const INBOUND = new Set(["INCOMING", "CONNECT_DIAL", "QUEUE_DIAL"]);
const ANSWERED = new Set(["ANSWERED", "TRANSFER", "CONFERENCE"]);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const dayOf = (t) => t.slice(0, 10);
const hourOf = (t) => Number(t.slice(11, 13));
const secs = (a, b) => Math.trunc((Date.parse(b) - Date.parse(a)) / 1000);
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const avg = (v) => (v.length ? Math.floor(v.reduce((s, x) => s + x, 0) / v.length) : 0);
const fmtHour = (h) => (h === 0 ? "12AM" : h < 12 ? `${h}AM` : h === 12 ? "12PM" : `${h - 12}PM`);
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const signed = (n) => `${n >= 0 ? "+" : "-"}${Math.abs(n).toFixed(1)}%`;

const utc = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const toDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const weekStartOf = (d) => toDay(utc(d) - ((new Date(utc(d)).getUTCDay() + 6) % 7) * 86400000); // Monday
const isoWeekNo = (monday) => {
  const thu = utc(monday) + 3 * 86400000; // ISO week = week containing Thursday
  return Math.floor((thu - Date.UTC(new Date(thu).getUTCFullYear(), 0, 1)) / 604800000) + 1;
};

function groupCounts(rs) {
  const n = (f) => rs.filter(f).length;
  return {
    total: rs.length,
    inbound: n((r) => INBOUND.has(r.callType)),
    outbound: n((r) => r.callType === "OUTGOING"),
    answered: n((r) => ANSWERED.has(r.callStatus)),
    failed: n((r) => r.callStatus === "FAILED"),
    voicemail: n((r) => r.callStatus === "VOICEMAIL"),
    transfer: n((r) => r.callStatus === "TRANSFER"),
    conference: n((r) => r.callStatus === "CONFERENCE"),
    ringing: n((r) => r.callStatus === "RINGING"),
    waiting: n((r) => r.callStatus === "WAITING"),
    queueCalls: n((r) => r.callType === "QUEUE_DIAL"),
  };
}

function bucketsFor(range, today, dayCounts) {
  const weekly = range.endsWith("w");
  const n = parseInt(range, 10);
  const buckets = [];
  if (weekly) {
    const cur = weekStartOf(today);
    for (let i = n - 1; i >= 0; i--) {
      const ws = toDay(utc(cur) - i * 7 * 86400000);
      buckets.push({ key: ws, label: `W${isoWeekNo(ws)}`, weekStart: ws, calls: 0 });
    }
    for (const [d, c] of dayCounts) { const b = buckets.find((x) => x.key === weekStartOf(d)); if (b) b.calls += c; }
  } else {
    let y = +today.slice(0, 4), m = +today.slice(5, 7);
    for (let i = 0; i < n; i++) {
      buckets.unshift({ key: `${y}-${String(m).padStart(2, "0")}`, label: `${MON[m - 1]} ${y}`, calls: 0 });
      if (--m === 0) { m = 12; y--; }
    }
    for (const [d, c] of dayCounts) { const b = buckets.find((x) => x.key === d.slice(0, 7)); if (b) b.calls += c; }
  }
  return buckets;
}
const busiest = (items, key) => items.reduce((best, x) => (!best || x[key] > best[key] ? x : best), null); // earlier wins ties

/* =====================================================================
 * GET /api/call-center/dashboard
 * One JSON for sections A1-A10.  ?hour=&range=&months=&search=&page=&limit=
 * ?export=csv downloads the (filtered) recent-calls list instead.
 * ===================================================================== */
exports.getCallCenterDashbord = async (req, res) => {
  const { value: q, error } = ValidateSchema.getCallCenterDashboardSchema.validate(req.query, { abortEarly: false });
  if (error) throw new AppError("Validation failed", { status: 400, code: "VALIDATION_ERROR", details: error.details.map((d) => d.message) });

  await ensureFresh();
  if (!store.lastSyncedAt) {
    const e = store.lastError;
    throw new AppError("Call records are not available yet", {
      status: 503,
      code: "DWESK_UNAVAILABLE",
      transactionId: e?.transactionId,
      details: e ? { reason: e.code, httpStatus: e.status, message: e.message } : undefined,
    });
  }

  const now = colomboIso();
  const today = dayOf(now);
  const currentHour = hourOf(now);
  const all = [...store.records.values()].filter((r) => r.callStartTime); // no callStartTime = not counted
  const todays = all.filter((r) => dayOf(r.callStartTime) === today);
  const c = groupCounts(todays);

  /* ---- A10 recent calls (built first: export shortcut) ---- */
  const needle = q.search.trim().toLowerCase();
  const recent = all
    .filter((r) => !needle || [r.callerNumber, r.id, r.agentCli, r.callType, r.callStatus].some((v) => String(v ?? "").toLowerCase().includes(needle)))
    .sort((a, b) => Date.parse(b.callStartTime) - Date.parse(a.callStartTime))
    .map((r) => {
      const d = r.callEndTime ? Math.max(0, secs(r.callStartTime, r.callEndTime)) : null;
      return {
        id: r.id,
        callerNumber: r.callerNumber,
        callType: r.callType,
        direction: r.callType === "OUTGOING" ? "outgoing" : "incoming",
        callStartTime: r.callStartTime,
        agentCli: r.agentCli,
        agent: r.agentCli ? `${r.agentCli}@${cfg.agentDomain}` : null,
        durationSeconds: d,
        duration: d === null ? "N/A" : mmss(d),
        status: r.callStatus,
      };
    });

  if (q.export === "csv") {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Call ID", "Caller", "Type", "Direction", "Start", "Agent", "Duration", "Status"];
    const csv = [head.map(esc).join(",")]
      .concat(recent.map((r) => [r.id, r.callerNumber, r.callType, r.direction, r.callStartTime, r.agent, r.duration, r.status].map(esc).join(",")))
      .join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="call-records-${today}.csv"`);
    return res.send(csv);
  }

  /* ---- A4 / A5 hourly ---- */
  const selectedHour = q.hour ?? currentHour;
  const hourRs = todays.filter((r) => hourOf(r.callStartTime) === selectedHour);
  const h = groupCounts(hourRs);
  const tile = (n) => ({ count: n, percent: pct(n, h.total) });
  const tiles = {
    incoming: tile(h.inbound), answered: tile(h.answered), outgoing: tile(h.outbound), failed: tile(h.failed),
    voicemail: tile(h.voicemail), transfer: tile(h.transfer), conference: tile(h.conference),
  };

  const last = Math.min(cfg.workingHoursEnd, currentHour);
  const bars = [];
  for (let x = cfg.workingHoursStart; x <= last; x++) bars.push({ hour: x, label: fmtHour(x), calls: 0 });
  for (const r of todays) { const b = bars.find((y) => y.hour === hourOf(r.callStartTime)); if (b) b.calls++; }
  const peak = busiest(bars, "calls");
  const maxCalls = peak?.calls || 0;
  const hourly = bars.map((b) => ({ ...b, percentOfPeak: maxCalls ? Math.round((b.calls / maxCalls) * 100) : 0 }));

  /* ---- A7 average times ---- */
  const avgHandle = avg(todays.filter((r) => ANSWERED.has(r.callStatus) && r.callEndTime).map((r) => secs(r.callStartTime, r.callEndTime)));
  const ringToConnect = avg(todays.filter((r) => r.agentRingStartTime && r.agentConnectTime).map((r) => secs(r.agentRingStartTime, r.agentConnectTime)));
  const avgWait = avg(todays.filter((r) => r.callStatus === "FAILED" && r.agentRingStartTime && r.callEndTime).map((r) => secs(r.agentRingStartTime, r.callEndTime)));

  /* ---- A8 trends / A9 monthly ---- */
  const dayCounts = new Map();
  for (const r of all) dayCounts.set(dayOf(r.callStartTime), (dayCounts.get(dayOf(r.callStartTime)) || 0) + 1);

  const tb = bucketsFor(q.range, today, dayCounts);
  const inRange = tb.reduce((s, b) => s + b.calls, 0);
  const bp = busiest(tb, "calls");
  const weekly = q.range.endsWith("w");

  const months = bucketsFor(`${q.months}m`, today, dayCounts).map(({ key, label, calls }) => ({ key, label, calls }));
  const [prevM, curM] = months.slice(-2);
  const growth = prevM && prevM.calls > 0 ? Math.round(((curM.calls - prevM.calls) / prevM.calls) * 1000) / 10 : null;

  const totalPages = Math.max(1, Math.ceil(recent.length / q.limit));

  res.json({
    /* A1 */
    header: {
      companyName: cfg.companyName,
      telemetryStatus: store.lastError ? "offline" : "active", // data feed health, not PBX health
      lastUpdated: store.lastSyncedAt,
      currentDateTime: now,
      timezone: TZ,
    },
    /* A2 */
    topCards: {
      queue: { waiting: c.waiting, ringing: c.ringing, state: c.ringing === 0 ? "idle" : "active" },
      answerRate: pct(c.answered, c.total),
      answeredCalls: c.answered,
      peakHour: { hour: peak?.hour ?? null, label: peak ? fmtHour(peak.hour) : null, calls: maxCalls },
    },
    /* A3 */
    summaryCards: {
      totalCalls: c.total,
      answerRate: pct(c.answered, c.total),
      answeredCalls: c.answered,
      answerRateTarget: cfg.answerRateTarget,
      meetsTarget: pct(c.answered, c.total) >= cfg.answerRateTarget,
      queue: { waiting: c.waiting, ringing: c.ringing, state: c.ringing === 0 ? "idle" : "active" },
      avgHandleSeconds: avgHandle,
      handoffEvents: c.transfer + c.conference,
      holdTimeSeconds: null, // not recorded by the PBX / not in call records
    },
    /* A4 */
    timeline: {
      selectedHour,
      selectedHourLabel: `${String(selectedHour).padStart(2, "0")}:00`,
      totalInHour: h.total,
      tiles,
      mix: Object.entries(tiles).map(([key, v]) => ({ key, ...v })),
      activePbxTrunks: null, // not available from the Dwesk API
      engineStatus: null,    // not available from the Dwesk API
    },
    /* A5 */
    hourlyDistribution: { hours: hourly, workingHours: { start: cfg.workingHoursStart, end: cfg.workingHoursEnd } },
    /* A6 */
    callSummary: {
      inbound: { count: c.inbound, percent: pct(c.inbound, c.total) },
      outbound: { count: c.outbound, percent: pct(c.outbound, c.total) },
      voicemailOutcomes: c.voicemail,
      handoffEvents: c.transfer + c.conference,
    },
    /* A7 */
    serviceQuality: {
      answerRate: { percent: pct(c.answered, c.total), answered: c.answered },
      failureRate: { percent: pct(c.failed, c.total), failed: c.failed },
      avgWaitSeconds: avgWait,
      ringToConnectSeconds: ringToConnect,
      avgHandleSeconds: avgHandle,
      busiestHour: { hour: peak?.hour ?? null, label: peak ? fmtHour(peak.hour) : null, calls: maxCalls },
      counters: { queue: c.queueCalls, voicemail: c.voicemail, transfers: c.transfer, conference: c.conference },
    },
    /* A8 */
    trends: {
      range: q.range,
      timeRange: { label: weekly ? `${parseInt(q.range, 10)} Weeks` : `${parseInt(q.range, 10)} Months`, view: weekly ? "Weekly view" : "Monthly view" },
      buckets: tb.map(({ key, ...b }) => b),
      callsInRange: inRange,
      averagePerBucket: Math.round(inRange / tb.length),
      busiestPeriod: bp ? { label: bp.label, weekStart: bp.weekStart ?? null, calls: bp.calls } : null,
    },
    /* A9 */
    monthlyOverview: {
      months,
      growthPercent: growth,
      growthLabel: growth === null ? null : signed(growth),
    },
    /* A10 */
    recentCalls: {
      records: recent.slice((q.page - 1) * q.limit, q.page * q.limit),
      pagination: { page: q.page, limit: q.limit, total: recent.length, totalPages },
    },
  });
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SIZE = 100;

const liveCallStore = new Map();
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
          const prev = liveCallStore.get(r.channelId);
          if (!prev || Date.parse(r.updatedAt) >= Date.parse(prev.updatedAt)) {
            liveCallStore.set(r.channelId, r);
          }
        }
        cursor = data.nextCursor;
        hasMore = data.hasMore;
        nextPollAfter = data.nextPollAfter ? Date.parse(data.nextPollAfter) : 0;
      }
      lastSyncedAt = new Date().toISOString();
    } catch (err) {
      if (liveCallStore.size && (err.code === "TOO_EARLY" || err.code === "RATE_LIMITED")) return;
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

  let rows = Array.from(liveCallStore.values())
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
