const Joi = require("joi");

exports.getByIdSchema = Joi.object({
  id: Joi.number().integer().required().positive(),
});

exports.getAllShopViewActionSchema = Joi.object({
  page: Joi.number().integer().optional(),
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