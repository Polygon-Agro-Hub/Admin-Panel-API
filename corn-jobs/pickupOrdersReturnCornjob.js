// cronJobs.js
const cron = require('node-cron');
const { collectionofficer } = require('../startup/database');
const axios = require('axios');

const SHOUTOUT_API_KEY = process.env.SHOUTOUT_API_KEY;
const SHOUTOUT_API_URL = 'https://api.getshoutout.com/coreservice/messages';

/**
 * Schedule all cron jobs
 */
const pickupOrdersReturnCornjob = () => {
  console.log('⏰ Initializing cron jobs...');

  // ✅ CRON JOB: Enable marketplace items every day at 9:30 PM
  cron.schedule('00 16 * * *', async () => {
    console.log('🔄 Running scheduled job: Enabling marketplace items...');
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

        if (result.successCount > 0) {
          console.log(`📱 Sending SMS notifications for ${result.successCount} orders...`);
          try {
            const smsResult = await sendBulkSMSNotification(orders);
            console.log(`✅ SMS notifications sent: ${smsResult.successCount} succeeded, ${smsResult.failedCount} failed`);
          } catch (smsError) {
            console.error('⚠️ SMS notifications failed but orders were processed:', smsError.message);
          }
        }
      } else {
        console.log('ℹ️ No orders found to process');
      }

    } catch (error) {
      console.error('❌ Error executing cron job:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Colombo"
  });

  console.log('✅ All cron jobs scheduled successfully');
  console.log('📅 Marketplace items enable job: 9:30 PM daily');
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
        DATE(o.sheduleDate) AS sheduleDate,
        o.total,
        mu.phoneCode,
        mu.phoneNumber,
        mu.creditBalance,
        CASE 
          WHEN o.total < 2000 THEN 150
          WHEN o.total >= 2000 AND o.total < 4000 THEN 250
          WHEN o.total >= 4000 THEN 350
        END AS handleFee
      FROM processorders p
      LEFT JOIN orders o ON p.orderId = o.id
      LEFT JOIN marketplaceusers mu ON o.userId = mu.id
      WHERE p.status = 'Ready to Pickup' AND o.sheduleDate <= CURDATE()
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
        const [result1] = await connection.query(
          `INSERT INTO collection_officer.orderhandlingfee(orderId, fee) VALUES (?, ?)`,
          [order.id, order.handleFee]
        );
        console.log(`✅ Handling fee inserted for order ID: ${order.id}`);

        let newCrdBalance = order.creditBalance - order.handleFee;

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
      console.error('❌ Error during rollback:', rollbackError.message);
    }

    console.error('❌ Transaction failed:', error.message);
    throw error;
  } finally {
    connection.release();
    console.log('🔌 Connection released');
  }
};

// Helper function to format phone number (from your working code)
function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) {
    return null;
  }

  // Convert to string if it's a number
  phoneNumber = phoneNumber.toString();

  // Remove all non-digits
  let cleaned = phoneNumber.replace(/\D/g, "");

  if (cleaned.length < 9) {
    return null;
  }

  if (cleaned.startsWith("0")) {
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

  // Final validation
  if (cleaned.length < 12 || cleaned.length > 15) {
    return null;
  }

  return cleaned;
}

/**
 * Send bulk SMS notification to all customers whose orders were processed
 * Using the working SMS format from your existing code
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

    const apiKey = process.env.SMS_API_KEY || process.env.SHOUTOUT_API_KEY;
    const senderId = process.env.SMS_SENDER_ID || "PolygonAgro";

    // Prepare headers (matching your working code)
    const headers = {
      Authorization: `Apikey ${apiKey}`,
      "Content-Type": "application/json",
    };

    for (const order of orders) {
      try {
        // Format phone number using your working formatter
        let phoneNumber = order.phoneNumber;
        if (order.phoneCode) {
          phoneNumber = order.phoneCode + order.phoneNumber;
        }
        
        const formattedNumber = formatPhoneNumber(phoneNumber);
        
        if (!formattedNumber) {
          throw new Error(`Invalid phone number: ${phoneNumber}`);
        }

        // Prepare message (matching your working code format)
const message = `Your order ${order.invNo} has been marked as return.
Reason: "Customer did not picked up the order during the day."`;

        // Prepare request data (matching your working code)
        const requestData = {
          source: senderId,
          destinations: [formattedNumber],
          content: { sms: message },
          transports: ["sms"],
        };

        console.log(`📤 Sending SMS to ${formattedNumber} for order #${order.invNo}`);

        // Send SMS via ShoutOut API (using your working endpoint)
        const response = await axios.post(
          "https://api.getshoutout.com/coreservice/messages",
          requestData,
          { headers, timeout: 5000 }
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
          
          // Check for common API errors
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

module.exports = { pickupOrdersReturnCornjob };