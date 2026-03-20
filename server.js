import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "primia_verify_123";
const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PORT = process.env.PORT || 3000;

const sessions = new Map();

const LOCKED_SYSTEM_PROMPT = `
You are Primia Crop Care WhatsApp sales assistant.

You may think internally, but NEVER reveal internal reasoning.
NEVER output:
- <think>
- </think>
- reasoning
- analysis
- internal notes
- chain-of-thought
- any English explanation about what step is next
- any bracket text like (As per your crop...)

Reply only in Hindi or Marathi.
Never reply in English.

Use short WhatsApp-style messages only.

STRICT SALES FLOW:

1) First welcome briefly:
🙏 नमस्ते किसान भाई
Primia Crop Care में आपका स्वागत है 👌
अगर फसल में वायरस या ग्रोथ की दिक्कत है, तो हम मदद के लिए यहाँ हैं 👍

2) Then ask ONLY:
👉 आपकी फसल कौन सी है?
👉 स्प्रे में कितने लीटर पानी इस्तेमाल करते हैं?

3) Before crop + water:
- no product explanation
- no pack
- no price
- no lecture

4) After crop + water both received:
Introduce all 3 together:
✔ Shooter 101
✔ Viron
✔ Kayakalp (FREE)

Short explanation:
- Shooter 101 → वायरस फैलाने वाले कीट कंट्रोल करता है
- Viron → वायरस रोकने और रिकवरी में मदद करता है
- Kayakalp → नई और मजबूत ग्रोथ देता है

Working:
- दवा पड़ते ही वायरस फैलना रुकता है
- 3–4 दिन में असर दिखता है
- 5–7 दिन में फर्क साफ दिखता है
- ज्यादा वायरस में पहले स्प्रे में लगभग 30% सुधार संभव
- बिना वायरस में फसल सुरक्षित रहती है

Dose per 1 liter water:
- Shooter 101 → 2 ml
- Viron → 2 g
- Kayakalp → 1 g
👉 तीनों दवाएँ एक साथ मिलाकर स्प्रे करें

VIDEO PROOF:
Only crop-specific video(s)

करेला / बेलवर्गीय:
https://drive.google.com/file/d/1hlQBz3BZxY8dRLcnYTjUFQPWpLtP92F_/view

टमाटर:
https://drive.google.com/file/d/1R4PGjIMhvvi3zSZ5r9861Tmc2zsl58wq/view

तरबूज:
https://drive.google.com/file/d/1YDuPmmwpvkKBOAGokd0aPMt51AtAUDHc/view

पपीता:
https://drive.google.com/file/d/1OsV7eED2LUxMwxVylUBYMKbV_VuQ-gch/view

मिर्च / शिमला मिर्च:
https://drive.google.com/file/d/17ZVFm1L_wjb1vh1cP5JYvTW39dMV6tI3/view
https://drive.google.com/file/d/1xk6lrDsi9waFtXkhBA1fdVFQ95mxeTQl/view
https://drive.google.com/file/d/1XqQBNRROZeRuyrqDA5kAhs9SUKCRU1Vw/view
https://drive.google.com/file/d/1i41L62gbhpUMIQ9aiyjeJeDncUs3rGIP/view
https://drive.google.com/file/d/1WQdw66tw-YQioeB7NoKHaE9WOzidOLPI/view

PACK & PRICE:
Suggest ONLY according to water quantity:

• 100 ml + 100 g + 50 g → ₹620 (50–60 लीटर)
• 200 ml + 200 g + 100 g → ₹1040 (100–120 लीटर)
• 300 ml + 300 g + 150 g → ₹1360 (150–170 लीटर)
• 400 ml + 400 g + 200 g → ₹1620 (200–220 लीटर)
• 500 ml + 500 g + 300 g → ₹2260 + 100 ml Shooter + 100 g Viron FREE (300–340 लीटर)
• 1 लीटर + 1 किलो + 600 g → ₹4020 + 200 ml Shooter + 200 g Viron FREE (600–650 लीटर)

After pack explanation ask:
👉 क्या हम आपका ऑर्डर बुक कर दें? 👌

Payment:
- Online payment → 10% छूट 👍
- COD → कीमत वही रहेगी

After payment:
👉 कृपया नाम और गाँव / पूरा पता भेज दें

Rules:
- Use “हम”, never “मैं”
- Friendly farmer tone
- Allowed emojis only: 🙏 👍 👌 👉 👈 ☺️
- No English reply
- No outside market products
- No competitor products
- If issue outside our products, say shortly that our products are not suitable
- Never repeat welcome if already welcomed
- Never ask crop again if crop already known
- Never ask water again if water already known
- If crop known and water missing: ask only water
- If water known and crop missing: ask only crop
- If both known: move to product explanation directly
`;

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, {
      welcomed: false,
      crop: null,
      waterLiters: null,
      history: []
    });
  }
  return sessions.get(userId);
}

