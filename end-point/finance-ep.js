const financeDao = require("../dao/Finance-dao");
const {
  createAgentCommissionSchema,
  updateAgentCommissionSchema,
  getAllSchema,
  idSchema,
  getAllFarmerPaymentsSchema,
  createPaymentHistorySchema,
  updatePaymentHistorySchema,
  paymentHistoryIdSchema,
  getAllInvestmentSchema,
  getInvestmentIdSchema,
  getAgentCommitionsShema,
} = require("../validations/finance-validation");

const uploadFileToS3 = require("../middlewares/s3upload");
const deleteFromS3 = require("../middlewares/s3delete");
const { IdParamShema } = require("../validations/Admin-validation");

exports.getDashboardData = async (req, res) => {
  try {
    const dashboardData = await financeDao.getAllDashboardData();

    // Calculate income change percentage and status
    const currentIncome =
      parseFloat(dashboardData.income.currentMonthIncome) || 0;
    const previousIncome =
      parseFloat(dashboardData.income.previousMonthIncome) || 0;

    let incomeChangePercentage = 0;
    let incomeStatus = "stable";

    if (previousIncome > 0) {
      incomeChangePercentage =
        ((currentIncome - previousIncome) / previousIncome) * 100;

      if (incomeChangePercentage > 0) {
        incomeStatus = "increased";
      } else if (incomeChangePercentage < 0) {
        incomeStatus = "decreased";
      }
    } else if (currentIncome > 0) {
      incomeChangePercentage = 100;
      incomeStatus = "increased";
    }

    // Create data structure up to current month only
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const fullYearData = monthNames
      .slice(0, currentMonth)
      .map((monthName, index) => {
        const monthNum = index + 1;
        const existingData = dashboardData.monthlyStatistics.find((stat) => {
          const statMonth = new Date(`${stat.month}-01`).getMonth() + 1;
          return statMonth === monthNum;
        });

        return {
          month: `${currentYear}-${String(monthNum).padStart(2, "0")}`,
          monthName: monthName,
          payments: existingData ? existingData.payments : 0,
          revenue: existingData ? parseFloat(existingData.revenue) : 0,
        };
      });

    // Prepare area chart data arrays
    const monthlyLabels = fullYearData.map((stat) => stat.monthName);
    const monthlyValues = fullYearData.map((stat) => stat.revenue);

    res.json({
      status: true,
      data: {
        statistics: {
          totalUsers: dashboardData.stats.totalUsers,
          proUsers: dashboardData.stats.proUsers,
          freeUsers: dashboardData.stats.freeUsers,
          monthlyIncome: currentIncome,
          relativeIncomeValue: Math.abs(
            parseFloat(incomeChangePercentage.toFixed(2))
          ),
          incomeStatus: incomeStatus,
        },
        recentPayments: dashboardData.recentPayments,
        packageEnrollments: {
          free:
            dashboardData.enrollments.find((e) => e.membership === "Basic")
              ?.count || 0,
          pro:
            dashboardData.enrollments.find((e) => e.membership === "Pro")
              ?.count || 0,
        },
        monthlyStatistics: fullYearData,
        areaChartData: {
          labels: monthlyLabels,
          values: monthlyValues,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return res.status(500).json({
      status: false,
      error: "An error occurred while fetching dashboard data",
    });
  }
};

exports.getAllPackagePayments = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    // Extract and set default values for query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const fromDate = req.query.fromDate || "";
    const toDate = req.query.toDate || "";

    // Basic validation
    if (page < 1) {
      return res.status(400).json({ error: "Page must be greater than 0" });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({ error: "Limit must be between 1 and 100" });
    }

    console.log("Query params:", { page, limit, search, fromDate, toDate });

    // Call the DAO to get all package payments
    const result = await financeDao.getAllPackagePayments(
      page,
      limit,
      search,
      fromDate,
      toDate
    );

    console.log("Successfully fetched package payments");
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching package payments:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching package payments" });
  }
};

// Function for govi job dashboard data
exports.getGovijobDashboardData = async (req, res) => {
  try {
    const dashboardData = await financeDao.getAllGovijobDashboardData();

    // ===== Income comparison logic =====
    const currentIncome =
      parseFloat(dashboardData.income.currentMonthIncome) || 0;
    const previousIncome =
      parseFloat(dashboardData.income.previousMonthIncome) || 0;

    let incomeChangePercentage = 0;
    let incomeStatus = "stable";

    if (previousIncome > 0) {
      incomeChangePercentage =
        ((currentIncome - previousIncome) / previousIncome) * 100;
      if (incomeChangePercentage > 0) incomeStatus = "increased";
      else if (incomeChangePercentage < 0) incomeStatus = "decreased";
    } else if (currentIncome > 0) {
      incomeChangePercentage = 100;
      incomeStatus = "increased";
    }

    // ===== Build chart data (current year until this month) =====
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const fullYearData = monthNames
      .slice(0, currentMonth)
      .map((monthName, index) => {
        const monthNum = index + 1;
        const existingData = dashboardData.monthlyStatistics.find((stat) => {
          const statMonth = new Date(`${stat.month}-01`).getMonth() + 1;
          return statMonth === monthNum;
        });

        return {
          month: `${currentYear}-${String(monthNum).padStart(2, "0")}`,
          monthName,
          payments: existingData ? existingData.payments : 0,
          revenue: existingData ? parseFloat(existingData.revenue) : 0,
        };
      });

    const monthlyLabels = fullYearData.map((stat) => stat.monthName);
    const monthlyValues = fullYearData.map((stat) => stat.revenue);

    res.json({
      status: true,
      data: {
        statistics: {
          totalIncome: currentIncome,
          relativeIncomeValue: Math.abs(
            parseFloat(incomeChangePercentage.toFixed(2))
          ),
          incomeStatus,
          serviceRequestsThisMonth: dashboardData.stats.requestsThisMonth,
          serviceRequestsToday: dashboardData.stats.requestsToday,
        },
        recentPayments: dashboardData.recentPayments,
        monthlyStatistics: fullYearData,
        areaChartData: {
          labels: monthlyLabels,
          values: monthlyValues,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching Govijob dashboard data:", error);
    res.status(500).json({
      status: false,
      error: "An error occurred while fetching Govijob dashboard data",
    });
  }
};

exports.getCertificateDashboardData = async (req, res) => {
  try {
    const dashboardData = await financeDao.getAllCertificateDashboardData();

    // Calculate income change percentage and status
    const currentIncome =
      parseFloat(dashboardData.income.currentMonthIncome) || 0;
    const previousIncome =
      parseFloat(dashboardData.income.previousMonthIncome) || 0;

    let incomeChangePercentage = 0;
    let incomeStatus = "stable";

    if (previousIncome > 0) {
      incomeChangePercentage =
        ((currentIncome - previousIncome) / previousIncome) * 100;

      if (incomeChangePercentage > 0) {
        incomeStatus = "increased";
      } else if (incomeChangePercentage < 0) {
        incomeStatus = "decreased";
      }
    } else if (currentIncome > 0) {
      incomeChangePercentage = 100;
      incomeStatus = "increased";
    }

    // Cap relativeIncomeValue at 100 (FIXED)
    const relativeIncomeValue = Math.min(
      100,
      Math.abs(parseFloat(incomeChangePercentage.toFixed(2)))
    );

    // Create data structure up to current month only
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const fullYearData = monthNames
      .slice(0, currentMonth)
      .map((monthName, index) => {
        const monthNum = index + 1;
        const existingData = dashboardData.monthlyStatistics.find((stat) => {
          const statMonth = new Date(`${stat.month}-01`).getMonth() + 1;
          return statMonth === monthNum;
        });

        return {
          month: `${currentYear}-${String(monthNum).padStart(2, "0")}`,
          monthName: monthName,
          payments: existingData ? existingData.payments : 0,
          revenue: existingData ? parseFloat(existingData.revenue) : 0,
        };
      });

    // Prepare area chart data arrays
    const monthlyLabels = fullYearData.map((stat) => stat.monthName);
    const monthlyValues = fullYearData.map((stat) => stat.revenue);

    // Prepare certificate type breakdown from certificationpayment table
    const certificateTypeBreakdown = {
      forCrop:
        dashboardData.certificateTypes.find((c) => c.payType === "Crop")
          ?.count || 0,
      forFarm:
        dashboardData.certificateTypes.find((c) => c.payType === "Farm")
          ?.count || 0,
      forFarmCluster:
        dashboardData.certificateTypes.find((c) => c.payType === "Cluster")
          ?.count || 0,
    };

    // Format recent payments with validity period (FIXED)
    // Validity period now comes pre-formatted from SQL
    const formattedRecentPayments = dashboardData.recentPayments.map(
      (payment) => ({
        transactionId: payment.transactionId,
        farmerName: payment.farmerName,
        validityPeriod: payment.validityMonths || "Expired",
        amount: payment.amount,
        dateTime: payment.dateTime,
      })
    );

    res.json({
      status: true,
      data: {
        statistics: {
          totalCertificates: dashboardData.stats.totalCertificates,
          activeEnrollments: dashboardData.stats.activeEnrollments,
          expiredEnrollments: dashboardData.stats.expiredEnrollments,
          monthlyIncome: currentIncome,
          relativeIncomeValue: relativeIncomeValue, // Now capped at 100
          incomeStatus: incomeStatus,
        },
        recentPayments: formattedRecentPayments,
        enrollmentBreakdown: certificateTypeBreakdown,
        monthlyStatistics: fullYearData,
        areaChartData: {
          labels: monthlyLabels,
          values: monthlyValues,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching certificate dashboard data:", error);
    return res.status(500).json({
      status: false,
      error: "An error occurred while fetching certificate dashboard data",
    });
  }
};

exports.getAllServicePayments = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    // Extract and set default values for query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const fromDate = req.query.fromDate || "";
    const toDate = req.query.toDate || "";

    // Basic validation
    if (page < 1) {
      return res.status(400).json({ error: "Page must be greater than 0" });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({ error: "Limit must be between 1 and 100" });
    }

    console.log("Query params:", { page, limit, search, fromDate, toDate });

    // Call the DAO to get all service payments
    const result = await financeDao.getAllServicePayments(
      page,
      limit,
      search,
      fromDate,
      toDate
    );

    console.log("Successfully fetched service payments");
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching service payments:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching service payments" });
  }
};

exports.getAllCertificatePayments = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    // Extract and set default values for query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const fromDate = req.query.fromDate || "";
    const toDate = req.query.toDate || "";

    // Basic validation
    if (page < 1) {
      return res.status(400).json({ error: "Page must be greater than 0" });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({ error: "Limit must be between 1 and 100" });
    }

    console.log("Query params:", { page, limit, search, fromDate, toDate });

    // Call the DAO to get all certificate payments
    const result = await financeDao.getAllCertificatePayments(
      page,
      limit,
      search,
      fromDate,
      toDate
    );

    console.log("Successfully fetched certificate payments");
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching certificate payments:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching certificate payments" });
  }
};

// Get all agent commissions
exports.getAllAgentCommissions = async (req, res) => {
  try {
    // Validate query parameters
    const { error, value } = getAllSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        status: false,
        message: "Validation error",
        error: error.details[0].message,
      });
    }

    const { page, limit, search } = value;

    const result = await financeDao.getAllAgentCommissions(page, limit, search);

    return res.status(200).json({
      status: true,
      message: "Agent commissions retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching agent commissions:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching agent commissions",
      error: error.message,
    });
  }
};

// Get agent commission by ID
exports.getAgentCommissionById = async (req, res) => {
  try {
    // Validate ID parameter
    const { error, value } = idSchema.validate({ id: req.params.id });
    if (error) {
      return res.status(400).json({
        status: false,
        message: "Validation error",
        error: error.details[0].message,
      });
    }

    const { id } = value;
    const commission = await financeDao.getAgentCommissionById(id);

    if (!commission) {
      return res.status(404).json({
        status: false,
        message: "Agent commission not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Agent commission retrieved successfully",
      data: commission,
    });
  } catch (error) {
    console.error("Error fetching agent commission:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching agent commission",
      error: error.message,
    });
  }
};

// Create new agent commission
exports.createAgentCommission = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = createAgentCommissionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: false,
        message: "Validation error",
        error: error.details[0].message,
      });
    }

    // Check for overlapping ranges
    const rangeOverlap = await financeDao.checkRangeOverlap(
      value.minRange,
      value.maxRange
    );

    if (rangeOverlap) {
      return res.status(400).json({
        status: false,
        message: "Commission range overlaps with existing range",
      });
    }

    // Get user ID from authenticated request
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "User authentication required",
      });
    }

    const commissionData = {
      ...value,
      modifyBy: userId,
    };

    const newCommission = await financeDao.createAgentCommission(
      commissionData
    );

    return res.status(201).json({
      status: true,
      message: "Agent commission created successfully",
      data: newCommission,
    });
  } catch (error) {
    console.error("Error creating agent commission:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while creating agent commission",
      error: error.message,
    });
  }
};

