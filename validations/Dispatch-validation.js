const Joi = require('joi');
 
 exports.getPreMadePackages = Joi.object({
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(100).default(10).optional(),
    search: Joi.string().allow('').optional(),
    selectedStatus: Joi.string().allow('').optional(),
    date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .custom((value, helpers) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'Custom date validation')
});



exports.idValidate = Joi.object({
  id: Joi.number().integer().required(), // Ensures the `id` is a number and required
});

exports.getPackageItems = Joi.object({
  id: Joi.number().integer().required(),
  
});

exports.validateIsPackedUpdate = Joi.object({
  ids: Joi.array().items(Joi.number().integer().required()).required()
    .description('Array of numeric IDs to mark as packed'),
});

exports.geAdditionalItems = Joi.object({
  id: Joi.number().integer().required(),
  
});

exports.getCustomAdditionalItems = Joi.object({
  id: Joi.number().integer().required(),
  
});


exports.dispatchPackageSchema = Joi.array().items(
  Joi.object({
    id: Joi.number().integer().required(),
    isPacked: Joi.number().integer().valid(0, 1).required(),
    qty: Joi.alternatives().try(
      Joi.number(),
      Joi.string().pattern(/^\d+(\.\d{1,3})?$/) 
    ).required(),
    price: Joi.alternatives().try(
      Joi.number(),
      Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
    ).required()
  })
).min(1); 