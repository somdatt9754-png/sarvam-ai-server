import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "primia_verify_123";

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  } else {
    console.log("❌ Verification failed");
    return res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  try {
    console.log("Incoming JSON:", JSON.stringify(req.body, null, 2));

    const value = req.body?.entry?.[0]?.changes?.[0]?.value;

    // status updates ignore
    if (value?.statuses) {
      return res.sendStatus(200);
    }

    const message = value?.messages?.[0];
    const from = message?.from;
    const text = message?.text?.body;
    const phoneNumberId = value?.metadata?.phone_number_id;

    // only text messages process
    if (!message || message.type !== "text" || !from || !text || !phoneNumberId) {
      return res.sendStatus(200);
    }

    // ignore messages sent by your own business number if echoed back
    if (message?.from === value?.metadata?.display_phone_number) {
      return res.sendStatus(200);
    }

    const sarvamPayload = {
      model: "sarvam-m",
      messages: [
        {
          role: "user",
          content: text
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
    console.log("Sarvam Response:", JSON.stringify(sarvamData, null, 2));

    const sarvamReply =
      sarvamData?.choices?.[0]?.message?.content?.trim() ||
      "अभी जवाब उपलब्ध नहीं है।";

    const waRes = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
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

    const waData = await waRes.json();
    console.log("WhatsApp send response:", JSON.stringify(waData, null, 2));

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
