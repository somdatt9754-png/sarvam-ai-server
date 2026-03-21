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
   SARVAM AI FUNCTION
========================= */

async function getAIReply(text) {
  try {
    const res = await axios.post(
      "https://api.sarvam.ai/v1/chat/completions",
      {
        messages: [
          {
            role: "system",
            content:
              "तुम एक intelligent AI assistant हो। यूज़र जिस भाषा में बात करे उसी भाषा में जवाब दो। जवाब simple, clear और natural रखो।"
          },
          {
            role: "user",
            content: text
          }
        ]
      },
      {
        headers: {
          "api-subscription-key": SARVAM_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    return res.data.choices?.[0]?.message?.content || "ठीक है";
  } catch (e) {
    console.log("Sarvam error:", e.response?.data || e.message);
    return "AI में error आ रही है, बाद में try करो";
  }
}

/* =========================
   SEND WHATSAPP MESSAGE
========================= */

async function sendWhatsAppText(to, message) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: to,
        text: { body: message }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (e) {
    console.log("WhatsApp send error:", e.response?.data || e.message);
  }
}

/* =========================
   WEBHOOK VERIFY
========================= */

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

/* =========================
   WEBHOOK RECEIVE MESSAGE
========================= */

app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const messages = changes?.value?.messages;

    if (messages && messages.length > 0) {
      const msg = messages[0];
      const from = msg.from;
      const text = msg.text?.body || "";

      console.log("User:", text);

      const aiReply = await getAIReply(text);

      console.log("AI:", aiReply);

      await sendWhatsAppText(from, aiReply);
    }

    res.sendStatus(200);
  } catch (e) {
    console.log("Webhook error:", e.response?.data || e.message);
    res.sendStatus(200);
  }
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