// Update agent commission
exports.updateAgentCommission = async (req, res) => {
  try {
    // Validate ID parameter
    const idValidation = idSchema.validate({ id: req.params.id });
    if (idValidation.error) {
      return res.status(400).json({
        status: false,
        message: "Validation error",
        error: idValidation.error.details[0].message,
      });
    }

    const { id } = idValidation.value;

    // Validate request body
    const { error, value } = updateAgentCommissionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: false,
        message: "Validation error",
        error: error.details[0].message,
      });
    }

    // Check if commission exists
    const existingCommission = await financeDao.getAgentCommissionById(id);
    if (!existingCommission) {
      return res.status(404).json({
        status: false,
        message: "Agent commission not found",
      });
    }

    // Check for overlapping ranges if minRange or maxRange are being updated
    const minRange =
      value.minRange !== undefined
        ? value.minRange
        : existingCommission.minRange;
    const maxRange =
      value.maxRange !== undefined
        ? value.maxRange
        : existingCommission.maxRange;

    const rangeOverlap = await financeDao.checkRangeOverlap(
      minRange,
      maxRange,
      id
    );
    if (rangeOverlap) {
      return res.status(400).json({
        status: false,
        message: "Commission range overlaps with existing range",
      });
    }

    // Get user ID from authenticated request
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "User authentication required",
      });
    }

    // Prepare update data
    const updateData = {
      ...value,
      modifyBy: userId, // always set who updated
      modifyDate: new Date(),
    };

    const updatedCommission = await financeDao.updateAgentCommission(
      id,
      updateData
    );

    return res.status(200).json({
      status: true,
      message: "Agent commission updated successfully",
      data: updatedCommission,
    });
  } catch (error) {
    console.error("Error updating agent commission:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while updating agent commission",
      error: error.message,
    });
  }
};

