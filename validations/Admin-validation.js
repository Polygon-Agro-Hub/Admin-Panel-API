// admin-validation.js
const Joi = require("joi");

exports.loginAdminSchema = Joi.object({
  email: Joi.string().required(),
  password: Joi.string().required(),
});

exports.getAllAdminUsersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  role: Joi.number().integer().optional(),
  search: Joi.string().optional(),
});
exports.getFarmOwnerSchema = Joi.object({
  id: Joi.number().required()
});
exports.adminCreateUserSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  phoneNumber: Joi.string().required(),
  NICnumber: Joi.string().required(),
});
exports.adminCreateUserSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  phoneNumber: Joi.string().required(),
  NICnumber: Joi.string().required(),
});
exports.getAllUsersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  nic: Joi.string().allow(""),
  regStatus: Joi.string().allow(""),
  district: Joi.string().allow(""),
});

exports.getAllUsersRepSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

exports.createCropCalenderSchema = Joi.object({
  cropName: Joi.string().required(),
  sinhalaCropName: Joi.string().required(),
  tamilCropName: Joi.string().required(),
  variety: Joi.string().required(),
  sinhalaVariety: Joi.string().required(),
  tamilVariety: Joi.string().required(),
  cultivationMethod: Joi.string().required(),
  natureOfCultivation: Joi.string().required(),
  cropDuration: Joi.number().integer().min(1),
  cropCategory: Joi.string().required(),
  specialNotes: Joi.string().required(),
  sinhalaSpecialNotes: Joi.string().required(),
  tamilSpecialNotes: Joi.string().required(),
  suitableAreas: Joi.string().required(),
  cropColor: Joi.string().required(),
});

exports.uploadXLSXSchema = Joi.object({
  id: Joi.string().required(),
});

exports.getAllCropCalendarSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

exports.createOngoingCultivationsSchema = Joi.object({
  userId: Joi.number().integer(),
  cropCalenderId: Joi.number().integer(),
});

exports.createNewsSchema = Joi.object({
  titleEnglish: Joi.string().required(),
  titleSinhala: Joi.string().required(),
  titleTamil: Joi.string().required(),
  descriptionEnglish: Joi.string().required(),
  descriptionSinhala: Joi.string().required(),
  descriptionTamil: Joi.string().required(),
  status: Joi.string().required(),
  publishDate: Joi.date().iso().optional(),
  expireDate: Joi.date().iso().optional(),
});

exports.getAllNewsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().optional(),
  createdAt: Joi.date().iso().optional(),
});

exports.editCropCalenderSchema = Joi.object({
  cropName: Joi.string().required(),
  sinhalaCropName: Joi.string().required(),
  variety: Joi.string().required(),
  CultivationMethod: Joi.string().required(),
  NatureOfCultivation: Joi.string().required(),
  CropDuration: Joi.string().required(),
  SpecialNotes: Joi.string().required(),
  SuitableAreas: Joi.string().required(),
  cropColor: Joi.string().required(),
});

exports.createCropCalenderTaskSchema = Joi.object({
  cropId: Joi.number().required(),
  tasks: Joi.array()
    .items(
      Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        daysnum: Joi.number().required(),
      })
    )
    .required(),
});

exports.getNewsByIdSchema = Joi.object({
  id: Joi.number().integer().required(), // Ensures the `id` is a number and required
});

exports.getCropCalenderByIdSchema = Joi.object({
  id: Joi.number().integer().required(), // Ensures `id` is a valid integer and required
});

exports.editNewsStatusSchema = Joi.object({
  id: Joi.number().integer().required(), // Validate that `id` is a number
});

exports.createMarketPriceSchema = Joi.object({
  titleEnglish: Joi.string().required(),
  titleSinhala: Joi.string().required(),
  titleTamil: Joi.string().required(),
  status: Joi.string().valid("Draft", "Published").required(), // Example values for status
  price: Joi.number().precision(2).required(),
  createdBy: Joi.string().required(),
});

exports.getAllMarketPriceSchema = Joi.object({
  status: Joi.string().valid("Draft", "Published").optional(),
  createdAt: Joi.date().iso().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).optional(),
});

exports.deleteMarketPriceSchema = Joi.object({
  id: Joi.number().integer().required(),
});

exports.editMarketPriceStatusSchema = Joi.object({
  id: Joi.number().integer().required(), // Validates that the `id` is a valid number and required
});

exports.getMarketPriceByIdSchema = Joi.object({
  id: Joi.number().integer().required(), // Ensures that the `id` is a valid integer and required
});

