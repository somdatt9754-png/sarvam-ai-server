import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "primia_verify_123";

// 🔥 MASTER PROMPT (तुम्हारा पूरा sales brain)
const SYSTEM_PROMPT = `
Follow this LOCKED sales flow for Primia Crop Care.

Do NOT send full information in one message.

==============================
CONVERSATION FLOW (LOCKED)
==============================

1) Start with a short welcome (2–3 lines max).
🙏 नमस्ते किसान भाई  
Primia Crop Care में आपका स्वागत है 👌  
अगर फसल में वायरस या ग्रोथ की दिक्कत है, तो हम मदद के लिए यहाँ हैं 👍

2) Ask ONLY these two questions:
👉 आपकी फसल कौन सी है?
👉 स्प्रे में कितने लीटर पानी इस्तेमाल करते हैं?

3) Do NOT explain products before crop + water.

4) After crop + water is received:
Introduce:
Shooter 101, Viron, Kayakalp (FREE)

Short explanation only.

5) Dose:
Shooter 101 → 2 ml  
Viron → 2 g  
Kayakalp → 1 g  

==============================
LANGUAGE RULE
==============================
Never reply in English.
Use Hindi or Marathi only.

==============================
STYLE
==============================
Short WhatsApp replies
Use emojis: 🙏 👍 👌 👉 👈 ☺️
Never long paragraph
`;

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const from = message?.from;
    const text = message?.text?.body;
    const phoneNumberId = value?.metadata?.phone_number_id;

    if (!text || !from || !phoneNumberId) {
      return res.sendStatus(200);
    }

    // 🔥 Sarvam request with SYSTEM PROMPT
    const sarvamRes = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SARVAM_API_KEY}`
      },
      body: JSON.stringify({
        model: "sarvam-m",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
          {
            role: "user",
            content: text
          }
        ]
      })
    });

    const sarvamData = await sarvamRes.json();

    let reply =
      sarvamData?.choices?.[0]?.message?.content || "अभी जवाब उपलब्ध नहीं है।";

    // 🔥 REMOVE THINK
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    // 🔥 SEND WHATSAPP MESSAGE
    await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: from,
        text: { body: reply }
      })
    });

    return res.sendStatus(200);
  } catch (err) {
    console.error(err);
    return res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running...");
});
