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

exports.getAllGoviShopUsers = async (req, res) => {
  try {
    const { search, currentPlan } = req.query;

    const { total, shopUsers, expiredCount, activeCount } =
      await GoviShopDAO.getAllGoviShopUsers(search, currentPlan);

    res.json({
      success: true,
      data: {
        shopUsers,
        total,
        expiredCount,
        activeCount,
      },
    });
  } catch (err) {
    console.error("Error fetching shop users:", err);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching shop users",
      error: err.message,
    });
  }
};

exports.deleteGoviShopUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate id param
    const { error } = GoviShopValidation.getByIdSchema.validate({ id });
    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
        status: false,
      });
    }

    // Check if shop user exists
    const existing = await GoviShopDAO.getGoviShopUserById(id);
    if (!existing || existing.length === 0) {
      return res.status(404).json({
        message: "Shop user not found",
        status: false,
      });
    }

    // Perform delete
    const deleted = await GoviShopDAO.deleteGoviShopUser(id);

    if (!deleted) {
      return res.status(404).json({
        message: "Shop user not found or already deleted",
        status: false,
      });
    }

    res.json({
      message: "Shop user deleted successfully",
      status: true,
    });
  } catch (err) {
    console.error("Error deleting shop user:", err);
    res.status(500).json({
      message: "An error occurred while deleting shop user",
      error: err.message,
      status: false,
    });
  }
};

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

exports.getAllShowViewActionEp = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const { status, searchText, page } =
      await GoviShopValidation.getAllShopViewActionSchema.validateAsync(
        req.query,
      );

    // Call the DAO to get all collection officers
    const result = await GoviShopDAO.getAllShowViewActionDAO(
      status,
      searchText,
    );

    console.log("result", result);

    return res.status(200).json(result);
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching collection officers:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching collection officers" });
  }
};