// Delete agent commission
exports.deleteAgentCommission = async (req, res) => {
  try {
    // Validate ID parameter
    const { error, value } = idSchema.validate({ id: req.params.id });
    if (error) {
      return res.status(400).json({
        status: false,
        message: "Validation error",
        error: error.details[0].message,
      });
    }

    const { id } = value;

    // Check if commission exists
    const existingCommission = await financeDao.getAgentCommissionById(id);
    if (!existingCommission) {
      return res.status(404).json({
        status: false,
        message: "Agent commission not found",
      });
    }

    await financeDao.deleteAgentCommission(id);

    return res.status(200).json({
      status: true,
      message: "Agent commission deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting agent commission:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while deleting agent commission",
      error: error.message,
    });
  }
};

exports.getALlFarmerPayments = async (req, res) => {
  try {
    // Validate ID parameter
    const { error, value } = getAllFarmerPaymentsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        status: false,
        message: "Validation error",
        error: error.details[0].message,
      });
    }
    console.log(value.date);

    // Check if commission exists
    const result = await financeDao.getAllFarmerPaymentDao(
      value.date,
      value.bank
    );
    if (!result) {
      return res.status(404).json({
        status: false,
        message: "Farmer Payemnt not found",
      });
    }

    return res.status(200).json({
      status: true,
      data: result,
    });
  } catch (error) {
    console.error("Error deleting agent commission:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while deleting agent commission",
      error: error.message,
    });
  }
};

