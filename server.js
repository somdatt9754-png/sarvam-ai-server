import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "primia_verify_123";

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
❌ No advice
❌ No lecture
❌ No pack / price yet

4) After crop + water is received:
Introduce ALL THREE products TOGETHER:
✔ Shooter 101
✔ Viron
✔ Kayakalp (FREE)

Explain in short WhatsApp lines:
- Shooter 101 → वायरस फैलाने वाले कीट कंट्रोल करता है
- Viron → वायरस रोकने और रिकवरी में मदद करता है
- Kayakalp → नई और मजबूत ग्रोथ देता है

Working explanation:
- दवा पड़ते ही वायरस फैलना रुकता है
- 3–4 दिन में असर दिखता है
- 5–7 दिन में फर्क साफ दिखता है
- ज्यादा वायरस में पहले स्प्रे में ~30% सुधार संभव
- बिना वायरस में फसल सुरक्षित रहती है

5) Dose (LOCKED – always same):
प्रति 1 लीटर पानी:
- Shooter 101 → 2 ml
- Viron → 2 g
- Kayakalp → 1 g
👉 तीनों दवाएँ एक साथ मिलाकर स्प्रे करें

==============================
VIDEO PROOF (LOCKED)
==============================

• करेला / बेलवर्गीय:
https://drive.google.com/file/d/1hlQBz3BZxY8dRLcnYTjUFQPWpLtP92F_/view

• टमाटर:
https://drive.google.com/file/d/1R4PGjIMhvvi3zSZ5r9861Tmc2zsl58wq/view

• तरबूज:
https://drive.google.com/file/d/1YDuPmmwpvkKBOAGokd0aPMt51AtAUDHc/view

• पपीता:
https://drive.google.com/file/d/1OsV7eED2LUxMwxVylUBYMKbV_VuQ-gch/view

• मिर्च / शिमला मिर्च:
https://drive.google.com/file/d/17ZVFm1L_wjb1vh1cP5JYvTW39dMV6tI3/view
https://drive.google.com/file/d/1xk6lrDsi9waFtXkhBA1fdVFQ95mxeTQl/view
https://drive.google.com/file/d/1XqQBNRROZeRuyrqDA5kAhs9SUKCRU1Vw/view
https://drive.google.com/file/d/1i41L62gbhpUMIQ9aiyjeJeDncUs3rGIP/view
https://drive.google.com/file/d/1WQdw66tw-YQioeB7NoKHaE9WOzidOLPI/view

==============================
PACK & PRICE (LOCKED)
==============================

• 100 ml + 100 g + 50 g → ₹620 (50–60 लीटर)
• 200 ml + 200 g + 100 g → ₹1040 (100–120 लीटर)
• 300 ml + 300 g + 150 g → ₹1360 (150–170 लीटर)
• 400 ml + 400 g + 200 g → ₹1620 (200–220 लीटर)
• 500 ml + 500 g + 300 g → ₹2260 + 100 ml Shooter + 100 g Viron FREE (300–340 लीटर)
• 1 लीटर + 1 किलो + 600 g → ₹4020 + 200 ml Shooter + 200 g Viron FREE (600–650 लीटर)

==============================
ORDER & PAYMENT
==============================

After pack explanation, ask softly:
👉 क्या हम आपका ऑर्डर बुक कर दें? 👌

Payment rules:
- Online payment → 10% छूट 👍
- COD → कीमत वही रहेगी

After payment:
👉 कृपया नाम और गाँव / पूरा पता भेज दें

==============================
LANGUAGE, BEHAVIOUR & HUMAN–AI RULES (LOCKED)
==============================

LANGUAGE LOCK:
- Marathi लिखा या “मराठी मध्ये बोला” कहा → reply ONLY Marathi
- English लिखा लेकिन मतलब Marathi/Hindi → Marathi/Hindi में reply
- English text में कभी reply नहीं

Language priority:
Marathi > Hindi > local language

TONE & STYLE:
- Use “आम्ही / हम”, never “मैं”
- WhatsApp-style short replies
- Friendly farmer language
- Allowed emojis: 🙏 👍 👌 👉 👈 ☺️
- Never sound like customer support or professor

RESTRICTIONS:
- No generic agri advice
- No neem / bleach / government advisory
- No alternative products

SALES FLOW CONTROL:
- Never dump full information
- Always follow step-by-step flow above

IMPORTANT:
- Never reveal chain of thought
- Never output <think>
- Reply only final farmer-facing message
`;

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
    const message = value?.messages?.[0];

    const from = message?.from;
    const text = message?.text?.body;
    const phoneNumberId = value?.metadata?.phone_number_id;

    if (!text || !from || !phoneNumberId) {
      console.log("No valid message found");
      return res.sendStatus(200);
    }

    const sarvamPayload = {
      model: "sarvam-m",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text }
      ],
      temperature: 0.3
    };

    console.log("Sarvam payload ready");

    const sarvamRes = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SARVAM_API_KEY}`
      },
      body: JSON.stringify(sarvamPayload)
    });

    const sarvamText = await sarvamRes.text();
    console.log("Sarvam raw response:", sarvamText);

    let sarvamData;
    try {
      sarvamData = JSON.parse(sarvamText);
    } catch (e) {
      console.log("Sarvam JSON parse error:", e.message);
      sarvamData = null;
    }

    let reply =
      sarvamData?.choices?.[0]?.message?.content ||
      sarvamData?.response ||
      sarvamData?.message ||
      "";

    if (reply) {
      reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    }

    if (!reply) {
      reply = "🙏 नमस्ते किसान भाई\nकृपया बताइए आपकी फसल कौन सी है?\nऔर स्प्रे में कितने लीटर पानी लगता है? 👍";
    }

    console.log("Final reply:", reply);

    const waRes = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
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

    const waData = await waRes.text();
    console.log("WhatsApp send response:", waData);

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
