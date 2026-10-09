const Joi = require("joi");

exports.getAllCropCalendarSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  searchText: Joi.string().optional(),
  category: Joi.string().optional(),
});

exports.deleteCropCalenderSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

exports.uploadXLSXSchema = Joi.object({
  id: Joi.string().required(),
});

exports.getAllCropGroupsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  searchText: Joi.string().optional(),
  category: Joi.string().allow("").optional(),
  displayFor: Joi.string().valid("Farmery", "Sales", "Both").allow("", null).optional(),
});

exports.deleteCropCalenderSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

exports.getAllTaskByCropIdSchema = Joi.object({
  id: Joi.number().integer().required().messages({
    "any.required": "Crop ID is required",
    "number.base": "Crop ID must be a number",
    "number.integer": "Crop ID must be an integer",
  }),
});
