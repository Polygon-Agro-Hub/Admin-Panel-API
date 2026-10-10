// cronJobs.js
const cron = require('node-cron');
const { collectionofficer } = require('../startup/database');
const axios = require('axios');

const SHOUTOUT_API_URL = 'https://api.getshoutout.com/coreservice/messages';

/**
 * Schedule all cron jobs
 */
const pickupOrdersReturnCornjob = () => {
  console.log('⏰ Initializing cron jobs...');

  // ✅ CRON JOB: Process pickup return orders every day at 9:30 PM
  cron.schedule('00 16 * * *', async () => {
    await processPickupOrdersReturn();
  }, {
    scheduled: true,
    timezone: "Asia/Colombo"
  });

  console.log('✅ All cron jobs scheduled successfully');
  console.log('📅 Pickup return orders job: 9:30 PM daily (16:00 UTC)');
};

// ----------------------------------------------------- DAO functions -------------------------------------------------
const getReadyToPickupOrders = async () => {
  try {
    const [orders] = await collectionofficer.promise().query(
      `
      SELECT 
        p.id,
        p.status,
        p.invNo,
        p.paymentMethod,
        p.amount,
        p.moneyPaid,
        p.creditPaid,
        p.isPaid,
        DATE(p.sheduleDate) AS sheduleDate,
        p.total,
        mu.phoneCode,
        mu.phoneNumber,
        mu.creditBalance,
        CASE 
          WHEN COALESCE(p.total, 0) < 2000 THEN 150
          WHEN p.total >= 2000 AND p.total < 4000 THEN 250
          WHEN p.total >= 4000 THEN 350
          ELSE 150
        END AS handleFee
      FROM processorders p
      LEFT JOIN orders o ON p.orderId = o.id
      LEFT JOIN marketplaceusers mu ON o.userId = mu.id
      WHERE p.status = 'Ready to Pickup' AND DATE(p.sheduleDate) <= CURDATE()
      `
    );
    return orders;
  } catch (error) {
    console.error('❌ Error fetching ready to pickup orders:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
};

const insertHandlingFee = async (orders) => {
  const connection = await collectionofficer.promise().getConnection();
  let successCount = 0;
  let failedCount = 0;
  const failedOrders = [];

  try {
    await connection.beginTransaction();
    console.log('🔄 Transaction started for handling fee insertion and status update');

    for (const order of orders) {
      try {
        const handleFee = Number(order.handleFee) || 0;
        const [result1] = await connection.query(
          `INSERT INTO collection_officer.orderhandlingfee(orderId, fee) VALUES (?, ?)`,
          [order.id, handleFee]
        );
        console.log(`✅ Handling fee inserted for order ID: ${order.id}`);

        const currentCreditBalance = Number(order.creditBalance) || 0;
        let newCrdBalance = currentCreditBalance - handleFee;

        const [result2] = await connection.query(
          `UPDATE processorders p
           LEFT JOIN orders o ON p.orderId = o.id
           LEFT JOIN marketplaceusers mu ON o.userId = mu.id
           SET 
            p.status = 'Return Received',
            mu.creditBalance = ?
           WHERE p.id = ?`,
          [newCrdBalance, order.id]
        );

        if (result2.affectedRows === 0) {
          throw new Error(`Order ${order.id} not found or status already updated`);
        }

        let result3 = await orderNotification(connection, order.id, order.invNo);

        successCount++;
        console.log(`✅ Order ${order.id} status updated to 'Return Received' (${successCount}/${orders.length})`);

      } catch (error) {
        failedCount++;
        failedOrders.push({
          orderId: order.id,
          error: error.message
        });
        console.error(`❌ Error processing order ID ${order.id}:`, error.message);

        await connection.rollback();
        console.log('🔄 Transaction rolled back due to error');
        throw new Error(`Failed to process order ${order.id}: ${error.message}`);
      }
    }

    await connection.commit();
    console.log(`✅ Transaction committed successfully. Processed ${successCount} orders`);

    return {
      success: true,
      successCount,
      failedCount,
      failedOrders
    };

  } catch (error) {
    try {
      await connection.rollback();
      console.log('🔄 Transaction rolled back due to error');
    } catch (rollbackError) {
      // ignore rollback error if already rolled back
    }

    console.error('❌ Transaction failed:', error.message);
    throw error;
  } finally {
    connection.release();
    console.log('🔌 Connection released');
  }
};

// Helper function to format phone number to E.164 (+94XXXXXXXXX)
function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) {
    return null;
  }

  // Convert to string and trim
  phoneNumber = phoneNumber.toString().trim();

  // Remove all non-digits
  let cleaned = phoneNumber.replace(/\D/g, "");

  if (cleaned.length < 9) {
    return null;
  }

  // Handle 00 prefix (international exit code, e.g. 0094...)
  if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
  }

  // If number starts with 940 (e.g. 94 + 0771234567)
  if (cleaned.startsWith("940")) {
    cleaned = "94" + cleaned.substring(3);
  } else if (cleaned.startsWith("0")) {
    cleaned = "94" + cleaned.substring(1);
  } else if (cleaned.startsWith("94")) {
    // Already has country code
  } else if (cleaned.length === 9) {
    cleaned = "94" + cleaned;
  }

  // Add + prefix if not present
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }

  // Final validation (E.164: + followed by 10 to 15 digits)
  if (cleaned.length < 11 || cleaned.length > 16) {
    return null;
  }

  return cleaned;
}

/**
 * Send bulk SMS notification to all customers whose orders were processed
 */
