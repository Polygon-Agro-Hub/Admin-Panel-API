const Joi = require("joi");

exports.getAllDailyTargetSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(10).optional(),
  searchText: Joi.string().allow("").optional(),
});

exports.downloadDailyTargetSchema = Joi.object({
  fromDate: Joi.date().required(),
  toDate: Joi.date().required(),
});

exports.getCentersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(10).optional(),
  search: Joi.string().allow("").optional(),
  grade: Joi.string().optional(),
  status: Joi.string().optional(),
});

exports.getOfficerDetailsSchema = Joi.object({
  centerId: Joi.number().integer().optional(),
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(10).optional(),
  role: Joi.string().allow("").optional(),
  status: Joi.string().optional(),
  searchText: Joi.string().optional(),
});

exports.getAllPriceDetailSchema = Joi.object({
  centerId: Joi.number().integer().optional(),
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(10).optional(),
  grade: Joi.string().optional(),
  searchText: Joi.string().optional(),
});

exports.assignDailyTargetSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(10).optional(),
});

exports.IdValidationSchema = Joi.object({
  id: Joi.number().integer().required(),
});

exports.getOfficerTargetSchema = Joi.object({
  status: Joi.string().optional(),
  search: Joi.string().optional(),
  limit: Joi.string().optional(),
});

exports.PassTargetValidationSchema = Joi.object({
  officerId: Joi.number().integer().required(),
  target: Joi.number().integer().required(),
  amount: Joi.number().required(),
});

exports.getSelectedOfficerTargetSchema = Joi.object({
  officerId: Joi.number().integer().optional(),
  status: Joi.string().optional(),
  searchQuery: Joi.string().optional(),
});

exports.getSavedCenterCropsSchema = Joi.object({
  id: Joi.number().integer().required()
});

exports.getSavedCenterCropsQuaryParam = Joi.object({
  page: Joi.number().integer().required(),
  date: Joi.string().optional(),
  searchText: Joi.string().optional()
});

exports.updateTargetQtySchema = Joi.object({
  id: Joi.number().integer().allow(null).required(),
  qty: Joi.number().required(),
  date: Joi.date().required(),
  companyCenterId: Joi.number().integer().required(),
  grade: Joi.string().required(),
  varietyId: Joi.number().integer().required(),
});

exports.addOrRemoveCenterCropSchema = Joi.object({
  centerId: Joi.number().integer().optional(),
  isAssign: Joi.number().integer().optional(),
  cropId: Joi.number().integer().optional(),
});

exports.getCenterCropsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(10).optional(),
  searchText: Joi.string().allow("").optional(),
});

exports.getSelectedOfficerTargetSchemanew = Joi.object({
    officerId: Joi.number().integer().optional(),
    status: Joi.string().optional(),
    search: Joi.string().optional(),

});