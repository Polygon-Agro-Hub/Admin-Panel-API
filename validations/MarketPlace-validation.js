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
  shortCode: Joi.string().required(),
});

exports.getAllPackageSchema = Joi.object({
  searchText: Joi.string().optional(),
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
  limit: Joi.number().integer().min(1).default(10),
  searchText: Joi.string().allow("").optional(),
  ratingFilter: Joi.string()
    .valid("VVIP", "VIP", "COR", "NOR", "VVP")
    .allow("")
    .optional(),
});

exports.updateCustomerRatingSchema = Joi.object({
  rateofCus: Joi.string().valid("VVIP", "VIP", "COR", "NOR", "VVP"),
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

// In your MarketPriceValidate file, add:
exports.ValidateStatusSchema = Joi.object({
  isValid: Joi.number().valid(0, 1).required(),
});

exports.updateWholesaleCustomerCreditLimiteValidation = Joi.object({
  id: Joi.number().required(),
  creditLimit: Joi.number().min(0).required(),
});

exports.getTotalBuyerValueSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  searchItem: Joi.string().allow("", null).optional(),
  agent: Joi.string().allow("", null).optional(),
});

exports.priceListTypeValidation = Joi.object({
  type: Joi.string().valid("retail", "wholesale").required(),
});

const itemSchema = (isRetail) =>
  Joi.object({
    rowNo: Joi.number().integer().min(2).required(),
    productId: Joi.number().integer().positive().required(),
    display: Joi.string().allow("", null).optional(),
    actualPrice: Joi.number().greater(0).required(),
    salePrice: Joi.number().greater(0).required(),
    competitorPrice: Joi.number().greater(Joi.ref("salePrice")).required(),
    ...(isRetail && { packageBasedPrice: Joi.number().greater(0).required() }),
  }).custom((item, helpers) => {
    const isNoDiscount =
      String(item.display ?? "")
        .trim()
        .toLowerCase() === "no discount";
    if (isNoDiscount && Math.abs(item.actualPrice - item.salePrice) >= 0.005) {
      return helpers.error("price.noDiscountMismatch");
    }
    return item;
  });

exports.uploadPriceListValidation = (isRetail) =>
  Joi.object({
    items: Joi.array()
      .items(itemSchema(isRetail))
      .min(1)
      .max(20000)
      .unique("productId")
      .required(),
  });

const MSG = {
  productId: "Invalid Product IDs found.",
  notFound: "Invalid Product IDs found.",
  duplicate: "Duplicate Product IDs found.",
  salePrice:
    "Invalid Sale Price. Please enter a valid Sale Price greater than 0.",
  actualPrice:
    "Invalid Actual Price. Please enter a valid Actual Price greater than 0.",
  noDiscountMismatch:
    "Mismatching Actual and Sale Prices.\nPlease note : For No Discount display type the Actual Price and the Sale Price must have equal values.",
  competitorPrice:
    "Invalid Competitor Price. Please enter a valid Competitor Price greater than the Sale Price.",
  packageBasedPrice:
    "Invalid Package Based Price. Please enter a valid Package Based Price greater than 0.",
};

const ORDER = [
  MSG.productId,
  MSG.notFound,
  MSG.duplicate,
  MSG.salePrice,
  MSG.actualPrice,
  MSG.noDiscountMismatch,
  MSG.competitorPrice,
  MSG.packageBasedPrice,
];

exports.PRICE_LIST_MESSAGES = MSG;

exports.formatPriceListErrors = (error, rawItems = []) => {
  const grouped = new Map();
  const dupGroups = new Map();

  const add = (message, rowNo) => {
    if (!grouped.has(message)) grouped.set(message, new Set());
    if (rowNo !== undefined) grouped.get(message).add(rowNo);
  };

  error.details.forEach((d) => {
    if (d.type === "array.unique") {
      const a = rawItems[d.context.pos];
      const b = rawItems[d.context.dupePos];
      const key = a?.productId ?? b?.productId;
      if (!dupGroups.has(key)) dupGroups.set(key, new Set());
      [a?.rowNo, b?.rowNo].forEach(
        (r) => r !== undefined && dupGroups.get(key).add(r),
      );
      return;
    }

    const [, index, field] = d.path;
    if (d.type === "price.noDiscountMismatch") {
      add(MSG.noDiscountMismatch, rawItems[index]?.rowNo);
    } else if (typeof index === "number" && MSG[field]) {
      add(MSG[field], rawItems[index]?.rowNo);
    } else {
      add(d.message);
    }
  });

  const result = [
    ...[...grouped.entries()].map(([message, rows]) => ({
      message,
      rows: [...rows].sort((a, b) => a - b),
    })),
    ...[...dupGroups.values()].map((rows) => ({
      message: MSG.duplicate,
      rows: [...rows].sort((a, b) => a - b),
    })),
  ];

  return result.sort(
    (a, b) =>
      ORDER.indexOf(a.message) - ORDER.indexOf(b.message) ||
      a.rows[0] - b.rows[0],
  );
};

exports.checkPriceListIdsValidation = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        rowNo: Joi.number().integer().min(2).required(),
        productId: Joi.number().integer().positive().required(),
      }),
    )
    .min(1)
    .max(20000)
    .required(),
});
