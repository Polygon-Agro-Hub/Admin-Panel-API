const Joi = require('joi');

// Validation schema for creating agent commission
const createAgentCommissionSchema = Joi.object({
  minRange: Joi.number().integer().min(0).required()
    .messages({
      'number.base': 'Minimum range must be a number',
      'number.integer': 'Minimum range must be an integer',
      'number.min': 'Minimum range cannot be negative',
      'any.required': 'Minimum range is required'
    }),
  maxRange: Joi.number().integer().min(0).required()
    .messages({
      'number.base': 'Maximum range must be a number',
      'number.integer': 'Maximum range must be an integer',
      'number.min': 'Maximum range cannot be negative',
      'any.required': 'Maximum range is required'
    }),
  value: Joi.number().precision(2).min(0).required()
    .messages({
      'number.base': 'Commission value must be a number',
      'number.precision': 'Commission value can have maximum 2 decimal places',
      'number.min': 'Commission value cannot be negative',
      'any.required': 'Commission value is required'
    }),
  modifyBy: Joi.number().integer().optional()
}).custom((value, helpers) => {
  // Custom validation to ensure maxRange is greater than minRange
  if (value.minRange >= value.maxRange) {
    return helpers.error('any.custom', {
      message: 'Maximum range must be greater than minimum range'
    });
  }
  return value;
});

// Validation schema for updating agent commission
const updateAgentCommissionSchema = Joi.object({
  minRange: Joi.number().integer().min(0).optional()
    .messages({
      'number.base': 'Minimum range must be a number',
      'number.integer': 'Minimum range must be an integer',
      'number.min': 'Minimum range cannot be negative'
    }),
  maxRange: Joi.number().integer().min(0).optional()
    .messages({
      'number.base': 'Maximum range must be a number',
      'number.integer': 'Maximum range must be an integer',
      'number.min': 'Maximum range cannot be negative'
    }),
  value: Joi.number().precision(2).min(0).optional()
    .messages({
      'number.base': 'Commission value must be a number',
      'number.precision': 'Commission value can have maximum 2 decimal places',
      'number.min': 'Commission value cannot be negative'
    }),
  modifyBy: Joi.number().integer().optional()
}).custom((value, helpers) => {
  // Custom validation to ensure maxRange is greater than minRange when both are provided
  if (value.minRange && value.maxRange && value.minRange >= value.maxRange) {
    return helpers.error('any.custom', {
      message: 'Maximum range must be greater than minimum range'
    });
  }
  return value;
});

// Validation schema for ID parameter
const idSchema = Joi.object({
  id: Joi.number().integer().min(1).required()
    .messages({
      'number.base': 'ID must be a number',
      'number.integer': 'ID must be an integer',
      'number.min': 'ID must be greater than 0',
      'any.required': 'ID is required'
    })
});

// Validation schema for pagination and filtering
const getAllSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1)
    .messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1'
    }),
  limit: Joi.number().integer().min(1).max(100).default(10)
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
  search: Joi.string().allow('').optional()
});

const getAllFarmerPaymentsSchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bank: Joi.string().allow('').optional(),
});

const createPaymentHistorySchema = Joi.object({
  receivers: Joi.string().required().trim().min(1).max(255),
  amount: Joi.number().required().positive().precision(2),
  paymentReference: Joi.string().required().trim().min(1).max(255)
});

const updatePaymentHistorySchema = Joi.object({
  receivers: Joi.string().required().trim().min(1).max(255),
  amount: Joi.number().required().positive().precision(2),
  paymentReference: Joi.string().required().trim().min(1).max(255)
});

const getAllInvestmentSchema = Joi.object({
  id: Joi.number().required(),
  status: Joi.string().optional(),
  search: Joi.string().optional()
});

const getInvestmentIdSchema = Joi.object({
  id: Joi.string().required(),
});


const paymentHistoryIdSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});


module.exports = {
  createAgentCommissionSchema,
  updateAgentCommissionSchema,
  idSchema,
  getAllSchema,
  getAllFarmerPaymentsSchema,
   createPaymentHistorySchema,
  updatePaymentHistorySchema,
  paymentHistoryIdSchema,
  getAllInvestmentSchema,
  getInvestmentIdSchema
};