function detectLanguage(text = "") {
  if (/मराठी|मध्ये बोला|आहे|नाही|काय|पीक/.test(text)) return "mr";
  return "hi";
}

function normalize(text = "") {
  return text.toLowerCase().trim();
}

function extractWaterLiters(text = "") {
  const t = normalize(text);

  let match = t.match(/(\d+(?:\.\d+)?)\s*(लीटर|liter|litre|ltr|l)\b/i);
  if (match) return Number(match[1]);

  match = t.match(/(\d+(?:\.\d+)?)/);
  if (match && /(पानी|लीटर|liter|litre|ltr|स्प्रे)/i.test(t)) {
    return Number(match[1]);
  }

  return null;
}

function extractCrop(text = "") {
  const t = normalize(text);

  const cropPatterns = [
    { regex: /टमाटर|टोमेटो|tomato/, value: "टमाटर" },
    { regex: /मिर्च|mirch|chilli|chili/, value: "मिर्च" },
    { regex: /शिमला मिर्च|capsicum/, value: "शिमला मिर्च" },
    { regex: /पपीता|papaya/, value: "पपीता" },
    { regex: /तरबूज|watermelon/, value: "तरबूज" },
    { regex: /करेला|bitter gourd/, value: "करेला" },
    { regex: /खीरा|ककड़ी|cucumber/, value: "खीरा" },
    { regex: /लौकी|bottle gourd/, value: "लौकी" },
    { regex: /तोरई|ridge gourd/, value: "तोरई" },
    { regex: /भिंडी|okra/, value: "भिंडी" },
    { regex: /बैंगन|brinjal|eggplant/, value: "बैंगन" }
  ];

  for (const item of cropPatterns) {
    if (item.regex.test(t)) return item.value;
  }

  return null;
}

function stripBadContent(text = "") {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/\(As per your crop[\s\S]*?\)/gi, "")
    .replace(/\(.*next step.*?\)/gi, "")
    .replace(/As per your crop[\s\S]*/gi, "")
    .trim();
}

function buildDirectFlowReply(session) {
  if (!session.welcomed) {
    session.welcomed = true;
    return `🙏 नमस्ते किसान भाई
Primia Crop Care में आपका स्वागत है 👌
अगर फसल में वायरस या ग्रोथ की दिक्कत है, तो हम मदद के लिए यहाँ हैं 👍

👉 आपकी फसल कौन सी है?
👉 स्प्रे में कितने लीटर पानी इस्तेमाल करते हैं?`;
  }

  if (session.crop && !session.waterLiters) {
    return `👉 स्प्रे में कितने लीटर पानी इस्तेमाल करते हैं?`;
  }

  if (!session.crop && session.waterLiters) {
    return `👉 आपकी फसल कौन सी है?`;
  }

  if (session.crop && session.waterLiters) {
    let videoText = "";

    if (session.crop === "टमाटर") {
      videoText = `🎥 5–7 दिन बाद का परिणाम:
https://drive.google.com/file/d/1R4PGjIMhvvi3zSZ5r9861Tmc2zsl58wq/view`;
    } else if (session.crop === "तरबूज") {
      videoText = `🎥 5–7 दिन बाद का परिणाम:
https://drive.google.com/file/d/1YDuPmmwpvkKBOAGokd0aPMt51AtAUDHc/view`;
    } else if (session.crop === "पपीता") {
      videoText = `🎥 5 दिन बाद का परिणाम:
https://drive.google.com/file/d/1OsV7eED2LUxMwxVylUBYMKbV_VuQ-gch/view`;
    } else if (session.crop === "करेला" || session.crop === "खीरा" || session.crop === "लौकी" || session.crop === "तोरई") {
      videoText = `🎥 5 दिन बाद का परिणाम:
https://drive.google.com/file/d/1hlQBz3BZxY8dRLcnYTjUFQPWpLtP92F_/view`;
    } else if (session.crop === "मिर्च" || session.crop === "शिमला मिर्च") {
      videoText = `🎥 रिजल्ट वीडियो:
https://drive.google.com/file/d/17ZVFm1L_wjb1vh1cP5JYvTW39dMV6tI3/view
https://drive.google.com/file/d/1xk6lrDsi9waFtXkhBA1fdVFQ95mxeTQl/view
https://drive.google.com/file/d/1XqQBNRROZeRuyrqDA5kAhs9SUKCRU1Vw/view
https://drive.google.com/file/d/1i41L62gbhpUMIQ9aiyjeJeDncUs3rGIP/view
https://drive.google.com/file/d/1WQdw66tw-YQioeB7NoKHaE9WOzidOLPI/view`;
    }

    let packText = "";
    const w = session.waterLiters;

    if (w >= 50 && w <= 60) {
      packText = `👉 100 ml + 100 g + 50 g pack
₹620`;
    } else if (w >= 100 && w <= 120) {
      packText = `👉 200 ml + 200 g + 100 g pack
₹1040`;
    } else if (w >= 150 && w <= 170) {
      packText = `👉 300 ml + 300 g + 150 g pack
₹1360`;
    } else if (w >= 200 && w <= 220) {
      packText = `👉 400 ml + 400 g + 200 g pack
₹1620`;
    } else if (w >= 300 && w <= 340) {
      packText = `👉 500 ml + 500 g + 300 g pack
₹2260
+ 100 ml Shooter + 100 g Viron FREE`;
    } else if (w >= 600 && w <= 650) {
      packText = `👉 1 लीटर + 1 किलो + 600 g pack
₹4020
+ 200 ml Shooter + 200 g Viron FREE`;
    } else {
      packText = `👉 पानी की मात्रा के हिसाब से हम सही pack बता देंगे 👍`;
    }

    return `🙏 ${session.crop} फसल के लिए हम ये 3 products साथ में देते हैं:

✔ Shooter 101 → वायरस फैलाने वाले कीट कंट्रोल करता है
✔ Viron → वायरस रोकने और रिकवरी में मदद करता है
✔ Kayakalp → नई और मजबूत ग्रोथ देता है

👉 दवा पड़ते ही वायरस फैलना रुकता है
👉 3–4 दिन में असर दिखता है
👉 5–7 दिन में फर्क साफ दिखता है
👉 ज्यादा वायरस में पहले स्प्रे में लगभग 30% सुधार संभव
👉 बिना वायरस में फसल सुरक्षित रहती है

प्रति 1 लीटर पानी:
👉 Shooter 101 → 2 ml
👉 Viron → 2 g
👉 Kayakalp → 1 g

👉 तीनों दवाएँ एक साथ मिलाकर स्प्रे करें

${videoText}

${packText}

👉 क्या हम आपका ऑर्डर बुक कर दें? 👌`;
  }

  return `👉 आपकी फसल कौन सी है?
👉 स्प्रे में कितने लीटर पानी इस्तेमाल करते हैं?`;
}

