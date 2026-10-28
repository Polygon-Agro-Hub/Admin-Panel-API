const Joi = require("joi");

const calendarDay = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helpers) => {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return helpers.error("any.invalid");
  }
  return value;
});

exports.getIvrCallSummarySchema = Joi.object({
  flowId: Joi.number().integer().positive().max(Number.MAX_SAFE_INTEGER).required(),
  type: Joi.string().valid(
    "ALL_DIAL_CALLS", "OUT_DIAL_CALLS", "DIRECT_CALL_MAPPING",
    "CONNECT_AGENT_CALLS", "TRANSFER_CALLS", "CONFERENCE_CALLS", "IVR_UPLOAD_CALLS"
  ).required(),
  from: calendarDay.required(),
  to: calendarDay.required(),
  page: Joi.number().integer().min(1).max(Number.MAX_SAFE_INTEGER).default(1),
  size: Joi.number().integer().min(1).max(500).default(50),
});

// exports.getAllCertificateCompaniesSchema = Joi.object({
//   search: Joi.string().allow("").optional(),
//   page: Joi.number().integer().min(1).default(1),
//   limit: Joi.number().integer().min(1).max(100).default(10),
// });


exports.getCallCenterDashboardSchema = Joi.object({
  hour:   Joi.number().integer().min(0).max(23).optional(),
  range:  Joi.string().valid("13w", "26w", "12m", "24m").default("13w"),
  months: Joi.number().integer().min(2).max(12).default(2),
  search: Joi.string().allow("").max(100).default(""),
  page:   Joi.number().integer().min(1).default(1),
  limit:  Joi.number().integer().min(1).max(200).default(10),
  export: Joi.string().valid("csv").optional(),
});