exports.editMarketPriceSchema = Joi.object({
  titleEnglish: Joi.string().required(),
  titleSinhala: Joi.string().required(),
  titleTamil: Joi.string().required(),

  price: Joi.number().required(),
  id: Joi.number().integer().required(), // The ID should be a valid integer
});

exports.getAllOngoingCultivationsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  nic: Joi.string().optional().allow(""),
});

exports.getOngoingCultivationsWithUserDetailsSchema = Joi.object({});

exports.getOngoingCultivationsByIdSchema = Joi.object({
  id: Joi.number().integer().required().label("Ongoing Cultivation ID"),
});

exports.getFixedAssetsByCategorySchema = Joi.object({
  id: Joi.number().integer().required().label("User ID"),
  farmId: Joi.number().integer().required().label("Farm ID"),
  category: Joi.string()
    .valid(
      "Building and Infrastructures",
      "Land",
      "Machinery and Vehicles",
      "Tools and Equipments"
    )
    .required()
    .label("Category"),
}).options({ convert: true });

exports.getCurrentAssetsByCategorySchema = Joi.object({
  id: Joi.number().integer().required().label("User ID"),
  category: Joi.string()
    .valid(
      "Ferlizer",
      "Seeds and Seedlings",
      "Agro Chemicals",
      "Livestock for Sale",
      "Animal Feed",
      "Other Consumables"
    )
    .required()
    .label("Category"),
});

exports.deleteAdminUserSchema = Joi.object({
  id: Joi.number().integer().required().label("Admin User ID"),
});

exports.editAdminUserSchema = Joi.object({
  mail: Joi.string().email().required().label("mail"),
  userName: Joi.string().min(3).max(30).required().label("Username"),
  role: Joi.string()
    .valid("SUPER_ADMIN", "User", "Moderator")
    .required()
    .label("Role"),
});

exports.editAdminUserWithoutIdSchema = Joi.object({
  id: Joi.number().required().messages({
    "any.required": "ID is required to update admin user",
    "number.base": "ID must be a number",
  }),
  mail: Joi.string().email().required().messages({
    "string.email": "A valid email is required",
    "any.required": "Email is required",
  }),
  userName: Joi.string().min(3).required().messages({
    "string.min": "Username must be at least 3 characters long",
    "any.required": "Username is required",
  }),
  role: Joi.number().required().messages({
    "any.required": "Role is required",
  }),
});

exports.getAdminByIdSchema = Joi.object({
  id: Joi.number().required().messages({
    "any.required": "ID is required",
    "number.base": "ID must be a number",
  }),
});

exports.editAdminUserPasswordSchema = Joi.object({
  id: Joi.number().required().messages({
    "any.required": "ID is required",
    "number.base": "ID must be a number",
  }),
  currentPassword: Joi.string().min(6).required().messages({
    "any.required": "Current password is required",
    "string.min": "Current password must be at least 6 characters long",
  }),
  newPassword: Joi.string().min(6).required().messages({
    "any.required": "New password is required",
    "string.min": "New password must be at least 6 characters long",
  }),
});

exports.deletePlantCareUserSchema = Joi.object({
  id: Joi.number().required().messages({
    "any.required": "ID is required",
    "number.base": "ID must be a valid number",
  }),
});

exports.updatePlantCareUserSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).required().messages({
    "any.required": "First name is required",
    "string.empty": "First name cannot be empty",
  }),
  lastName: Joi.string().min(1).max(50).required().messages({
    "any.required": "Last name is required",
    "string.empty": "Last name cannot be empty",
  }),
  phoneNumber: Joi.string().min(10).max(15).required().messages({
    "any.required": "Phone number is required",
    "string.empty": "Phone number cannot be empty",
  }),
  NICnumber: Joi.string().min(10).max(12).required().messages({
    "any.required": "NIC number is required",
    "string.empty": "NIC number cannot be empty",
  }),
  district: Joi.string().min(1).max(50).required().messages({
    "any.required": "district name is required",
    "string.empty": "district name cannot be empty",
  }),
  membership: Joi.string().min(1).max(50).required().messages({
    "any.required": "membership name is required",
    "string.empty": "membership name cannot be empty",
  }),
  language: Joi.string().min(1).max(50).required().messages({
    "any.required": "language name is required",
    "string.empty": "language name cannot be empty",
  }),
  accNumber: Joi.string().min(1).max(50).required().messages({
    "any.required": "account number is required",
    "string.empty": "account number cannot be empty",
  }),
  accHolderName: Joi.string().min(1).max(50).required().messages({
    "any.required": "account holder name is required",
    "string.empty": "account holder name cannot be empty",
  }),
  bankName: Joi.string().min(1).max(50).required().messages({
    "any.required": "bank name is required",
    "string.empty": "bank name cannot be empty",
  }),
  branchName: Joi.string().min(1).max(50).required().messages({
    "any.required": "branch name is required",
    "string.empty": "branch name cannot be empty",
  }),
  file: Joi.any().optional(),
});

