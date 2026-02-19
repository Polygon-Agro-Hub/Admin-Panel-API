const Joi = require("joi");

// Certificate Company Validation
exports.createCertificateCompanyValidation = Joi.object({
  companyName: Joi.string().trim().min(2).max(255).required(),
  regNumber: Joi.string().trim().max(50).required(),
  taxId: Joi.string().trim().max(50).required(),
  phoneCode1: Joi.string().trim().required(),
  phoneNumber1: Joi.string()
    .trim()
    .pattern(/^[0-9]+$/)
    .required(),
  phoneCode2: Joi.string().trim().allow(""),
  phoneNumber2: Joi.string()
    .trim()
    .pattern(/^[0-9]+$/)
    .allow(""),
  address: Joi.string().trim().required(),
});

// Certificate Creation Validation
exports.createCertificateValidation = Joi.object({
  srtcomapnyId: Joi.number().integer().required(),
  srtName: Joi.string().trim().min(2).max(255).required(),
  srtNameSinhala: Joi.string().trim().max(255).allow(null, "").optional(),
  srtNameTamil: Joi.string().trim().max(255).allow(null, "").optional(),
  srtNumber: Joi.string().trim().max(50).required(),
  applicable: Joi.string().trim().required(),
  accreditation: Joi.string().trim().required(),
  serviceAreas: Joi.alternatives()
    .try(Joi.array().items(Joi.string()), Joi.string())
    .custom((value) => {
      if (Array.isArray(value) && value.length === 0)
        throw new Error("At least one service area is required");
      return value;
    })
    .required(),
  price: Joi.number().min(0).allow(null, ""),
  timeLine: Joi.number().integer().min(1).allow(null, ""),
  commission: Joi.number().min(0).max(100).allow(null, ""),
  scope: Joi.string().allow(null, ""),
  noOfVisit: Joi.number().integer().min(0).allow(null, ""),
  cropIds: Joi.alternatives()
    .try(Joi.array().items(Joi.number().integer().min(1)), Joi.string())
    .optional(),
});

// Update certificate validations
exports.updateCertificateValidation = Joi.object({
  srtcomapnyId: Joi.number().required(),
  srtName: Joi.string().required(),
  srtNameSinhala: Joi.string().trim().max(255).allow(null, "").optional(),
  srtNameTamil: Joi.string().trim().max(255).allow(null, "").optional(),
  srtNumber: Joi.string().required(),
  applicable: Joi.string().allow(null, ""),
  accreditation: Joi.string().allow(null, ""),
  price: Joi.number().allow(null, ""),
  timeLine: Joi.string().allow(null, ""),
  commission: Joi.number().allow(null, ""),
  serviceAreas: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.string()
  ),
  cropIds: Joi.alternatives().try(
    Joi.array().items(Joi.number()),
    Joi.string()
  ),
  scope: Joi.string().allow(null, ""),
  noOfVisit: Joi.number().integer().min(0).allow(null, ""),
});

