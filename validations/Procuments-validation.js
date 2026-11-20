const Joi = require("joi");

exports.getAllAdminUsersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  role: Joi.number().integer().optional(),
  search: Joi.string().optional(),
});

exports.getAllOrderSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().optional(),
  method: Joi.string().optional(),
  searchItem: Joi.string().optional(),
  formattedDate: Joi.string().optional(),
  scheduleDate: Joi.string().optional(),
});

exports.downloadOrdersSchema = Joi.object({
  orderedFrom: Joi.string().isoDate().required(),
  orderedTo: Joi.string().isoDate().required(),
  scheduledFrom: Joi.string().isoDate().allow("", null),
  scheduledTo: Joi.string().isoDate().allow("", null),
  confirmation: Joi.string().valid("Confirmed", "Not Confirmed").required(),
});