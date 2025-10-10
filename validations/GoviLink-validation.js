const Joi = require("joi");

exports.changePackageStatusValidation = Joi.object({
  id: Joi.number().min(0).positive().required(),
  status: Joi.string().required(),
});
