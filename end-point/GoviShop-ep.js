const GoviShopDAO = require("../dao/GoviShop-dao");
const GoviShopValidation = require("../validations/GoviShop-validation");

// exports.getOfficerServiceById = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const service = await GoviLinkDAO.getOfficerServiceById(id);

//     res.status(200).json(service);
//   } catch (err) {
//     console.error("Error fetching officer service:", err);
//     res.status(404).json({ error: err.message });
//   }
// };

exports.viewGoviShopSupplierById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Shop user id is required",
      });
    }

    const shopUser = await GoviShopDAO.viewGoviShopSupplierByIdDao(id);

    if (!shopUser) {
      return res.status(404).json({
        success: false,
        message: "Shop user not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: shopUser,
    });
  } catch (error) {
    console.error("View Govi Shop Supplier Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
