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