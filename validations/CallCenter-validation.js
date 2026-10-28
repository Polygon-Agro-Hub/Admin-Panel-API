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
