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
  cropIds: Joi.alternatives()
    .try(Joi.array().items(Joi.number().integer()), Joi.string())
    .required()
    .messages({
      "any.required": "Please select at least one crop.",
      "array.includes": "Invalid crop IDs.",
    }),
});

// Update certificate validations
exports.updateCertificateValidation = Joi.object({
  srtcomapnyId: Joi.number().required(),
  srtName: Joi.string().required(),
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

// Validation for farm cluster
exports.createFarmerClusterSchema = Joi.object({
  clusterName: Joi.string().min(2).max(55).required().messages({
    "string.empty": "Cluster name is required",
    "string.min": "Cluster name must be at least 2 characters",
    "string.max": "Cluster name cannot exceed 55 characters",
  }),
  farmerNICs: Joi.array().min(1).required().messages({
    "array.min": "At least one NIC number must be provided",
  }),
});

// Existing validation schemas
exports.updateFarmerClusterSchema = Joi.object({
  clusterName: Joi.string().trim().min(1).max(255).required().messages({
    "string.empty": "Cluster name is required",
    "string.min": "Cluster name must be at least 1 character long",
    "string.max": "Cluster name cannot exceed 255 characters",
    "any.required": "Cluster name is required",
  }),
});
