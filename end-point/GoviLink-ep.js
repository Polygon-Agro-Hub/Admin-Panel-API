const GoviLinkDAO = require("../dao/GoviLink-dao");
const uploadFileToS3 = require("../middlewares/s3upload");
const GoviLinkValidation = require("../validations/GoviLink-validation");
const deleteFromS3 = require("../middlewares/s3delete");

exports.saveOfficerService = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    const { englishName, tamilName, sinhalaName, srvFee } = req.body;

    // Validation (basic check)
    if (!englishName || !tamilName || !sinhalaName) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Save data through DAO
    const result = await GoviLinkDAO.saveOfficerService(
      englishName,
      tamilName,
      sinhalaName,
      srvFee
    );

    console.log("Officer service saved successfully");
    res.status(201).json(result);
  } catch (err) {
    console.error("Error saving officer service:", err);
    res.status(500).json({ error: "An error occurred while saving data." });
  }
};

// Update officer service by ID
exports.updateOfficerService = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);

  try {
    const { id } = req.params;
    const { englishName, tamilName, sinhalaName, srvFee, modifyBy } = req.body;

    // Validation (basic check)
    if (!englishName || !tamilName || !sinhalaName) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check for duplicate service names (excluding current record)
    const duplicateCheck = await GoviLinkDAO.checkDuplicateServiceNames(
      id,
      englishName,
      tamilName,
      sinhalaName
    );

    if (duplicateCheck.exists) {
      const { field, duplicateValue, existingId } = duplicateCheck;

      // Create user-friendly error messages
      const fieldNames = {
        englishName: 'English Name',
        tamilName: 'Tamil Name',
        sinhalaName: 'Sinhala Name'
      };

      const errorMessage = `"${duplicateValue}" already exists as a ${fieldNames[field]}. Please use a different ${fieldNames[field].toLowerCase()}.`;

      return res.status(409).json({
        success: false,
        error: errorMessage,
        duplicateDetails: {
          field: field,
          fieldDisplay: fieldNames[field],
          duplicateValue: duplicateValue,
          existingServiceId: existingId,
          message: `Duplicate ${fieldNames[field]} found`
        }
      });
    }

    // Update via DAO
    const result = await GoviLinkDAO.updateOfficerService(
      id,
      englishName,
      tamilName,
      sinhalaName,
      srvFee,
      modifyBy
    );

    console.log(`Officer service with ID ${id} updated successfully`);
    res.status(200).json({
      success: true,
      message: "Officer service updated successfully",
      data: result
    });
  } catch (err) {
    console.error("Error updating officer service:", err);
    res.status(500).json({
      success: false,
      error: "An error occurred while updating data."
    });
  }
};

exports.getOfficerServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await GoviLinkDAO.getOfficerServiceById(id);

    res.status(200).json(service);
  } catch (err) {
    console.error("Error fetching officer service:", err);
    res.status(404).json({ error: err.message });
  }
};
exports.getAllOfficerServices = async (req, res) => {
  try {
    const services = await GoviLinkDAO.getAllOfficerServices();
    res.status(200).json(services);
  } catch (err) {
    console.error("Error fetching officer services:", err);
    res.status(500).json({ error: "Failed to fetch officer services" });
  }
};

// Delete officer service by ID
exports.deleteOfficerService = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const id = req.params.id; // get ID from URL params

  try {
    const result = await GoviLinkDAO.deleteOfficerServiceById(id); // call DAO function
    if (result.affectedRows > 0) {
      res.status(200).json({ message: "Service deleted successfully" });
    } else {
      res.status(404).json({ message: "Service not found" });
    }
  } catch (err) {
    console.error("Error deleting officer service:", err);
    res.status(500).json({ error: "Failed to delete officer service" });
  }
};

// Get all govi link jobs with filters
exports.getAllGoviLinkJobs = async (req, res) => {
  try {
    const { search, district, status, assignStatus, date } = req.query;

    const results = await GoviLinkDAO.getAllGoviLinkJobsDAO({
      searchTerm: search,
      district,
      status,
      assignStatus,
      date,
    });

    console.log("Successfully retrieved all GoviLink jobs");

    res.json({
      results,
      total: results.length,
    });
  } catch (err) {
    console.error("Error fetching GoviLink jobs:", err);
    res
      .status(500)
      .json({ error: "An error occurred while fetching GoviLink jobs" });
  }
};

