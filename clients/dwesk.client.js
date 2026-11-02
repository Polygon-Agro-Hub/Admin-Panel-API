const axios = require("axios");
const { randomUUID } = require("crypto");
const cfg = require("../config/dwesk.config");
const AppError = require("../utils/AppError");

const dwesk = axios.create({
  baseURL: cfg.gatewayBase,
  timeout: cfg.timeoutMs,
  headers: { "X-API-Key": cfg.apiKey },
});

dwesk.interceptors.request.use((c) => {
  c.headers["X-Transaction-Id"] = randomUUID();
  return c;
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

dwesk.interceptors.response.use(
  (res) => res,
  async (err) => {
    const c = err.config;
    const status = err.response?.status;
    if (c) c.__retries = c.__retries || 0;

    const wait = Number(err.response?.headers?.["retry-after"]);
    const tooLong = status === 429 && wait > 10; // don't hang a request (e.g. TOO_EARLY = minutes)

    if (
      (!err.response || status === 429 || status >= 500) && !tooLong &&
      c.__retries < cfg.maxRetries
    ) {
      c.__retries += 1;
      await sleep(
        status === 429 && wait ? wait * 1000 : 500 * 2 ** c.__retries,
      );
      return dwesk.request(c);
    }

    let body = err.response?.data || {};
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    throw new AppError(body.message || err.message, {
      status: status || 502,
      code: body.code || (status ? `DWESK_HTTP_${status}` : "DWESK_UNREACHABLE"),
      transactionId: body.transactionId,
      details: body,
    });
  },
);

module.exports = dwesk;
