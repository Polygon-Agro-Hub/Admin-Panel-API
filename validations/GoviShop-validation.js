const Joi = require("joi");

exports.getByIdSchema = Joi.object({
  id: Joi.number().integer().required().positive(),
});


exports.getAllShopViewActionSchema = Joi.object({
    
    page: Joi.number().integer().optional(),
    status: Joi.string().optional(),
    searchText: Joi.string().optional()
});