// Get All Companies Schema
exports.getAllCertificateCompaniesSchema = Joi.object({
  search: Joi.string().allow("").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

// Get By ID Schema
exports.getByIdSchema = Joi.object({
  id: Joi.number().integer().required(),
});

// Validation for creating questionnaire
exports.createQuestionnaireSchema = Joi.object({
  certificateId: Joi.number().integer().required().messages({
    "any.required": "Certificate ID is required",
    "number.base": "Certificate ID must be a number",
  }),
  questions: Joi.array()
    .items(
      Joi.object({
        qNo: Joi.number().integer().min(1).required().messages({
          "any.required": "Question number (qNo) is required",
          "number.base": "Question number must be a number",
        }),
        type: Joi.string().max(25).required(),
        qEnglish: Joi.string().trim().min(1).required(),
        qSinhala: Joi.string().allow(null, "").optional(),
        qTamil: Joi.string().allow(null, "").optional(),
      })
    )
    .min(1)
    .required(),
});

// Validation for getting list by certificateId
exports.getQuestionnaireListSchema = Joi.object({
  certificateId: Joi.number().integer().required(),
});

// Validation for updating a single questionnaire
exports.updateQuestionnaireSchema = Joi.object({
  id: Joi.number().integer().required(),
  type: Joi.string().max(25).required(),
  qNo: Joi.number().integer().min(1).required(),
  qEnglish: Joi.string().trim().min(1).required(),
  qSinhala: Joi.string().allow(null, "").optional(),
  qTamil: Joi.string().allow(null, "").optional(),
});

// Validation for delete
exports.deleteQuestionnaireSchema = Joi.object({
  id: Joi.number().integer().required(),
});

// Validation for Farmer cluster
exports.createFarmerClusterSchema = Joi.object({
  clusterName: Joi.string().min(2).max(55).required().messages({
    "string.empty": "Cluster name is required",
    "string.min": "Cluster name must be at least 2 characters",
    "string.max": "Cluster name cannot exceed 55 characters",
  }),
  district: Joi.string().max(55).required().messages({
    "string.empty": "District is required",
    "string.max": "District cannot exceed 55 characters",
  }),
  certificateId: Joi.number().integer().positive().required().messages({
    "number.base": "Certificate ID must be a number",
    "number.positive": "Certificate ID must be a positive number",
  }),
  farmers: Joi.array()
    .min(1)
    .required()
    .items(
      Joi.object({
        farmerNIC: Joi.string().required().messages({
          "string.empty": "Farmer NIC is required",
        }),
        regCode: Joi.string().required().messages({
          "string.empty": "Registration code is required",
        }),
      })
    )
    .messages({
      "array.min": "At least one farmer must be provided",
    }),
});

// Existing validation schemas
exports.updateFarmerClusterSchema = Joi.object({
  clusterName: Joi.string().trim().min(1).max(55).optional().messages({
    "string.empty": "Cluster name cannot be empty",
    "string.min": "Cluster name must be at least 1 character long",
    "string.max": "Cluster name cannot exceed 55 characters",
  }),
  district: Joi.string().trim().min(1).max(55).optional().messages({
    "string.empty": "District cannot be empty",
    "string.min": "District must be at least 1 character long",
    "string.max": "District cannot exceed 55 characters",
  }),
  certificateId: Joi.number().integer().min(1).optional().messages({
    "number.base": "Certificate ID must be a number",
    "number.integer": "Certificate ID must be an integer",
    "number.min": "Certificate ID must be a positive number",
  }),
  farmersToAdd: Joi.array()
    .items(
      Joi.object({
        nic: Joi.string().trim().required().messages({
          "string.empty": "NIC is required",
          "any.required": "NIC is required",
        }),
        farmId: Joi.string().trim().required().messages({
          "string.empty": "Farm ID is required",
          "any.required": "Farm ID is required",
        }),
      })
    )
    .optional()
    .default([])
    .messages({
      "array.base": "Farmers to add must be an array",
    }),
})
  .or("clusterName", "district", "certificateId", "farmersToAdd")
  .messages({
    "object.missing":
      "At least one field (clusterName, district, certificateId, or farmersToAdd) is required",
  });

// Validation for adding a single farmer to an existing cluster
exports.addSingleFarmerToClusterSchema = Joi.object({
  nic: Joi.string()
    .required()
    .pattern(/^(?:\d{9}[Vv]|\d{12})$/)
    .messages({
      "string.empty": "NIC number is required",
      "string.pattern.base": "Invalid NIC format",
    }),
  farmId: Joi.string().trim().required().messages({
    "string.empty": "Farm ID is required",
  }),
  clusterId: Joi.number().integer().positive().required().messages({
    "number.base": "Cluster ID must be a number",
    "any.required": "Cluster ID is required",
  }),
});
