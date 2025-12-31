const Joi = require("joi");

exports.AddProductValidation = Joi.object({
  normalPrice: Joi.number().positive().required(),
  discountedPrice: Joi.number().positive().optional(),
  promo: Joi.boolean().required(),
  tags: Joi.string().min(1).max(50).optional(),
  salePrice: Joi.number().positive().optional(),
  displaytype: Joi.string()
    .pattern(/^[A-Z&]+$/)
    .required(),
  selectId: Joi.string().alphanum().required(),
  variety: Joi.string().alphanum().required(),
  unitType: Joi.string().valid("Kg", "g").required(),
  startValue: Joi.number().positive().optional(),
  changeby: Joi.number().integer().required(),
  cropName: Joi.string().min(3).max(50).required(),
});

exports.CreateCoupenValidation = Joi.object({
  code: Joi.string().required(),
  type: Joi.string().required(),
  percentage: Joi.number().min(0).max(100).optional(),
  status: Joi.string().required(),
  checkLimit: Joi.boolean().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  priceLimit: Joi.number().min(0).optional(),
  fixDiscount: Joi.number().min(0).optional(),
});

exports.couponQuaryParamSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().optional(),
  types: Joi.string().optional(),
  searchText: Joi.string().optional(),
});

exports.deleteCoupenSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

exports.IdparamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

UpdatePackageSchema = Joi.object({
  displayName: Joi.string().optional(),
  image: Joi.string().optional(),
  description: Joi.string().optional(),
  status: Joi.string().valid("Eneble", "Disabled").optional(),
  total: Joi.number().min(0).optional(),
  discount: Joi.number().min(0).optional(),
  subtotal: Joi.number().min(0).optional(),
});


exports.createProductTypeSchema = Joi.object({
  typeName: Joi.string().required(),
  shortCode: Joi.string().required()
});

exports.getAllPackageSchema = Joi.object({
  searchText: Joi.string().optional()
});

exports.getAllRetailOrderSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().optional(),
  method: Joi.string().optional(),
  searchItem: Joi.string().optional(),
  formattedDate: Joi.string().optional(),
});


exports.getmarketplaceCustomerParamSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  searchText: Joi.string().optional(),
});

exports.getCoupenValidation = Joi.object({
  coupenId: Joi.number().min(0).required(),
});

exports.updateCoupenValidation = Joi.object({
  id: Joi.number().required(),
  code: Joi.string().required(),
  type: Joi.string().required(),
  percentage: Joi.number().min(0).max(100).optional().allow(null),
  status: Joi.string().required(),
  checkLimit: Joi.boolean().truthy(1).falsy(0).required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  priceLimit: Joi.number().min(0).optional().allow(null),
  fixDiscount: Joi.number().min(0).optional().allow(null),
});


exports.changePackageStatusValidation = Joi.object({
  id: Joi.number().min(0).positive().required(),
  status: Joi.string().required(),
});
