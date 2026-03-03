const Joi = require("joi");

exports.getByIdSchema = Joi.object({
  id: Joi.number().integer().required().positive(),
});