exports.createPaymentHistory = async (req, res) => {
  try {
    // Joi validation
    const validatedBody = await createPaymentHistorySchema.validateAsync(
      req.body
    );

    const { receivers, amount, paymentReference } = validatedBody;
    const issueBy = req.user.userId;

    console.log("Creating payment history:", {
      receivers,
      amount,
      paymentReference,
    });

    // File validation
    if (!req.file) {
      return res.status(400).json({
        error: "Excel file is required",
      });
    }

    // Validate file type
    const allowedExtensions = [".xlsx", ".xls", ".csv"];
    const fileExtension = req.file.originalname
      .substring(req.file.originalname.lastIndexOf("."))
      .toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      return res.status(400).json({
        error:
          "Invalid file type. Only Excel files (.xlsx, .xls, .csv) are allowed",
      });
    }

    // Upload file to Cloudflare R2
    const xlLink = await uploadFileToS3(
      req.file.buffer,
      req.file.originalname,
      "payment-history"
    );

    console.log("File uploaded to R2:", xlLink);

    // Insert into database
    const result = await financeDao.InsertPaymentHistoryDAO(
      receivers,
      parseFloat(amount),
      paymentReference,
      xlLink,
      issueBy
    );

    console.log("Payment history created successfully");
    res.status(201).json({
      message: "Payment history created successfully",
      id: result.insertId,
      xlLink: xlLink,
    });
  } catch (err) {
    // Handle Joi validation errors
    if (err.isJoi) {
      return res.status(400).json({
        error: "Validation error",
        details: err.details.map((detail) => detail.message),
      });
    }

    console.error("Error creating payment history:", err);
    res.status(500).json({
      error: "An error occurred while creating payment history",
    });
  }
};

exports.updatePaymentHistory = async (req, res) => {
  try {
    // Joi validation for params
    const validatedParams = await paymentHistoryIdSchema.validateAsync(
      req.params
    );

    // Joi validation for body
    const validatedBody = await updatePaymentHistorySchema.validateAsync(
      req.body
    );

    const { id } = validatedParams;
    const { receivers, amount, paymentReference } = validatedBody;
    const modifyBy = req.user.userId; // From JWT token

    console.log("Updating payment history:", id);

    // Get existing record
    const existingRecord = await financeDao.GetPaymentHistoryByIdDAO(id);

    if (!existingRecord) {
      return res.status(404).json({
        error: "Payment history record not found",
      });
    }

    let xlLink = existingRecord.xlLink;

    // If new file is uploaded
    if (req.file) {
      // Validate file type
      const allowedExtensions = [".xlsx", ".xls", ".csv"];
      const fileExtension = req.file.originalname
        .substring(req.file.originalname.lastIndexOf("."))
        .toLowerCase();

      if (!allowedExtensions.includes(fileExtension)) {
        return res.status(400).json({
          error:
            "Invalid file type. Only Excel files (.xlsx, .xls, .csv) are allowed",
        });
      }

      // Delete old file from R2
      if (existingRecord.xlLink) {
        try {
          await deleteFromS3(existingRecord.xlLink);
          console.log("Old file deleted from R2");
        } catch (deleteError) {
          console.error("Error deleting old file:", deleteError);
          // Continue even if deletion fails
        }
      }

      // Upload new file to R2
      xlLink = await uploadFileToS3(
        req.file.buffer,
        req.file.originalname,
        "payment-history"
      );

      console.log("New file uploaded to R2:", xlLink);
    }

    // Update database
    await financeDao.UpdatePaymentHistoryDAO(
      id,
      receivers,
      parseFloat(amount),
      paymentReference,
      xlLink,
      modifyBy
    );

    console.log("Payment history updated successfully");
    res.json({
      message: "Payment history updated successfully",
      xlLink: xlLink,
    });
  } catch (err) {
    // Handle Joi validation errors
    if (err.isJoi) {
      return res.status(400).json({
        error: "Validation error",
        details: err.details.map((detail) => detail.message),
      });
    }

    if (err.message === "Payment history record not found") {
      return res.status(404).json({
        error: "Payment history record not found",
      });
    }

    console.error("Error updating payment history:", err);
    res.status(500).json({
      error: "An error occurred while updating payment history",
    });
  }
};

