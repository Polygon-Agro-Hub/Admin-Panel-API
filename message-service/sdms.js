// sdms.js
const axios = require("axios");

const SHOUTOUT_API_URL = "https://api.getshoutout.com/coreservice/messages";

// Format phone number to E.164 (+94XXXXXXXXX)
function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) return null;

  let cleaned = phoneNumber.toString().trim().replace(/\D/g, "");
  if (cleaned.length < 9) return null;

  if (cleaned.startsWith("00")) cleaned = cleaned.substring(2);

  if (cleaned.startsWith("940")) {
    cleaned = "94" + cleaned.substring(3);
  } else if (cleaned.startsWith("0")) {
    cleaned = "94" + cleaned.substring(1);
  } else if (cleaned.startsWith("94")) {
    // already has country code
  } else if (cleaned.length === 9) {
    cleaned = "94" + cleaned;
  }

  cleaned = "+" + cleaned;

  if (cleaned.length < 11 || cleaned.length > 16) return null;
  return cleaned;
}

/**
 * Send SalesDash login credentials to a sales agent via SMS
 */
const sendSalesAgentCredentialsSMS = async ({
  phoneCode,
  phoneNumber,
  firstName,
  empId,
  password,
}) => {
  try {
    const apiKey = (process.env.SHOUTOUT_API_KEY || "").trim();
    const senderId = "Polygon";

    if (!apiKey) {
      console.error("❌ SHOUTOUT_API_KEY is not configured");
      return { success: false, error: "SMS API key is not configured" };
    }

    const rawPhone = (phoneNumber || "").toString().trim();
    const code = (phoneCode || "").toString().trim();

    let fullNumber = rawPhone;
    if (code && !rawPhone.startsWith("+") && !rawPhone.startsWith("94")) {
      fullNumber = code + rawPhone;
    }

    const formattedNumber = formatPhoneNumber(fullNumber);
    if (!formattedNumber) {
      return {
        success: false,
        error: `Invalid phone number: ${fullNumber} (raw: ${rawPhone}, code: ${code})`,
      };
    }

    const message = `Dear ${firstName}, Your SalesDash login credentials are as below:
Login ID: ${empId}
Password: ${password}
You can change your password after logging in.
Thank you, Polygon Team.`;

    const requestData = {
      source: senderId,
      destinations: [formattedNumber],
      content: { sms: message },
      transports: ["sms"],
    };

    const headers = {
      Authorization: `Apikey ${apiKey}`,
      "Content-Type": "application/json",
    };

    console.log(`📤 Sending credentials SMS to ${formattedNumber} (${empId})`);

    const response = await axios.post(SHOUTOUT_API_URL, requestData, {
      headers,
      timeout: 10000,
    });

    if (response.status >= 200 && response.status < 300) {
      console.log(`✅ Credentials SMS sent to ${formattedNumber}`);
      return {
        success: true,
        phoneNumber: formattedNumber,
        response: response.data,
      };
    }

    return { success: false, error: `Unexpected status: ${response.status}` };
  } catch (error) {
    console.error("❌ Error sending credentials SMS:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error(
        "Response data:",
        JSON.stringify(error.response.data, null, 2),
      );
    }
    return {
      success: false,
      error: error.message,
      responseData: error.response?.data,
    };
  }
};

module.exports = { sendSalesAgentCredentialsSMS, formatPhoneNumber };
