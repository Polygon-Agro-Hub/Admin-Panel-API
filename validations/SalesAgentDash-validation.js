const Joi = require('joi');

exports.getAllSalesAgentsSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(100).default(10).optional(),
    date: Joi.string().optional(),
    status: Joi.string().optional(),
    searchText: Joi.string().optional(),
    ratingFilter: Joi.string().valid('VVIP', 'VIP', 'COR', 'NOR', 'VVP').allow('').optional(),
    agentFilter: Joi.number().integer().optional(),
});

exports.deleteSalesAgentSchema = Joi.object({
    id: Joi.number().integer().positive().required()
});


exports.getPendingWholesaleBuyersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  searchText: Joi.string().allow("", null).optional(),
  onboarded: Joi.string().allow("", null).optional(), // 'Polygon' or an empId like 'SA0001'
  status: Joi.string().valid("To Review", "Approve", "Reject").default("To Review"),
});