exports.getPaymentHistoryById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("Fetching payment history by ID:", id);

    const result = await financeDao.GetPaymentHistoryByIdDAO(id);

    if (!result) {
      return res.status(404).json({
        error: "Payment history record not found",
      });
    }

    console.log("Payment history retrieved successfully");
    res.json(result);
  } catch (err) {
    console.error("Error fetching payment history:", err);
    res.status(500).json({
      error: "An error occurred while fetching payment history",
    });
  }
};

exports.getAllPaymentHistory = async (req, res) => {
  try {
    const { receivers, issuedDate, search } = req.query;

    console.log("Fetching all payment history with filters:", {
      receivers,
      issuedDate,
      search,
    });

    // Build filters object
    const filters = {};

    if (receivers) {
      filters.receivers = receivers;
    }

    if (issuedDate) {
      filters.issuedDate = issuedDate;
    }

    if (search) {
      filters.search = search;
    }

    const results = await financeDao.GetAllPaymentHistoryDAO(filters);

    console.log(`Retrieved ${results.length} payment history records`);

    res.json({
      count: results.length,
      data: results,
    });
  } catch (err) {
    console.error("Error fetching payment history:", err);
    res.status(500).json({
      error: "An error occurred while fetching payment history",
    });
  }
};

exports.deletePaymentHistory = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("Deleting payment history:", id);

    // Get existing record to delete file from R2
    const existingRecord = await financeDao.GetPaymentHistoryByIdDAO(id);

    if (!existingRecord) {
      return res.status(404).json({
        error: "Payment history record not found",
      });
    }

    // Delete file from R2 if exists
    if (existingRecord.xlLink) {
      try {
        await deleteFromS3(existingRecord.xlLink);
        console.log("File deleted from R2:", existingRecord.xlLink);
      } catch (deleteError) {
        console.error("Error deleting file from R2:", deleteError);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete from database
    await financeDao.DeletePaymentHistoryDAO(id);

    console.log("Payment history deleted successfully");
    res.json({
      message: "Payment history deleted successfully",
    });
  } catch (err) {
    if (err.message === "Payment history record not found") {
      return res.status(404).json({
        error: "Payment history record not found",
      });
    }

    console.error("Error deleting payment history:", err);
    res.status(500).json({
      error: "An error occurred while deleting payment history",
    });
  }
};



exports.getAllInvestmentRequests = async (req, res) => {
  try {
    const { status, search } = req.query;

    console.log('Fetching all investment requests with filters:', { status, search });

    const filters = {};

    if (status) {
      filters.status = status;
    }

    if (search) {
      filters.search = search;
    }

    const results = await financeDao.GetAllInvestmentRequestsDAO(filters);

    console.log(`Retrieved ${results.length} investment request records`);

    res.json({
      count: results.length,
      data: results
    });
  } catch (err) {
    console.error('Error fetching investment requests:', err);
    res.status(500).json({
      error: 'An error occurred while fetching investment requests'
    });
  }
};

exports.getInvestmentRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Fetching investment request details for ID:', id);

    const result = await financeDao.GetInvestmentRequestByIdDAO(id);

    if (!result) {
      return res.status(404).json({
        status: false,
        message: 'Investment request not found'
      });
    }

    res.json({
      status: true,
      data: result
    });
  } catch (err) {
    console.error('Error fetching investment request details:', err);
    res.status(500).json({
      status: false,
      error: 'An error occurred while fetching investment request details'
    });
  }
};

exports.getOfficersByDistrictAndRoleForInvestment = async (req, res) => {
  try {
    const { district, jobRole, Farmer_ID } = req.query;

    console.log('Farmer_ID:', Farmer_ID);

    if (!district || !jobRole) {
      return res.status(400).json({
        message: "district and jobRole parameters are required",
        status: false,
      });
    }

    const officers = await financeDao.getOfficersByDistrictAndRoleForInvestmentDAO(
      district,
      jobRole,
      Farmer_ID
    );

    res.status(200).json({
      message: "Officers retrieved successfully",
      status: true,
      data: officers,
      total: officers.length,
    });
  } catch (err) {
    console.error("Error fetching officers by district and role:", err);
    res.status(500).json({
      message: "Internal server error",
      status: false,
      error: err.message,
    });
  }
};

