const Joi = require('joi');

exports.getAllSalesAgentsSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(100).default(10).optional(),
    date: Joi.string().optional(),
    status: Joi.string().optional(),
    searchText: Joi.string().optional()
});

exports.deleteSalesAgentSchema = Joi.object({
    id: Joi.number().integer().positive().required()
});