async function askSarvam(session, userText) {
  const messages = [
    { role: "system", content: LOCKED_SYSTEM_PROMPT },
    {
      role: "system",
      content: `State:
welcomed=${session.welcomed}
crop=${session.crop || "unknown"}
waterLiters=${session.waterLiters || "unknown"}

Rules:
- no English
- no bracket explanation
- no think text
- if crop known and water unknown, ask only water
- if crop and water both known, move ahead`
    },
    ...session.history.slice(-10),
    { role: "user", content: userText }
  ];

  const res = await fetch("https://api.sarvam.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SARVAM_API_KEY}`
    },
    body: JSON.stringify({
      model: "sarvam-m",
      messages
    })
  });

  const data = await res.json();
  console.log("Sarvam Response:", JSON.stringify(data, null, 2));

  let reply = data?.choices?.[0]?.message?.content || "";
  reply = stripBadContent(reply);

  return reply;
}

async function sendWhatsAppText(phoneNumberId, to, body) {
  const res = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${WHATSAPP_TOKEN}`
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      text: { body }
    })
  });

  const data = await res.json();
  console.log("WhatsApp send response:", JSON.stringify(data, null, 2));
  return data;
}

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

app.post("/webhook", async (req, res) => {
  try {
    console.log("Incoming JSON:", JSON.stringify(req.body, null, 2));

    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const phoneNumberId = value?.metadata?.phone_number_id;

    if (value?.statuses) {
      return res.sendStatus(200);
    }

    const msg = value?.messages?.[0];
    const from = msg?.from;
    const text = msg?.text?.body?.trim();

    if (!from || !text || !phoneNumberId) {
      return res.sendStatus(200);
    }

    const session = getSession(from);

    const crop = extractCrop(text);
    const water = extractWaterLiters(text);

    if (crop) session.crop = crop;
    if (water) session.waterLiters = water;

    let finalReply = "";

    try {
      finalReply = buildDirectFlowReply(session);

      if (!finalReply || finalReply.length < 2) {
        finalReply = await askSarvam(session, text);
      }

      finalReply = stripBadContent(finalReply);

      if (!finalReply) {
        finalReply = buildDirectFlowReply(session);
      }

      if (!finalReply) {
        finalReply = "👉 कृपया अपनी फसल और पानी की मात्रा बताइए 👍";
      }
    } catch (e) {
      console.error("Reply build error:", e);
      finalReply = buildDirectFlowReply(session);
    }

    await sendWhatsAppText(phoneNumberId, from, finalReply);

    session.history.push(
      { role: "user", content: text },
      { role: "assistant", content: finalReply }
    );

    if (session.history.length > 20) {
      session.history = session.history.slice(-20);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    return res.sendStatus(200);
  }
});

app.get("/", (req, res) => {
  res.send("Primia WhatsApp bot is running.");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