exports.assignOfficerToInvestmentRequest = async (req, res) => {
  try {
    const { requestId, officerId } = req.body;

    const assignByUserId = req.user.userId;
    console.log('Assigning officer to investment request:', assignByUserId);

    console.log('Authentication debug:', {
      user: req.user,
      assignByUserId: assignByUserId
    });

    // Validate required fields
    if (!requestId || !officerId) {
      return res.status(400).json({
        message: "requestId and officerId are required",
        status: false,
      });
    }

    const investmentRequestId = parseInt(requestId);
    if (isNaN(investmentRequestId)) {
      return res.status(400).json({
        message: "requestId must be a valid number",
        status: false,
      });
    }

    // Validate officerId is a number
    const assignOfficerId = parseInt(officerId);
    if (isNaN(assignOfficerId)) {
      return res.status(400).json({
        message: "officerId must be a valid number",
        status: false,
      });
    }

    if (!assignByUserId) {
      console.warn('assignByUserId not found in req.user, proceeding without it');
    }

    // Assign officer using DAO
    const result = await financeDao.assignOfficerToInvestmentRequestDAO(
      investmentRequestId,
      assignOfficerId,
      assignByUserId
    );

    res.status(200).json({
      message: "Officer assigned successfully",
      status: true,
      data: result,
    });
  } catch (err) {
    console.error("Error assigning officer to investment request:", err);

    if (err.message.includes("not found")) {
      return res.status(404).json({
        message: err.message,
        status: false,
      });
    }

    res.status(500).json({
      message: "Internal server error",
      status: false,
      error: err.message,
    });
  }
};

exports.getAllRejectedInvestmentRequests = async (req, res) => {
  try {
    const { search } = req.query;

    console.log("Fetching all rejected investment requests with search:", {
      search,
    });

    // Build filters object
    const filters = {};

    if (search) {
      filters.search = search;
    }

    const results = await financeDao.GetAllRejectedInvestmentRequestsDAO(filters);

    console.log(`Retrieved ${results.length} rejected investment requests`);

    res.json({
      count: results.length,
      data: results,
    });
  } catch (err) {
    console.error("Error fetching rejected investment requests:", err);
    res.status(500).json({
      error: "An error occurred while fetching rejected investment requests",
    });
  }
};

exports.getAllPublishedProjects = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);


  try {
    const { page, searchText } = req.query;


    // Call the DAO to get all collection officers
    const result = await financeDao.getAllPublishedProjectsDAO(
      searchText
    );

    // console.log({ page, limit });
    console.log('result', result);

    return res.status(200).json({ items: result });
  } catch (error) {


    console.error("Error fetching collection officers:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching collection officers" });
  }
};


exports.GetAllApprovedInvestmentRequests = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const { status, shares, search } = req.query;

    console.log('shares', shares)

    const filters = {
      status: status || undefined,
      shares: shares || undefined,
      search: search || undefined,
    };

    const results = await financeDao.GetAllApprovedInvestmentRequestsDAO(filters);
    const count = results.length;

    res.status(200).json({
      count: count,
      data: results,
    });
  } catch (error) {
    console.error('Error in GetAllApprovedInvestmentRequests:', error);
    res.status(500).json({
      count: 0,
      data: [],
      error: 'Internal server error',
    });
  }
};

exports.UpdateInvestmentRequestPublishStatus = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);
  try {
    const requestId = req.params.id;
    const publishBy = req.user.userId;
    console.log('Publishing investment request ID:', requestId);
    console.log('Publish initiated by user ID:', publishBy);

    // First check if request exists and is approved
    const request = await financeDao.GetApprovedInvestmentRequestByIdDAO(requestId);

    if (!request) {
      return res.status(404).json({
        status: false,
        message: 'Request not found',
      });
    }

    if (request.reqStatus !== 'Approved') {
      return res.status(400).json({
        status: false,
        message: 'Only approved requests can be published',
      });
    }

    if (request.publishStatus === 'Published') {
      return res.status(400).json({
        status: false,
        message: 'This request is already published',
      });
    }

    // Update publish status
    await financeDao.UpdateInvestmentRequestPublishStatusDAO(requestId, publishBy);

    res.status(200).json({
      status: true,
      message: 'Project published successfully to GoViCapital',
    });
  } catch (error) {
    console.error('Error in UpdateInvestmentRequestPublishStatus:', error);
    res.status(500).json({
      status: false,
      message: 'Internal server error',
    });
  }
};

exports.GetProjectInvestment = async (req, res) => {
  try {
    const { search } = req.query;

    const filters = {
      search: search || undefined,
    };

    const results = await financeDao.GetProjectInvesmentDAO(filters);
    const count = results.length;

    res.status(200).json({
      count: count,
      data: results,
    });
  } catch (error) {
    console.error('Error in GetProjectInvestment:', error);
    res.status(500).json({
      count: 0,
      data: [],
      error: 'Internal server error',
    });
  }
};

exports.getALlInvestments = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    // const { id, status } = req.query;

    const { id, status, search } = await getAllInvestmentSchema.validateAsync(
      req.query
    );

    // Call the DAO to get all collection officers
    const result = await financeDao.getAllInvestmentsDao(
      id, status, search
    );

    // console.log({ page, limit });
    console.log('result', result);

    return res.status(200).json(result);
  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching collection officers:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching collection officers" });
  }
};

