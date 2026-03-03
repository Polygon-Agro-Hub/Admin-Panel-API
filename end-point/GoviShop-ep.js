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




exports.getAllShowViewActionEp = async (req, res) => {
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log(fullUrl);
  
  
    try {
      const { status, searchText, page } = req.query;
  
  
      // Call the DAO to get all collection officers
      const result = await GoviShopDAO.getAllShowViewActionDAO(
        status,
        searchText,  
      );
  
      console.log('result', result);
  
      return res.status(200).json(result);
    } catch (error) {
      // if (error.isJoi) {
      //   // Handle validation error
      //   return res.status(400).json({ error: error.details[0].message });
      // }
  
      console.error("Error fetching collection officers:", error);
      return res
        .status(500)
        .json({ error: "An error occurred while fetching collection officers" });
    }
  };