// Get field officers by job role
exports.getOfficersByJobRole = async (req, res) => {
  try {
    const { jobRole, scheduleDate } = req.query;

    if (!jobRole || !scheduleDate) {
      return res.status(400).json({
        error: "jobRole and scheduleDate parameters are required",
      });
    }

    const officers = await GoviLinkDAO.getOfficersByJobRoleDAO(
      jobRole,
      scheduleDate
    );

    console.log(
      `Successfully retrieved officers with job role: ${jobRole} on ${scheduleDate}`
    );

    res.json({
      success: true,
      data: officers,
      total: officers.length,
    });
  } catch (err) {
    console.error("Error fetching officers by job role:", err);
    res.status(500).json({
      error: "An error occurred while fetching officers",
      details: err.message,
    });
  }
};

// Assign officer to job with automatic deactivation of previous assignments
exports.assignOfficerToJob = async (req, res) => {
  try {
    const { jobId, officerId } = req.body;

    if (!jobId || !officerId) {
      return res.status(400).json({
        success: false,
        error: "jobId and officerId are required",
      });
    }

    const result = await GoviLinkDAO.assignOfficerToJobDAO(jobId, officerId);

    if (result.success) {
      res.json({
        success: true,
        message: "Officer assigned successfully",
        data: result.data,
      });
    } else {
      // Handle specific error cases
      if (
        result.error.includes("not found") ||
        result.error.includes("inactive")
      ) {
        return res.status(404).json({
          success: false,
          error: result.error,
        });
      } else if (result.error.includes("completed")) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    }
  } catch (err) {
    console.error("Error assigning officer to job:", err);
    res.status(500).json({
      success: false,
      error: "An error occurred while assigning officer",
      details: err.message,
    });
  }
};

// Get basic job details by ID
exports.getJobBasicDetailsById = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: "jobId parameter is required",
      });
    }

    const jobDetails = await GoviLinkDAO.getJobBasicDetailsByIdDAO(jobId);

    if (jobDetails) {
      res.json({
        success: true,
        data: jobDetails,
      });
    } else {
      res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }
  } catch (err) {
    console.error("Error fetching job details:", err);
    res.status(500).json({
      success: false,
      error: "An error occurred while fetching job details",
      details: err.message,
    });
  }
};


exports.getFieldAuditDetails = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    // Filters
    const filters = {
      status: req.query.status,
      district: req.query.district,
      completedDateFrom: req.query.completedDateFrom,
      completedDateTo: req.query.completedDateTo
    };

    // Search parameters
    const search = {
      jobId: req.query.searchJobId,
      farmId: req.query.searchFarmId,
      nic: req.query.searchNic
    };

    // Remove undefined/null/empty filters and search params
    Object.keys(filters).forEach(key => {
      if (!filters[key]) delete filters[key];
    });

    Object.keys(search).forEach(key => {
      if (!search[key]) delete search[key];
    });

    console.log('Filters being passed:', filters);
    console.log('Search being passed:', search);

    const auditDetails = await GoviLinkDAO.getFieldAuditDetails(filters, search);

    res.json({
      success: true,
      data: auditDetails,
      total: auditDetails.length,
      filters: filters,
      search: search,
      message: "Field audit details fetched successfully"
    });
  } catch (err) {
    console.error("Error fetching field audit details:", err);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching field audit details.",
      error: err.message
    });
  }
};


exports.getFieldOfficerComplainById = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const { id } = req.params;

    console.log("Fetching field officer complain with ID:", id);

    const result = await GoviLinkDAO.GetFieldOfficerComplainByIdDAO(id);

    if (!result) {
      console.log("Field officer complain not found");
      return res.status(404).json({
        error: "Field officer complain not found"
      });
    }

    console.log("Successfully retrieved field officer complain");
    res.json(result);
  } catch (err) {
    console.error("Error fetching field officer complain by ID:", err);
    res.status(500).json({
      error: "An error occurred while fetching field officer complain"
    });
  }
};


exports.replyFieldOfficerComplain = async (req, res) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;
    const replyBy = req.user.userId;

    console.log('Replying to field officer complaint:', id);


    if (!reply || reply.trim() === '') {
      return res.status(400).json({ 
        error: 'Reply cannot be empty' 
      });
    }


    await GoviLinkDAO.ReplyFieldOfficerComplainDAO(
      id,
      reply.trim(),
      replyBy
    );

    console.log('Successfully replied to field officer complaint');
    res.json({ 
      message: 'Reply sent successfully',
      success: true 
    });
  } catch (err) {
    if (err.message === 'Complaint not found') {
      console.error('Complaint not found:', err);
      return res.status(404).json({ 
        error: 'Complaint not found' 
      });
    }

    console.error('Error replying to field officer complaint:', err);
    res.status(500).json({ 
      error: 'An error occurred while sending the reply' 
    });
  }
};