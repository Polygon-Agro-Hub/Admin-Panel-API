const Joi = require("joi");

exports.getDistributionCenterDetailsSchema = Joi.object({
  name: Joi.string().required(), // Changed from name
  company: Joi.number().integer().required(), // Changed from company
  contact1: Joi.string().required(), // Changed from contact1
  contact1Code: Joi.string().required(), // Changed from contact1Code
  contact2: Joi.string().optional().allow(null, ""), // Changed from contact2
  contact2Code: Joi.string().optional().allow(null, ""), // Changed from contact2Code
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
  date: Joi.string().allow('').optional(),
  status: Joi.string().optional(),
  searchText: Joi.string().optional()
})

exports.getOfficerDailyDistributionTargetShema = Joi.object({
  id: Joi.number().integer().positive().required(),
  date: Joi.date().required()
})

exports.dcmGetparmasIdSchema = Joi.object({
  targetId: Joi.number().integer().required(),
  searchText: Joi.string().allow('').optional(),
  status: Joi.string().allow('').optional(),
  completingStatus: Joi.string().allow('').optional(),

});

exports.getTargetedCustomerOrdersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(100),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('Unknown', 'Pending', 'Opened', 'Completed').optional(),
  sheduleDate: Joi.date().iso().optional(),
  centerId: Joi.number().integer().positive().optional(),
  searchText: Joi.string().trim().min(1).max(50).optional(),
  phoneNumber: Joi.string()
    .pattern(/^\+94-\d{9}$/)
    .optional()
});

exports.getReturnRecievedDataSchema = Joi.object({
  receivedTime: Joi.date().optional(),
  centerId: Joi.number().integer().positive().optional(),
  searchText: Joi.string().trim().min(1).max(50).optional()
});

exports.getDistributedVehiclesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(5000).default(10),
  centerName: Joi.string().optional(),
  vehicleType: Joi.string().optional(),
  searchText: Joi.string().trim().min(1).max(50).optional(),
});

exports.getDistributedDriversSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(5000).default(10),
  status: Joi.string().optional(),
  vehicleType: Joi.string().optional(),
  searchText: Joi.string().trim().min(1).max(50).optional(),
});

exports.getTodaysDeliverieDataSchema = Joi.object({
  activeTab: Joi.string().valid('out-for-delivery', 'collected', 'on-the-way', 'hold', 'return', 'delivered', 'all').required(),
  regCode: Joi.number().integer().positive().optional(),
  invNo: Joi.string().optional(),
})

exports.getDistributedCenterPikupOderShema = Joi.object({
     companycenterId: Joi.number().required(),
  time: Joi.string().allow(''),
  date: Joi.date().iso().allow(''),
  searchText: Joi.string().allow(''),
  activeTab: Joi.string().valid('All', 'Ready to Pickup', 'Picked Up').allow('')
})


exports.getCenterHomeDeliveryOrdersSchema = Joi.object({
  activeTab: Joi.string(),
  centerId: Joi.number(),
  status: Joi.string().allow(''),
  searchText: Joi.string().allow(''),
  date: Joi.string().allow(''),
  timeSlot: Joi.string().allow(''),

})