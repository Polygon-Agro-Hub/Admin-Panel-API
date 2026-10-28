const Joi = require("joi");

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