exports.ApproveInvestmentRequestEp = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {

    const { id } = await getInvestmentIdSchema.validateAsync(
      req.params
    );

    const result = await financeDao.approveInvestmentRequestDao(Number(id));

    // console.log({ page, limit });
    console.log('result', result);

    if (result?.affectedRows === 1) {
      return res.status(200).json({
        success: true,
        message: "Action completed successfully.",
        data: result
      });
    }
    else if (result?.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Action failed"
      });
    }
    // return res.status(200).json({
    //       success: true,
    //       message: "Action completed successfully.",
    //       data: result
    //     });

  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching collection officers:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching collection officers" });
  }
};

exports.RejectInvestmentRequestEp = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {

    const { id } = await getInvestmentIdSchema.validateAsync(
      req.params
    );

    const result = await financeDao.RejectInvestmentRequestDao(Number(id));

    // console.log({ page, limit });
    console.log('result', result);

    if (result?.affectedRows === 1) {
      return res.status(200).json({
        success: true,
        message: "Action completed successfully.",
        data: result
      });
    }
    else if (result?.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Action failed"
      });
    }
    // return res.status(200).json({
    //       success: true,
    //       message: "Action completed successfully.",
    //       data: result
    //     });

  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching collection officers:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching collection officers" });
  }
};

exports.getInspectionDerailsEp = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {

    const { id } = await getInvestmentIdSchema.validateAsync(
      req.params
    );

    const result = await financeDao.getInspectionDerailsDao(Number(id));
    const sharesData = await financeDao.getDetailsForDivideShareDao(Number(id));

    const hasDivideData =
      sharesData.totValue != null ||
      sharesData.defineShares != null ||
      sharesData.maxShare != null ||
      sharesData.minShare != null;

    const shares = {
      ...sharesData,
      devideData: hasDivideData
        ? {
          totValue: sharesData.totValue,
          defineShares: sharesData.defineShares,
          maxShare: sharesData.maxShare,
          minShare: sharesData.minShare
        }
        : null
    };

    // console.log({ page, limit });
    // console.log('result', result);

    res.status(200).json({
      success: true,
      message: "Inspection details retrieved successfully.",
      data: result,
      shares
    });

  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching collection officers:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching collection officers" });
  }
};

exports.GetAllAuditedInvestmentRequests = async (req, res) => {
  try {
    const { status, search } = req.query;

    const filters = {
      status: status || undefined,
      search: search || undefined,
    };

    const results = await financeDao.GetAllAuditedInvestmentRequestsDAO(filters);
    const count = results.length;

    res.status(200).json({
      count: count,
      data: results,
    });
  } catch (error) {
    console.error('Error in GetAllApprovedInvestmentRequests:', error);
    res.status(500).json({
      count: 0,
      data: [],
      error: 'Internal server error',
    });
  }
};


exports.devideSharesRequestEp = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);
  try {
    const { sharesData } = req.body;
    const adminId = req.user.userId;

    console.log('sharesData', sharesData)

    // Validate required fields
    if (!sharesData) {
      return res.status(400).json({
        message: "sharesdata is required",
        status: false,
      });
    }

    let result = null;

    if (sharesData.devideType === 'Edit') {
      result = await financeDao.editDevideSharesDao(
        sharesData,
        adminId
      );
      return res.status(200).json({
        message: "Request Edited Successfully",
        status: true,
        data: result,
      });
    } else if (sharesData.devideType === 'Create') {
      result = await financeDao.devideSharesDao(
        sharesData,
        adminId
      );
      return res.status(200).json({
        message: "Request Created Successfully",
        status: true,
        data: result,
      });
    }
    // const result = await financeDao.devideSharesDao(
    //   sharesData
    // );

    // if (result) {
    //   approveRequestResult = await financeDao.ApproveRequestDao(
    //     sharesData.id
    //   );
    // }

    res.status(200).json({
      message: "Request Approved Successfully",
      status: true,
      data: result,
    });
  } catch (err) {
    console.error("Error Approving the request:", err);

    if (err.message.includes("not found")) {
      return res.status(404).json({
        message: err.message,
        status: false,
      });
    }

    res.status(500).json({
      message: "Internal server error",
      status: false,
      error: err.message,
    });
  }
};


exports.rejectRequestEp = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log("Request URL:", fullUrl);
  try {
    const { reqId, reason } = req.body;
    const adminId = req.user.userId;

    console.log(' reqId, reason', reqId, reason, adminId)

    // Validate required fields
    if (!reqId || !reason) {
      return res.status(400).json({
        message: "reqId, reason are required",
        status: false,
      });
    }

    const result = await financeDao.updateRejectReasonDao(
      reqId, reason, adminId
    );

    if (result.affectedRows > 0) {
      rejectRequestResult = await financeDao.rejectRequestDao(
        reqId
      );
    }

    res.status(200).json({
      message: "Request Approved Successfully",
      status: true,
      data: rejectRequestResult,
    });
  } catch (err) {
    console.error("Error Approving the request:", err);

    if (err.message.includes("not found")) {
      return res.status(404).json({
        message: err.message,
        status: false,
      });
    }

    res.status(500).json({
      message: "Internal server error",
      status: false,
      error: err.message,
    });
  }
};


