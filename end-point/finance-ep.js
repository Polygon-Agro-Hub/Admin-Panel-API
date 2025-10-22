const financeDao = require("../dao/Finance-dao");

exports.getDashboardData = async (req, res) => {
  try {
    const dashboardData = await financeDao.getAllDashboardData();

    // Calculate income change percentage and status
    const currentIncome = parseFloat(dashboardData.income.currentMonthIncome) || 0;
    const previousIncome = parseFloat(dashboardData.income.previousMonthIncome) || 0;
    
    let incomeChangePercentage = 0;
    let incomeStatus = 'stable';
    
    if (previousIncome > 0) {
      incomeChangePercentage = ((currentIncome - previousIncome) / previousIncome) * 100;
      
      if (incomeChangePercentage > 0) {
        incomeStatus = 'increased';
      } else if (incomeChangePercentage < 0) {
        incomeStatus = 'decreased';
      }
    } else if (currentIncome > 0) {
      incomeChangePercentage = 100;
      incomeStatus = 'increased';
    }

    // Create data structure up to current month only
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const fullYearData = monthNames.slice(0, currentMonth).map((monthName, index) => {
      const monthNum = index + 1;
      const existingData = dashboardData.monthlyStatistics.find(stat => {
        const statMonth = new Date(`${stat.month}-01`).getMonth() + 1;
        return statMonth === monthNum;
      });

      return {
        month: `${currentYear}-${String(monthNum).padStart(2, '0')}`,
        monthName: monthName,
        payments: existingData ? existingData.payments : 0,
        revenue: existingData ? parseFloat(existingData.revenue) : 0
      };
    });

    // Prepare area chart data arrays
    const monthlyLabels = fullYearData.map(stat => stat.monthName);
    const monthlyValues = fullYearData.map(stat => stat.revenue);

    res.json({
      status: true,
      data: {
        statistics: {
          totalUsers: dashboardData.stats.totalUsers,
          proUsers: dashboardData.stats.proUsers,
          freeUsers: dashboardData.stats.freeUsers,
          monthlyIncome: currentIncome,
          relativeIncomeValue: Math.abs(parseFloat(incomeChangePercentage.toFixed(2))),
          incomeStatus: incomeStatus
        },
        recentPayments: dashboardData.recentPayments,
        packageEnrollments: {
          free: dashboardData.enrollments.find(e => e.membership === 'Basic')?.count || 0,
          pro: dashboardData.enrollments.find(e => e.membership === 'Pro')?.count || 0
        },
        monthlyStatistics: fullYearData,
        areaChartData: {
          labels: monthlyLabels,
          values: monthlyValues
        }
      }
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return res.status(500).json({
      status: false,
      error: "An error occurred while fetching dashboard data"
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

exports.getCertificateDashboardData = async (req, res) => {
  try {
    const dashboardData = await financeDao.getAllCertificateDashboardData();

    // Calculate income change percentage and status
    const currentIncome = parseFloat(dashboardData.income.currentMonthIncome) || 0;
    const previousIncome = parseFloat(dashboardData.income.previousMonthIncome) || 0;
    
    let incomeChangePercentage = 0;
    let incomeStatus = 'stable';
    
    if (previousIncome > 0) {
      incomeChangePercentage = ((currentIncome - previousIncome) / previousIncome) * 100;
      
      if (incomeChangePercentage > 0) {
        incomeStatus = 'increased';
      } else if (incomeChangePercentage < 0) {
        incomeStatus = 'decreased';
      }
    } else if (currentIncome > 0) {
      incomeChangePercentage = 100;
      incomeStatus = 'increased';
    }

    // Create data structure up to current month only
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const fullYearData = monthNames.slice(0, currentMonth).map((monthName, index) => {
      const monthNum = index + 1;
      const existingData = dashboardData.monthlyStatistics.find(stat => {
        const statMonth = new Date(`${stat.month}-01`).getMonth() + 1;
        return statMonth === monthNum;
      });

      return {
        month: `${currentYear}-${String(monthNum).padStart(2, '0')}`,
        monthName: monthName,
        payments: existingData ? existingData.payments : 0,
        revenue: existingData ? parseFloat(existingData.revenue) : 0
      };
    });

    // Prepare area chart data arrays
    const monthlyLabels = fullYearData.map(stat => stat.monthName);
    const monthlyValues = fullYearData.map(stat => stat.revenue);

    // Prepare certificate type breakdown from certificationpayment table
    const certificateTypeBreakdown = {
      forCrop: dashboardData.certificateTypes.find(c => c.payType === 'Crop')?.count || 0,
      forFarm: dashboardData.certificateTypes.find(c => c.payType === 'Farm')?.count || 0,
      forFarmCluster: dashboardData.certificateTypes.find(c => c.payType === 'Cluster')?.count || 0
    };

    // Format recent payments with validity period
    const formattedRecentPayments = dashboardData.recentPayments.map(payment => ({
      transactionId: payment.transactionId,
      farmerName: payment.farmerName,
      validityPeriod: payment.validityMonths > 0 
        ? `${payment.validityMonths} month${payment.validityMonths !== 1 ? 's' : ''}` 
        : 'Expired',
      amount: payment.amount,
      dateTime: payment.dateTime
    }));

    res.json({
      status: true,
      data: {
        statistics: {
          totalCertificates: dashboardData.stats.totalCertificates,
          activeEnrollments: dashboardData.stats.activeEnrollments,
          expiredEnrollments: dashboardData.stats.expiredEnrollments,
          monthlyIncome: currentIncome,
          relativeIncomeValue: Math.abs(parseFloat(incomeChangePercentage.toFixed(2))),
          incomeStatus: incomeStatus
        },
        recentPayments: formattedRecentPayments,
        enrollmentBreakdown: certificateTypeBreakdown,
        monthlyStatistics: fullYearData,
        areaChartData: {
          labels: monthlyLabels,
          values: monthlyValues
        }
      }
    });
  } catch (error) {
    console.error("Error fetching certificate dashboard data:", error);
    return res.status(500).json({
      status: false,
      error: "An error occurred while fetching certificate dashboard data"
    });
  }
};