const Joi = require('joi');

exports.getAllSalesAgentsSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(100).default(10).optional(),
    date: Joi.string().optional(),
    status: Joi.string().optional(),
    searchText: Joi.string().optional(),
    ratingFilter: Joi.string().valid('VVIP', 'VIP', 'COR', 'NOR', 'VVP').allow('').optional(),
    agentFilter: Joi.number().integer().optional(),
});

exports.deleteSalesAgentSchema = Joi.object({
    id: Joi.number().integer().positive().required()
});

exports.getSalesAgentRatingsSchema = Joi.object({
  formattedDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .allow("", null)
    .optional(),
  agent: Joi.string().allow("", null).optional(), 
});


exports.getPendingWholesaleBuyersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  searchText: Joi.string().allow("", null).optional(),
  onboarded: Joi.string().allow("", null).optional(), // 'Polygon' or an empId like 'SA0001'
  status: Joi.string().valid("To Review", "Approve", "Reject").default("To Review"),
});

exports.onboardWholesaleCustomerSchema = Joi.object({
  // salesagent.id chosen in the "Select Agent" dropdown (optional => Polygon-onboarded)
  salesAgent: Joi.number().integer().allow(null, "").optional(),
 
  title: Joi.string().valid("Mr.", "Mrs.", "Ms.", "Rev.", "Dr.").required(),
  firstName: Joi.string().trim().max(50).required(),
  lastName: Joi.string().trim().max(50).required(),
 
  phoneCode: Joi.string().max(5).required(),
  phoneNumber: Joi.string().pattern(/^[0-9]{9,12}$/).required().messages({
    "string.pattern.base": "Invalid phone number",
  }),
  email: Joi.string().trim().email().max(50).required(),
 
  docType: Joi.string().valid("NIC", "PASS").required(),
  nic: Joi.string()
    .trim()
    .max(12)
    .required()
    .when("docType", {
      is: "NIC",
      then: Joi.string().pattern(/^([0-9]{9}[vVxX]|[0-9]{12})$/).messages({
        "string.pattern.base": "Invalid NIC number",
      }),
      otherwise: Joi.string().pattern(/^[A-Za-z0-9]{5,12}$/).messages({
        "string.pattern.base": "Invalid passport number",
      }),
    }),
 
  companyName: Joi.string().trim().max(255).required(),
  companyPhoneCode: Joi.string().max(5).required(),
  companyPhone: Joi.string().pattern(/^[0-9]{9,12}$/).required().messages({
    "string.pattern.base": "Invalid company phone number",
  }),
});
 