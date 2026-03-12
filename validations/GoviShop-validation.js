const Joi = require("joi");

exports.getByIdSchema = Joi.object({
  id: Joi.number().integer().required().positive(),
});

exports.getAllShopViewActionSchema = Joi.object({
  allSuppliers: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(10).optional(),
  status: Joi.string().optional(),
  searchText: Joi.string().optional(),
});

exports.viewGoviShopSupplierByIdSchema = Joi.object({
  id: Joi.number().integer().required().positive(),
});

exports.goviShopViewDocumentByIdSchema = Joi.object({
  id: Joi.number().integer().required().positive(),
});

exports.updateGoviShopUserParamsSchema = Joi.object({
  id: Joi.number().integer().required().positive(),
});

exports.updateGoviShopUserBodySchema = Joi.object({
  status: Joi.string().valid("Activate", "Deactivate", "Rejected", "Expired").required(),
});