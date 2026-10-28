const axios = require("axios");
const { randomUUID } = require("crypto");
const cfg = require("../config/dwesk.config");
const AppError = require("../utils/AppError");

const dwesk = axios.create({
  baseURL: cfg.gatewayBase,
  timeout: cfg.timeoutMs,
  headers: { "X-API-Key": cfg.apiKey },
});

// Fresh transaction ID on every request (also on retries)
dwesk.interceptors.request.use((c) => {
  c.headers["X-Transaction-Id"] = randomUUID();
  return c;
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry on 429 / 5xx / network errors; normalise errors to AppError
dwesk.interceptors.response.use(
  (res) => res,
  async (err) => {
    const c = err.config;
    const status = err.response?.status;
    c.__retries = c.__retries || 0;

    if ((!err.response || status === 429 || status >= 500) && c.__retries < cfg.maxRetries) {
      c.__retries += 1;
      const wait = Number(err.response?.headers?.["retry-after"]);
      await sleep(status === 429 && wait ? wait * 1000 : 500 * 2 ** c.__retries);
      return dwesk.request(c);
    }

    const body = err.response?.data || {};
    throw new AppError(body.message || err.message, {
      status: status || 502,
      code: body.code || "DWESK_UNREACHABLE",
      transactionId: body.transactionId,
      details: body,
    });
  }
);

module.exports = dwesk; // usage: const { data } = await dwesk.get("/call-records", { params })