exports.approveInvenstmentRequest = async (req, res) => {
  try {
    const { reqId } = req.body;

    if (!reqId) {
      return res.status(400).json({
        message: "reqId is required",
        status: false,
      });
    }

    const results = await financeDao.ApproveRequestDao(reqId);
    if (results.affectedRows !== 0) {
      res.status(200).json({
        status: true,
        message: 'Request approved',
      });
    } else {
      res.status(400).json({
        status: false,
        message: 'Request approved faild',
      })
    }
  } catch (error) {
    console.error('Error in GetAllApprovedInvestmentRequests:', error);
    res.status(500).json({
      status: false,
      message: 'Request approved faild',
      error: 'Internal server error',
    });
  }
};


exports.getSalesAgentForFilter = async (req, res) => {
  try {

    const results = await financeDao.getSalesAgentForFilterDao();

    res.status(200).json({
      data: results,
    });
  } catch (error) {
    console.error('Error in GetAllApprovedInvestmentRequests:', error);
    res.status(500).json({
      count: 0,
      data: [],
      error: 'Internal server error',
    });
  }
}


exports.getAgentCommitions = async (req, res) => {
  try {
    const data = await getAgentCommitionsShema.validateAsync(req.body);
    const results = await financeDao.getAgentCommitionsDao(data);

    res.status(200).json({
      data: results,
    });
  } catch (error) {
    console.error('Error in GetAllApprovedInvestmentRequests:', error);
    res.status(500).json({
      data: [],
      error: 'Internal server error',
    });
  }
}

exports.getAllPensionRequests = async (req, res) => {
  try {
    const { status, search } = req.query;

    console.log('Fetching all pension requests with filters:', { status, search });

    const filters = {};

    if (status) {
      filters.status = status;
    }

    if (search) {
      filters.search = search;
    }

    const results = await financeDao.GetAllPensionRequestsDAO(filters);

    console.log(`Retrieved ${results.length} pension request records`);

    res.json({
      count: results.length,
      data: results
    });
  } catch (err) {
    console.error('Error fetching pension requests:', err);
    res.status(500).json({
      error: 'An error occurred while fetching pension requests'
    });
  }
};

exports.getPensionRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Fetching pension request by ID:', id);

    const result = await financeDao.GetPensionRequestByIdDAO(id);

    if (!result) {
      return res.status(404).json({
        status: false,
        message: 'Pension request not found'
      });
    }

    console.log('Retrieved pension request:', result.Request_ID);

    res.json({
      status: true,
      message: 'Pension request retrieved successfully',
      data: result
    });
  } catch (err) {
    console.error('Error fetching pension request:', err);
    res.status(500).json({
      status: false,
      error: 'An error occurred while fetching pension request'
    });
  }
};

exports.updatePensionRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { reqStatus, approvedBy } = req.body; // Get approvedBy from request body

    console.log('Updating pension request status:', { id, reqStatus, approvedBy });

    if (!reqStatus) {
      return res.status(400).json({
        status: false,
        message: 'Status is required'
      });
    }

    // Validate status
    const validStatuses = ['To Review', 'Approved', 'Rejected'];
    if (!validStatuses.includes(reqStatus)) {
      return res.status(400).json({
        status: false,
        message: 'Invalid status value'
      });
    }

    if (!approvedBy) {
      return res.status(400).json({
        status: false,
        message: 'Approver ID is required'
      });
    }

    const updateData = {
      reqStatus,
      approvedBy: approvedBy, // Use the approvedBy from request body
      approveTime: new Date()
    };

    const result = await financeDao.UpdatePensionRequestStatusDAO(id, updateData);

    if (!result) {
      return res.status(404).json({
        status: false,
        message: 'Pension request not found or update failed'
      });
    }

    console.log('Pension request status updated successfully:', id);

    res.json({
      status: true,
      message: 'Pension request status updated successfully',
      data: result
    });
  } catch (err) {
    console.error('Error updating pension request status:', err);
    res.status(500).json({
      status: false,
      error: 'An error occurred while updating pension request status'
    });
  }
};

exports.getCultivationForPension = async (req, res) => {
  try {
    const { id } = await IdParamShema.validateAsync(req.params);
    console.log('Fetching pension request by ID:', id);

    const result = await financeDao.getCultivationForPensionDao(id);

    if (!result) {
      return res.status(404).json({
        status: false,
        message: 'Pension cultivation not found'
      });
    }

    res.json({
      status: true,
      message: 'Pension cultivation retrieved successfully',
      data: result
    });
  } catch (err) {
    console.error('Error fetching pension cultivation:', err);
    res.status(500).json({
      status: false,
      error: 'An error occurred while fetching pension cultivation'
    });
  }
};

exports.getFarmerPensionDetails = async (req, res) => {
  try {
    const { page, limit, searchText } = req.query;

    const result = await financeDao.getFarmerPensionDetailsDao(
      page || 1,
      limit || 10,
      searchText
    );

    res.status(200).json({
      items: result.items,
      total: result.total,
    });
  } catch (error) {
    console.error("Error getting farmer pension under 5 years details:", error);
    res.status(500).json({
      status: false,
      message: "Failed to get farmer pension details",
      error: error.message,
    });
  }
};