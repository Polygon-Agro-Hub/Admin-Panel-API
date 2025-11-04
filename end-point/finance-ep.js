const financeDao = require("../dao/Finance-dao");
const {
  createAgentCommissionSchema,
  updateAgentCommissionSchema,
  getAllSchema,
  idSchema,
  getAllFarmerPaymentsSchema,
} = require("../validations/finance-validation");

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

    // Format recent payments with validity period
    const formattedRecentPayments = dashboardData.recentPayments.map(
      (payment) => ({
        transactionId: payment.transactionId,
        farmerName: payment.farmerName,
        validityPeriod:
          payment.validityMonths > 0
            ? `${payment.validityMonths} month${payment.validityMonths !== 1 ? "s" : ""
            }`
            : "Expired",
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
          relativeIncomeValue: Math.abs(
            parseFloat(incomeChangePercentage.toFixed(2))
          ),
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
    const search = req.query.search || '';
    const fromDate = req.query.fromDate || '';
    const toDate = req.query.toDate || '';

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
    const search = req.query.search || '';
    const fromDate = req.query.fromDate || '';
    const toDate = req.query.toDate || '';

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
    const minRange = value.minRange !== undefined ? value.minRange : existingCommission.minRange;
    const maxRange = value.maxRange !== undefined ? value.maxRange : existingCommission.maxRange;

    const rangeOverlap = await financeDao.checkRangeOverlap(minRange, maxRange, id);
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

    const updatedCommission = await financeDao.updateAgentCommission(id, updateData);

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
    const result = await financeDao.getAllFarmerPaymentDao(value.date, value.bank);
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
