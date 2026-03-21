const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

/* =========================
   CONFIG
========================= */
const PORT = 3000;
const VERIFY_TOKEN = "primia_verify_token";
const WHATSAPP_TOKEN = "EAAb91IITcq8BRAWFOSsMVLfu9rhnMHaUYLbNrpcmuO6lZARv7UxuP8lFZCAFjDLZCZAhx5uTeSDwIx7aUdgUBTIPAMNVJBOyjdNZAv5z0afh7nIaelLneoZCeFuqH17rOyf0hxhOtLqvi2xk7rqwAjMY4CAAxnYTHlwXhIUuQC64ZCaYssrolpB2xxUhKmDqH5uNhZAW0edCILLCwfjo9hmNcPSHJGCZAFb8EIBHieZAItcLIbEFAR5JmKfCC60ZCQLKS1Q8RuBwl7aPZBFeuZAAgrqL2HGA4GRJhEohYZBO1YZCwZDZD";
const PHONE_NUMBER_ID = "939435405927842";
const SARVAM_API_KEY = "sk_gndk50mk_utHkV8yIpWvJF9d3qujLRSHI";

/* =========================
   SARVAM AI (NEW ADD)
========================= */
async function getAIReply(text) {
  try {
    const res = await axios.post(
      "https://api.sarvam.ai/v1/chat/completions",
      {
        messages: [
          { role: "system", content: "तुम किसान सलाह देने वाले सहायक हो। सरल हिंदी में जवाब दो।" },
          { role: "user", content: text }
        ]
      },
      {
        headers: {
          "api-subscription-key": SARVAM_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    return res.data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.log("Sarvam error:", e.message);
    return null;
  }
}
