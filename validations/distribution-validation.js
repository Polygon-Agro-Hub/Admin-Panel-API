const Joi = require("joi");

exports.getDistributionCenterDetailsSchema = Joi.object({
  name: Joi.string().required(),
  company: Joi.number().integer().required(),
  contact1: Joi.string().required(),
  contact1Code: Joi.string().required(),
  contact2: Joi.string().optional().allow(null, ""), // optional
  contact2Code: Joi.string().optional().allow(null, ""), // optional
  latitude: Joi.string().required(),
  longitude: Joi.string().required(),
  email: Joi.string().email().required(),
  country: Joi.string().required(),
  province: Joi.string().required(),
  district: Joi.string().required(),
  city: Joi.string().required(),
  regCode: Joi.string().required(),
});

exports.getAllDistributionCentreSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  company: Joi.string().optional(),
  district: Joi.string().optional(),
  province: Joi.string().optional(),
  searchItem: Joi.string().optional(),
  centerType: Joi.string().optional(),
  city: Joi.string().optional(),
});

exports.getAllDistributionOfficersSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(100).default(10).optional(),
    centerStatus: Joi.string().optional(),
    status: Joi.string().optional(),
    nic: Joi.string().allow('').optional(), // Allow empty NIC
  centerName: Joi.string().allow('').optional(), // Allow empty centerName
    company: Joi.number().optional(),
    role: Joi.string().optional(),
    centerId: Joi.number().optional(),
});

exports.getRoleShema = Joi.object({
    role: Joi.string().required(),
})

exports.assignCityToDistributedCcenterShema = Joi.object({
    cityId: Joi.number().integer().positive().required(),
    centerId: Joi.number().integer().positive().required()
})

exports.getAllAssigningCitiesShema = Joi.object({
    provine: Joi.string().required(),
    district: Joi.string().required(),
})

exports.getDistributedCenterTargetShema = Joi.object({
    id: Joi.number().integer().positive().required(),
    date: Joi.date().iso().optional(),
    status: Joi.string().optional(),
    searchText: Joi.string().optional()
})

exports.getDistributedCenterOfficersShema = Joi.object({
    id: Joi.number().integer().positive().required(),
    role: Joi.string().optional(),
    status: Joi.string().optional(),
    searchText: Joi.string().optional()
})

exports.getDistributionOutForDlvrOrderShema = Joi.object({
    id: Joi.number().integer().positive().required(),
    date: Joi.date().iso().optional(),
    status: Joi.string().optional(),
    searchText: Joi.string().optional()
})