import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "primia_verify_123";

// Root test
app.get("/", (req, res) => {
  res.send("Server is running");
});

// Meta webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  } else {
    console.log("❌ Webhook verification failed");
    return res.sendStatus(403);
  }
});

// Incoming WhatsApp messages from Meta
app.post("/webhook", async (req, res) => {
  try {
    console.log("📩 Incoming webhook:", JSON.stringify(req.body, null, 2));

    const message =
      req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const userMessage = message.text?.body;

    if (!userMessage) {
      return res.sendStatus(200);
    }

    const phoneNumberId =
      req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

    const from = message.from;

    const sarvamPayload = {
      model: "sarvam-m",
      messages: [
        {
          role: "user",
          content: userMessage
        }
      ]
    };

    const sarvamRes = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SARVAM_API_KEY}`
      },
      body: JSON.stringify(sarvamPayload)
    });

    const sarvamData = await sarvamRes.json();
    console.log("Sarvam response:", sarvamData);

    const sarvamReply =
      sarvamData?.choices?.[0]?.message?.content ||
      "अभी जवाब उपलब्ध नहीं है।";

    await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: from,
        text: { body: sarvamReply }
      })
    });

    return res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    return res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
