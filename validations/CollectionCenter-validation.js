const Joi = require('joi');

exports.createCollectionCenterValidation = Joi.object({
    regCode: Joi.string().required(),
    centerName: Joi.string().required(),
    contact01Code: Joi.string().required(),
    contact01: Joi.string().required(),
    contact02: Joi.string().required(),
    contact02Code: Joi.string().required(),
    buildingNumber: Joi.string().required(),
    street: Joi.string().required(),
    district: Joi.string().required(),
    province: Joi.string().required()
});

exports.getAllUsersSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    district: Joi.string().allow(''),
    province: Joi.string().allow(''),
    searchItem: Joi.string().allow('')
});

exports.getByIdShema = Joi.object({
    id: Joi.number().integer().required(),
})

exports.getRoleShema = Joi.object({
    role: Joi.string().required(),
})

exports.deleteCompanyHeadSchema = Joi.object({
    id: Joi.number().integer().positive().required()
});


exports.getAWCentersSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    companyId: Joi.number().integer().min(1).default(1),
    district: Joi.string().allow(''),
    province: Joi.string().allow(''),
    searchItem: Joi.string().allow(''),
});

exports.getAllCenterPaymentsSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(100).default(10).optional(),
    fromDate: Joi.string().allow('').optional(),
    toDate: Joi.string().allow('').optional(),
    centerId: Joi.number().integer().required(),
    searchText: Joi.string().allow('').optional(),

});

exports.downloadAllCenterPaymentsSchema = Joi.object({
    fromDate: Joi.string().allow('').optional(),
    toDate: Joi.string().allow('').optional(),
    centerId: Joi.number().integer().required(),
    searchText: Joi.string().allow('').optional(),
});


exports.getCenterTargetSchema = Joi.object({
    centerId: Joi.number().integer().min(1).default(1).optional(),
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(100).default(10).optional(),
    status: Joi.string().allow('').optional(),
    searchText: Joi.string().allow('').optional(),

});


exports.downloadCurrentTargetSchema = Joi.object({
    centerId: Joi.number().integer().min(1).default(1).optional(),
    status: Joi.string().allow('').optional(),
    searchText: Joi.string().allow('').optional(),

});