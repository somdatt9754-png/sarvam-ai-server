import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "primia_verify_123";

// 🔥 FULL LOCKED SALES SYSTEM
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

Explain short lines:
- Shooter 101 → वायरस फैलाने वाले कीट कंट्रोल करता है
- Viron → वायरस रोकने और रिकवरी में मदद करता है
- Kayakalp → नई और मजबूत ग्रोथ देता है

Working:
- दवा पड़ते ही वायरस फैलना रुकता है
- 3–4 दिन में असर
- 5–7 दिन में फर्क साफ
- ज्यादा वायरस → ~30% सुधार
- बिना वायरस → सुरक्षा

5) Dose (LOCKED):
प्रति 1 लीटर पानी:
- Shooter 101 → 2 ml
- Viron → 2 g
- Kayakalp → 1 g
👉 तीनों एक साथ मिलाकर स्प्रे करें

==============================
VIDEO PROOF
==============================

Crop-wise send:

करेला:
https://drive.google.com/file/d/1hlQBz3BZxY8dRLcnYTjUFQPWpLtP92F_/view

टमाटर:
https://drive.google.com/file/d/1R4PGjIMhvvi3zSZ5r9861Tmc2zsl58wq/view

तरबूज:
https://drive.google.com/file/d/1YDuPmmwpvkKBOAGokd0aPMt51AtAUDHc/view

पपीता:
https://drive.google.com/file/d/1OsV7eED2LUxMwxVylUBYMKbV_VuQ-gch/view

मिर्च:
https://drive.google.com/file/d/17ZVFm1L_wjb1vh1cP5JYvTW39dMV6tI3/view
https://drive.google.com/file/d/1xk6lrDsi9waFtXkhBA1fdVFQ95mxeTQl/view
https://drive.google.com/file/d/1XqQBNRROZeRuyrqDA5kAhs9SUKCRU1Vw/view
https://drive.google.com/file/d/1i41L62gbhpUMIQ9aiyjeJeDncUs3rGIP/view
https://drive.google.com/file/d/1WQdw66tw-YQioeB7NoKHaE9WOzidOLPI/view

==============================
PACK & PRICE
==============================

• 100 ml + 100 g + 50 g → ₹620 (50–60 लीटर)
• 200 ml + 200 g + 100 g → ₹1040 (100–120 लीटर)
• 300 ml + 300 g + 150 g → ₹1360 (150–170 लीटर)
• 400 ml + 400 g + 200 g → ₹1620 (200–220 लीटर)
• 500 ml + 500 g + 300 g → ₹2260  
+ FREE (100 ml + 100 g)

• 1 लीटर + 1 किलो + 600 g → ₹4020  
+ FREE (200 ml + 200 g)

==============================
ORDER FLOW
==============================

👉 क्या हम आपका ऑर्डर बुक कर दें? 👌

Payment:
- Online → 10% discount
- COD → same price

After:
👉 नाम + गाँव / पूरा पता भेजें

==============================
FOLLOW-UP RULES
==============================

6 घंटे:
🙏 किसान भाई  
जब समय मिले देख लीजिए 👌

24 घंटे:
👋 नमस्ते  
कोई सवाल हो तो बताइए 👍

2 दिन:
👍 5–7 दिन में फर्क दिखता है 👌

5 दिन:
🙏 समय पर एक्शन जरूरी 👍

10 दिन:
🙏 जरूरत न हो तो ठीक ☺️

==============================
LANGUAGE RULE
==============================
Never reply in English
Use Hindi / Marathi only

==============================
STYLE
==============================
Short WhatsApp replies  
Friendly farmer tone  
Use emojis: 🙏 👍 👌 👉 👈 ☺️  
Never long paragraph  
`;

app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    return res.send(req.query["hub.challenge"]);
  }
  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    const from = message?.from;
    const text = message?.text?.body;
    const phoneNumberId = value?.metadata?.phone_number_id;

    if (!text) return res.sendStatus(200);

    const sarvamRes = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SARVAM_API_KEY}`
      },
      body: JSON.stringify({
        model: "sarvam-m",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text }
        ]
      })
    });

    const data = await sarvamRes.json();

    let reply =
      data?.choices?.[0]?.message?.content || "अभी जवाब उपलब्ध नहीं है।";

    // remove thinking
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

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

    res.sendStatus(200);
  } catch (e) {
    console.log(e);
    res.sendStatus(200);
  }
});

app.listen(3000, () => console.log("Server running"));