exports.createPlantCareUserSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).required().messages({
    "any.required": "First name is required",
    "string.empty": "First name cannot be empty",
  }),
  lastName: Joi.string().min(1).max(50).required().messages({
    "any.required": "Last name is required",
    "string.empty": "Last name cannot be empty",
  }),
  phoneNumber: Joi.string().min(10).max(15).required().messages({
    "any.required": "Phone number is required",
    "string.empty": "Phone number cannot be empty",
  }),
  NICnumber: Joi.string().min(10).max(12).required().messages({
    "any.required": "NIC number is required",
    "string.empty": "NIC number cannot be empty",
  }),
  file: Joi.any().required().messages({
    "any.required": "Profile image is required",
  }), // Required file for image upload
});

exports.getUserByIdSchema = Joi.object({
  id: Joi.number().integer().min(1).required().messages({
    "any.required": "User ID is required",
    "number.base": "User ID must be a number",
    "number.min": "User ID must be greater than or equal to 1",
  }),
});

exports.createAdminSchema = Joi.object({
  mail: Joi.string().email().required().messages({
    "any.required": "Mail is required",
    "string.email": "Please provide a valid email address",
  }),
  role: Joi.string().required().messages({
    "any.required": "Role is required",
  }),
  userName: Joi.string().min(3).required().messages({
    "any.required": "Username is required",
    "string.min": "Username must be at least 3 characters long",
  }),
  password: Joi.string().min(6).required().messages({
    "any.required": "Password is required",
    "string.min": "Password must be at least 6 characters long",
  }),
});

exports.getCurrentAssetGroupSchema = Joi.object({
  id: Joi.number().integer().required().messages({
    "any.required": "User ID is required",
    "number.base": "User ID must be a number",
    "number.integer": "User ID must be an integer",
  }),
});

exports.getCurrentAssetRecordByIdSchema = Joi.object({
  id: Joi.number().integer().required().messages({
    "any.required": "Current Asset ID is required",
    "number.base": "Current Asset ID must be a number",
    "number.integer": "Current Asset ID must be an integer",
  }),
});

exports.deleteCropTaskSchema = Joi.object({
  id: Joi.number().integer().required().messages({
    "any.required": "Task ID is required",
    "number.base": "Task ID must be a number",
    "number.integer": "Task ID must be an integer",
  }),
});

exports.getCropCalendarDayByIdSchema = Joi.object({
  id: Joi.number().integer().required().messages({
    "any.required": "Task ID is required",
    "number.base": "Task ID must be a number",
    "number.integer": "Task ID must be an integer",
  }),
});

exports.editTaskSchema = Joi.object({
  id: Joi.number().integer().required().messages({
    "any.required": "Task ID is required",
  }),
  taskEnglish: Joi.string().required().messages({
    "any.required": "Task English is required",
  }),
  taskSinhala: Joi.string().required().messages({
    "any.required": "Task Sinhala is required",
  }),
  taskTamil: Joi.string().required().messages({
    "any.required": "Task Tamil is required",
  }),
  taskTypeEnglish: Joi.string().required().messages({
    "any.required": "Task Type English is required",
  }),
  taskTypeSinhala: Joi.string().required().messages({
    "any.required": "Task Type Sinhala is required",
  }),
  taskTypeTamil: Joi.string().required().messages({
    "any.required": "Task Type Tamil is required",
  }),
  taskCategoryEnglish: Joi.string().required().messages({
    "any.required": "Task Category English is required",
  }),
  taskCategorySinhala: Joi.string().required().messages({
    "any.required": "Task Category Sinhala is required",
  }),
  taskCategoryTamil: Joi.string().required().messages({
    "any.required": "Task Category Tamil is required",
  }),
});

exports.slaveUserId = Joi.object({
  userId: Joi.number().integer().required().label("Ongoing Cultivation ID"),
});

exports.slaveCropId = Joi.object({
  cropId: Joi.number().integer().required().label("Ongoing Cultivation ID"),
});

exports.createfeedback = Joi.object({
  orderNumber: Joi.number().required(),
  feedbackEnglish: Joi.required(),
  feedbackSinahala: Joi.required(),
  feedbackTamil: Joi.required(),
});

exports.getFarmerStaffShema = Joi.object({
  id: Joi.number().integer().positive().required(),
  role: Joi.string().optional(),
});
exports.getFarmsByUserSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow("", null),
  userId: Joi.number().integer().required(),
}).options({ convert: true }); // <- important
