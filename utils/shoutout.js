// utils/shoutout.js
const axios = require("axios");

const SHOUTOUT_API_URL = "https://api.getshoutout.com/coreservice/messages";

// Returns E.164 (+94XXXXXXXXX) or null
const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return null;

  let cleaned = phoneNumber.toString().trim().replace(/\D/g, "");
  if (cleaned.length < 9) return null;

  if (cleaned.startsWith("00")) cleaned = cleaned.substring(2);

  if (cleaned.startsWith("940")) cleaned = "94" + cleaned.substring(3);
  else if (cleaned.startsWith("0")) cleaned = "94" + cleaned.substring(1);
  else if (!cleaned.startsWith("94") && cleaned.length === 9) cleaned = "94" + cleaned;

  cleaned = "+" + cleaned;
  if (cleaned.length < 11 || cleaned.length > 16) return null;

  return cleaned;
};

// Combines phoneCode + phoneNumber (same logic as the cron job)
const buildFormattedPhone = (phoneCode, phoneNumber) => {
  const raw = (phoneNumber || "").toString().trim();
  const code = (phoneCode || "").toString().trim();
  let full = raw;
  if (code && !raw.startsWith("+") && !raw.startsWith("94")) full = code + raw;
  return formatPhoneNumber(full);
};

const sendSMS = async (formattedNumber, message) => {
  const apiKey = (process.env.SHOUTOUT_API_KEY || "").trim();
  if (!apiKey) throw new Error("SHOUTOUT_API_KEY is not configured");

  const response = await axios.post(
    SHOUTOUT_API_URL,
    {
      source: "Polygon",
      destinations: [formattedNumber],
      content: { sms: message },
      transports: ["sms"],
    },
    {
      headers: {
        Authorization: `Apikey ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    }
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Unexpected SMS status: ${response.status}`);
  }
  return response.data;
};

module.exports = { formatPhoneNumber, buildFormattedPhone, sendSMS };