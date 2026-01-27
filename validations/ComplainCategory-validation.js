const Joi = require('joi');

exports.getComplainCategoriesSchema = Joi.object({
    systemAppId: Joi.number().integer().required(),
});

exports.AddNewComplainCategorySchema = Joi.object({
    roleId: Joi.number().integer().required(),
    appId: Joi.number().integer().required(),
    categoryEnglish: Joi.string().required(),
    categorySinhala: Joi.string().required(),
    categoryTamil: Joi.string().required()
});

exports.editApplicationSchema = Joi.object({
    systemAppId: Joi.number().integer().required(),
    applicationName: Joi.string().required(),
});

exports.deleteApplicationSchema = Joi.object({
    systemAppId: Joi.number().integer().required(),

});


exports.addNewApplicationSchema = Joi.object({
    applicationName: Joi.string().required(),

});


exports.IdParamsSchema = Joi.object({
    id: Joi.number().integer().required(),

});


exports.EditComplainCategorySchema = Joi.object({
    id: Joi.number().integer().required(),
    roleId: Joi.number().integer().required(),
    appId: Joi.number().integer().required(),
    categoryEnglish: Joi.string().required(),
    categorySinhala: Joi.string().required(),
    categoryTamil: Joi.string().required(),
    modifyBy: Joi.optional(),
});


exports.getCategoriesByAppIdSchema = Joi.object({
  appId: Joi.number().integer().required(),
});

exports.getAllMarketplaceComplaintsSchema = Joi.object({
    role: Joi.number().integer().optional(),
});