const sendBulkSMSNotification = async (orders) => {
  console.log(`📱 Preparing to send SMS notifications to ${orders.length} customers`);

  if (!orders || orders.length === 0) {
    console.log('ℹ️ No orders to send SMS notifications for');
    return { success: true, message: 'No orders to notify' };
  }

  try {
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    const apiKey = (process.env.SHOUTOUT_API_KEY).trim();
    const senderId = ("Polygon").trim();

    if (!apiKey) {
      console.error('❌ SHOUTOUT_API_KEY  is not configured in environment variables');
      return {
        success: false,
        error: 'SMS API key is not configured in environment variables',
        total: orders.length,
        successCount: 0,
        failedCount: orders.length
      };
    }

    const headers = {
      Authorization: `Apikey ${apiKey}`,
      "Content-Type": "application/json",
    };

    for (const order of orders) {
      try {
        let rawPhone = (order.phoneNumber || "").toString().trim();
        let phoneCode = (order.phoneCode || "").toString().trim();

        let phoneNumber = rawPhone;
        if (phoneCode && !rawPhone.startsWith("+") && !rawPhone.startsWith("94")) {
          phoneNumber = phoneCode + rawPhone;
        }

        const formattedNumber = formatPhoneNumber(phoneNumber);

        if (!formattedNumber) {
          throw new Error(`Invalid phone number: ${phoneNumber} (raw: ${rawPhone}, code: ${phoneCode})`);
        }

        const message = `Your order ${order.invNo} has been marked as return.
Reason: "Customer did not picked up the order during the day."`;

        const requestData = {
          source: senderId,
          destinations: [formattedNumber],
          content: { sms: message },
          transports: ["sms"],
        };

        console.log(`📤 Sending SMS to ${formattedNumber} for order #${order.invNo}`);

        const response = await axios.post(
          SHOUTOUT_API_URL,
          requestData,
          { headers, timeout: 10000 }
        );

        console.log('📨 Response:', JSON.stringify(response.data, null, 2));

        if (response.status >= 200 && response.status < 300) {
          successCount++;
          console.log(`✅ SMS sent successfully to ${formattedNumber} for order #${order.invNo}`);
          results.push({
            orderId: order.id,
            phoneNumber: formattedNumber,
            success: true,
            response: response.data
          });
        } else {
          failedCount++;
          console.error(`❌ Failed to send SMS to ${formattedNumber} for order #${order.invNo}`);
          results.push({
            orderId: order.id,
            phoneNumber: formattedNumber,
            success: false,
            error: `Unexpected status: ${response.status}`
          });
        }

      } catch (error) {
        failedCount++;
        console.error(`❌ Error sending SMS to ${order.phoneNumber}:`, error.message);

        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', JSON.stringify(error.response.data, null, 2));

          if (error.response.status === 401) {
            console.error('AUTHENTICATION ERROR: Check your API key');
          } else if (error.response.status === 400) {
            console.error('BAD REQUEST: Check your request format');
          } else if (error.response.status === 429) {
            console.error('RATE LIMIT EXCEEDED: Too many requests');
          }
        }

        results.push({
          orderId: order.id,
          phoneNumber: order.phoneNumber,
          success: false,
          error: error.message,
          responseData: error.response?.data
        });
      }
    }

    console.log(`📱 SMS notifications summary:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);

    return {
      success: true,
      total: orders.length,
      successCount,
      failedCount,
      results
    };

  } catch (error) {
    console.error('❌ Error sending bulk SMS notifications:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
};

const processPickupOrdersReturn = async () => {
  console.log('🔄 Running scheduled job: Processing pickup orders return...');
  console.log(`⏰ Time: ${new Date().toLocaleString()}`);

  try {
    const orders = await getReadyToPickupOrders();

    if (orders && orders.length > 0) {
      console.log(`📊 Found ${orders.length} orders to process`);
      const result = await insertHandlingFee(orders);
      console.log(`✅ Successfully processed ${result.successCount} orders`);

      if (result.failedCount > 0) {
        console.log(`⚠️ Failed to process ${result.failedCount} orders`);
        console.log('❌ Failed orders:', result.failedOrders);
      }

      let smsResult = null;
      if (result.successCount > 0) {
        console.log(`📱 Sending SMS notifications for ${result.successCount} orders...`);
        try {
          smsResult = await sendBulkSMSNotification(orders);
          console.log(`✅ SMS notifications sent: ${smsResult.successCount} succeeded, ${smsResult.failedCount} failed`);
        } catch (smsError) {
          console.error('⚠️ SMS notifications failed but orders were processed:', smsError.message);
          smsResult = { success: false, error: smsError.message };
        }
      }

      return {
        success: true,
        ordersCount: orders.length,
        processedCount: result.successCount,
        failedCount: result.failedCount,
        failedOrders: result.failedOrders,
        smsResult
      };
    } else {
      console.log('ℹ️ No orders found to process');
      return {
        success: true,
        ordersCount: 0,
        message: 'No ready to pickup orders found for return processing today'
      };
    }

  } catch (error) {
    console.error('❌ Error executing cron job:', error.message);
    console.error('Stack trace:', error.stack);
    return {
      success: false,
      error: error.message
    };
  }
};

const orderNotification = async (conn, orderId, invNo) => {
  try {
    const [result] =
    await conn.query(
      `INSERT INTO ordernotfication (orderId, Title, message)
       VALUES (?, 'Order Returned', ?)`,
      [
        orderId,
        `Your order #${invNo} has been marked as returned. Reason: "Customer did not pick up the order during the day."`
      ]
    );
    console.log(`✅ Order notification inserted for order ID: ${orderId}`, result);
    return true;
  } catch (err) {
    console.error("Error inserting order notification:", err);
    return false;
    // or: throw err;  // if you want the caller to handle it
  }
};

module.exports = { pickupOrdersReturnCornjob, processPickupOrdersReturn };