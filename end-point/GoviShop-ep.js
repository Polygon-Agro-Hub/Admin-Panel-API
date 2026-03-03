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

    const { total, shopUsers } = await GoviShopDAO.getAllGoviShopUsers(
      search,
      currentPlan,
    );

    res.json({
      shopUsers,
      total,
    });
  } catch (err) {
    console.error("Error fetching shop users:", err);
    res.status(500).json({
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
