const Joi = require('joi');

// Validation schema for validating district in the request parameters
exports.getDistrictReportsSchema = Joi.object({
    district: Joi.string().min(1).required().messages({
        'any.required': 'District is required',
        'string.base': 'District must be a string',
        'string.min': 'District cannot be empty',
    }),
});

exports.createCollectionOfficerSchema = Joi.object({
    firstName: Joi.string().min(1).required().messages({
        'any.required': 'First name is required',
        'string.base': 'First name must be a string',
        'string.min': 'First name cannot be empty',
    }),
    lastName: Joi.string().min(1).required().messages({
        'any.required': 'Last name is required',
        'string.base': 'Last name must be a string',
        'string.min': 'Last name cannot be empty',
    }),
    phoneNumber01: Joi.string().min(10).max(15).required().messages({
        'any.required': 'Primary phone number is required',
        'string.base': 'Primary phone number must be a string',
        'string.min': 'Primary phone number must be at least 10 characters',
        'string.max': 'Primary phone number cannot exceed 15 characters',
    }),
    phoneNumber02: Joi.string().allow('').optional().messages({
        'string.base': 'Secondary phone number must be a string',
        'string.min': 'Secondary phone number must be at least 10 characters',
        'string.max': 'Secondary phone number cannot exceed 15 characters',
    }),
    image: Joi.string().uri().optional(), // Assuming image is a URL
    nic: Joi.string().min(1).required().messages({
        'any.required': 'NIC is required',
        'string.base': 'NIC must be a string',
        'string.min': 'NIC cannot be empty',
    }),
    email: Joi.string().email().required().messages({
        'any.required': 'Email is required',
        'string.email': 'Invalid email format',
    }),
    houseNumber: Joi.string().required().messages({
        'any.required': 'House number is required',
    }),
    streetName: Joi.string().required().messages({
        'any.required': 'Street name is required',
    }),
    district: Joi.string().required().messages({
        'any.required': 'District is required',
    }),
    province: Joi.string().required().messages({
        'any.required': 'Province is required',
    }),
    country: Joi.string().required().messages({
        'any.required': 'Country is required',
    }),
    languages: Joi.string().allow('').optional(),
});


exports.getAllCollectionOfficersSchema = Joi.object({
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


exports.getCollectionOfficerReportsSchema = Joi.object({
    id: Joi.string().required(), // Assuming id is a string, adjust if necessary
    date: Joi.string().isoDate().required() // Ensuring the date is in ISO format
});


exports.getDistrictProvinceSchema = Joi.object({
    province: Joi.string().min(1).required().messages({
        'any.required': 'Province is required',
        'string.base': 'Province must be a string',
        'string.min': 'Province cannot be empty',
    }),
});


exports.UpdateCollectionOfficerStatus = Joi.object({
    id: Joi.number().integer().required(),
    status: Joi.string().required()
});


exports.getDailyReportSchema = Joi.object({
    collectionOfficerId: Joi.number().integer().required(),
    fromDate: Joi.date().iso().required(),
    toDate: Joi.date().iso().required()
});



exports.getPurchaseReport = Joi.object({
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(100).default(10).optional(),
    search: Joi.string().allow('').optional(),
    centerId: Joi.number().optional(),
    startDate: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .custom((value, helpers) => {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
                return helpers.error('any.invalid');
            }
            return value;
        }, 'Custom date validation'),
    endDate: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .custom((value, helpers) => {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
                return helpers.error('any.invalid');
            }
            return value;
        }, 'Custom date validation'),
});

exports.invNoParmsSchema = Joi.object({
    invNo: Joi.string().trim().min(1).required(),
});


exports.getAllDriversSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(100).default(10).optional(),
    centerStatus: Joi.string().optional(),
    status: Joi.string().optional(),
    nic: Joi.string().allow('').optional(), 
    centerId: Joi.number().optional(),
});

exports.getAllManagersSchema = Joi.object({
    centerId: Joi.number().required(),
});

exports.disclaimDriverSchema = Joi.object({
    id: Joi.number().required(),
});

exports.claimDriverSchema = Joi.object({
    centerId: Joi.number().required(),
    managerId: Joi.number().required()
});


