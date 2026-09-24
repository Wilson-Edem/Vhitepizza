const axios = require("axios");
const crypto = require("crypto");
const { HttpError } = require("../../utils/errors");

const PAYSTACK_URL = "https://api.paystack.co";
const CURRENCY = "NGN";

function requireSecret() {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    throw new HttpError(
      503,
      "Paystack is not configured. Add PAYSTACK_SECRET_KEY to api/.env."
    );
  }

  return process.env.PAYSTACK_SECRET_KEY;
}

async function request(method, path, data) {
  const secret = requireSecret();

  try {
    const response = await axios({
      method,
      url: `${PAYSTACK_URL}${path}`,
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      data,
      timeout: 15000,
    });

    if (!response.data?.status) {
      throw new HttpError(
        502,
        response.data?.message || "Paystack rejected the request."
      );
    }

    return response.data.data;
  } catch (error) {
    if (error instanceof HttpError) throw error;

    const message =
      error.response?.data?.message ||
      error.message ||
      "Could not connect to Paystack.";

    throw new HttpError(502, `Paystack error: ${message}`);
  }
}

async function initializeTransaction({
  email,
  amountNaira,
  reference,
  callbackUrl,
  metadata,
}) {
  if (!email) {
    throw new HttpError(400, "A customer email is required for payment.");
  }

  const naira = Number(amountNaira);

  if (!Number.isInteger(naira) || naira <= 0) {
    throw new HttpError(400, "The order total is not a valid payment amount.");
  }

  return request("POST", "/transaction/initialize", {
    email,
    amount: String(naira * 100),
    currency: CURRENCY,
    reference,
    callback_url: callbackUrl,
    metadata: JSON.stringify(metadata || {}),
  });
}

async function verifyTransaction(reference) {
  const cleanReference = String(reference || "").trim();

  if (!cleanReference) {
    throw new HttpError(400, "Payment reference is required.");
  }

  return request(
    "GET",
    `/transaction/verify/${encodeURIComponent(cleanReference)}`
  );
}

async function createRefund({
  transaction,
  amountNaira,
  customerNote,
  merchantNote,
}) {
  const cleanTransaction = String(transaction || "").trim();

  if (!cleanTransaction) {
    throw new HttpError(400, "A Paystack transaction reference is required for a refund.");
  }

  const payload = {
    transaction: cleanTransaction,
  };

  if (amountNaira !== undefined && amountNaira !== null) {
    const naira = Number(amountNaira);

    if (!Number.isInteger(naira) || naira <= 0) {
      throw new HttpError(400, "The refund amount is not valid.");
    }

    payload.amount = String(naira * 100);
  }

  if (customerNote) payload.customer_note = String(customerNote);
  if (merchantNote) payload.merchant_note = String(merchantNote);

  return request("POST", "/refund", payload);
}

function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret || !rawBody || !signature) return false;

  const expected = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");

  const provided = String(signature).trim();

  if (provided.length !== expected.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(provided, "utf8"),
    Buffer.from(expected, "utf8")
  );
}

module.exports = {
  CURRENCY,
  initializeTransaction,
  verifyTransaction,
  createRefund,
  verifyWebhookSignature,
};
