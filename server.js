const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

/* =========================
   DIRECT CONFIG
   यहाँ अपनी values डालो
========================= */
const PORT = 3000;
const VERIFY_TOKEN = "primia_verify_token";
const WHATSAPP_TOKEN = "EAAb91IITcq8BRAWFOSsMVLfu9rhnMHaUYLbNrpcmuO6lZARv7UxuP8lFZCAFjDLZCZAhx5uTeSDwIx7aUdgUBTIPAMNVJBOyjdNZAv5z0afh7nIaelLneoZCeFuqH17rOyf0hxhOtLqvi2xk7rqwAjMY4CAAxnYTHlwXhIUuQC64ZCaYssrolpB2xxUhKmDqH5uNhZAW0edCILLCwfjo9hmNcPSHJGCZAFb8EIBHieZAItcLIbEFAR5JmKfCC60ZCQLKS1Q8RuBwl7aPZBFeuZAAgrqL2HGA4GRJhEohYZBO1YZCwZDZD";
const PHONE_NUMBER_ID = "939435405927842";
const SARVAM_API_KEY = "sk_gndk50mk_utHkV8yIpWvJF9d3qujLRSHI";


/* =========================
   IN-MEMORY SESSION STORE
========================= */
const sessions = new Map();

function getSession(phone) {
  if (!sessions.has(phone)) {
    sessions.set(phone, {
      language: "hi",
      crop: null,
      waterLiters: null,
      introSent: false,
      recommendationSent: false,
      orderAsked: false,
      stopFollowup: false,
      agentSilentUntil: 0,
      followups: {
        f1: false,
        f2: false,
        f3: false,
        f4: false,
        f5: false,
      },
      lastUserMessageAt: 0,
      lastBotMessageAt: 0,
      createdAt: Date.now(),
    });
  }
  return sessions.get(phone);
}

/* =========================
   LOCKED DATA
========================= */
const PACKS = [
  { min: 50, max: 60, text: "100 ml + 100 g + 50 g → ₹620 (50–60 लीटर)" },
  { min: 100, max: 120, text: "200 ml + 200 g + 100 g → ₹1040 (100–120 लीटर)" },
  { min: 150, max: 170, text: "300 ml + 300 g + 150 g → ₹1360 (150–170 लीटर)" },
  { min: 200, max: 220, text: "400 ml + 400 g + 200 g → ₹1620 (200–220 लीटर)" },
  { min: 300, max: 340, text: "500 ml + 500 g + 300 g → ₹2260 + 100 ml Shooter + 100 g Viron FREE (300–340 लीटर)" },
  { min: 600, max: 650, text: "1 लीटर + 1 किलो + 600 g → ₹4020 + 200 ml Shooter + 200 g Viron FREE (600–650 लीटर)" }
];

const CROP_VIDEO_MAP = [
  {
    keys: ["करेला", "खीरा", "ककड़ी", "लौकी", "तोरई", "नेनुआ", "बेलवर्गीय", "cucurbit", "bitter gourd", "bottle gourd", "gourd"],
    videos: ["https://drive.google.com/file/d/1hlQBz3BZxY8dRLcnYTjUFQPWpLtP92F_/view"]
  },
  {
    keys: ["टमाटर", "tomato"],
    videos: ["https://drive.google.com/file/d/1R4PGjIMhvvi3zSZ5r9861Tmc2zsl58wq/view"]
  },
  {
    keys: ["तरबूज", "watermelon"],
    videos: ["https://drive.google.com/file/d/1YDuPmmwpvkKBOAGokd0aPMt51AtAUDHc/view"]
  },
  {
    keys: ["पपीता", "papaya"],
    videos: ["https://drive.google.com/file/d/1OsV7eED2LUxMwxVylUBYMKbV_VuQ-gch/view"]
  },
  {
    keys: ["मिर्च", "शिमला मिर्च", "chilli", "chili", "capsicum", "pepper"],
    videos: [
      "https://drive.google.com/file/d/17ZVFm1L_wjb1vh1cP5JYvTW39dMV6tI3/view",
      "https://drive.google.com/file/d/1xk6lrDsi9waFtXkhBA1fdVFQ95mxeTQl/view",
      "https://drive.google.com/file/d/1XqQBNRROZeRuyrqDA5kAhs9SUKCRU1Vw/view",
      "https://drive.google.com/file/d/1i41L62gbhpUMIQ9aiyjeJeDncUs3rGIP/view",
      "https://drive.google.com/file/d/1WQdw66tw-YQioeB7NoKHaE9WOzidOLPI/view"
    ]
  }
];

const DELETE_WORD_TRIGGERS = ["delete", "remove", "stop", "band", "बंद", "डिलीट", "हटाओ", "रोक दो", "नहीं चाहिए"];
const HUMAN_AGENT_TRIGGERS = ["agent", "call me", "human", "person", "बात कराओ", "कॉल करो", "आदमी से बात", "किसी से बात", "टीम से बात"];
const ORDER_YES_WORDS = ["हाँ", "हां", "haa", "haan", "yes", "book", "बुक", "ऑर्डर", "order", "कर दो", "करिए", "करो"];
const PAYMENT_ONLINE_WORDS = ["online", "upi", "gpay", "phonepe", "paytm", "ऑनलाइन", "यूपीआई"];
const PAYMENT_COD_WORDS = ["cod", "cash", "delivery", "कैश", "डिलीवरी"];

/* =========================
   HELPERS
========================= */
function normalizeText(text = "") {
  return text.toString().trim().replace(/\s+/g, " ").toLowerCase();
}

function stripThinkTags(text = "") {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();
}

function detectLanguage(text) {
  const t = normalizeText(text);
  if (t.includes("मराठी") || t.includes("marathi")) return "mr";

  const marathiHints = ["आहे", "नाही", "काय", "मध्ये", "तुमचं", "पाणी", "पीक", "फवारणी"];
  for (const word of marathiHints) {
    if (t.includes(word)) return "mr";
  }
  return "hi";
}

function containsAny(text, words) {
  const t = normalizeText(text);
  return words.some(w => t.includes(normalizeText(w)));
}

function isLikelyGreeting(text) {
  const t = normalizeText(text);
  const greetings = ["hi", "hello", "helo", "hii", "namaste", "नमस्ते", "राम राम", "रामराम", "जय श्री राम", "hy"];
  return greetings.includes(t) || greetings.some(g => t === g);
}

function extractWaterLiters(text) {
  const t = text.toString();
  const regex = /(\d{1,4})(?:\s*)(?:लीटर|liter|litre|ltr|l|पानी)?/i;
  const match = t.match(regex);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  if (isNaN(num) || num <= 0 || num > 5000) return null;
  return num;
}

function detectCrop(text) {
  const raw = text.toString().trim().toLowerCase();

  if (raw.includes("मिर्च") || raw.includes("chilli")) return "मिर्च";
  if (raw.includes("टमाटर") || raw.includes("tomato")) return "टमाटर";

  return null;
}

function getCropVideos(crop) {
  if (!crop) return [];
  const t = normalizeText(crop);
  for (const item of CROP_VIDEO_MAP) {
    if (item.keys.some(k => t.includes(normalizeText(k)))) return item.videos;
  }
  return [];
}

function getBestPack(waterLiters) {
  if (!waterLiters) return null;

  for (const pack of PACKS) {
    if (waterLiters >= pack.min && waterLiters <= pack.max) return pack.text;
  }

  for (const pack of PACKS) {
    if (waterLiters <= pack.max) return pack.text;
  }

  const last = PACKS[PACKS.length - 1];
  const multiplier = Math.ceil(waterLiters / last.max);
  return `${last.text}\n👉 ${waterLiters} लीटर पानी के लिए लगभग ${multiplier} सेट लगेंगे।`;
}

/* =========================
   MESSAGES
========================= */
function welcomeMsg(lang = "hi") {
  if (lang === "mr") {
    return `🙏 नमस्कार शेतकरी बांधवा
Primia Crop Care मध्ये तुमचं स्वागत आहे 👌
पिकात व्हायरस किंवा वाढीची अडचण असेल तर आम्ही मदतीसाठी आहोत 👍

👉 तुमचं पीक कोणतं आहे?
👉 फवारणीत किती लिटर पाणी वापरता?`;
  }

  return `🙏 नमस्ते किसान भाई
Primia Crop Care में आपका स्वागत है 👌
अगर फसल में वायरस या ग्रोथ की दिक्कत है, तो हम मदद के लिए यहाँ हैं 👍

👉 आपकी फसल कौन सी है?
👉 स्प्रे में कितने लीटर पानी इस्तेमाल करते हैं?`;
}

function askWaterOnlyMsg(lang = "hi", crop = "") {
  if (lang === "mr") {
    return `👌 ठीक आहे
👉 पीक: ${crop}
👉 फवारणीत किती लिटर पाणी वापरता?`;
  }

  return `👌 ठीक है
👉 फसल: ${crop}
👉 स्प्रे में कितने लीटर पानी इस्तेमाल करते हैं?`;
}

function askCropOnlyMsg(lang = "hi") {
  if (lang === "mr") return `👉 तुमचं पीक कोणतं आहे?`;
  return `👉 आपकी फसल कौन सी है?`;
}

function recommendationMsg(lang, crop, waterLiters) {
  const pack = getBestPack(waterLiters);
  const videos = getCropVideos(crop);

  let msg = "";

  if (lang === "mr") {
    msg = `👌 ${crop} साठी आमचा पूर्ण कॉम्बो असा आहे:

Shooter 101 → व्हायरस पसरवणारे कीटक कंट्रोल करतो
Viron → व्हायरस थांबवण्यासाठी आणि रिकव्हरीसाठी मदत करतो
Kayakalp → नवीन आणि मजबूत वाढ देतो

👉 डोस प्रति 1 लिटर:
Shooter 101 → 2 ml
Viron → 2 g
Kayakalp → 1 g

👉 तिन्ही औषधे एकत्र मिसळून फवारणी करा

औषध पडल्यानंतर व्हायरसचा प्रसार थांबतो
3–4 दिवसांत परिणाम दिसू लागतो
5–7 दिवसांत फरक स्पष्ट दिसतो
जास्त व्हायरसमध्ये पहिल्या फवारणीत सुमारे 30% सुधार दिसू शकतो
व्हायरस नसलेल्या पिकात पीक सुरक्षित राहते`;
  } else {
    msg = `👌 ${crop} के लिए हमारा पूरा कॉम्बो यह है:

Shooter 101 → वायरस फैलाने वाले कीट कंट्रोल करता है
Viron → वायरस रोकने और रिकवरी में मदद करता है
Kayakalp → नई और मजबूत ग्रोथ देता है

👉 डोज प्रति 1 लीटर:
Shooter 101 → 2 ml
Viron → 2 g
Kayakalp → 1 g

👉 तीनों दवाएँ एक साथ मिलाकर स्प्रे करें

दवा पड़ते ही वायरस फैलना रुकता है
3–4 दिन में असर दिखता है
5–7 दिन में फर्क साफ दिखता है
ज्यादा वायरस में पहले स्प्रे में लगभग 30% सुधार संभव
बिना वायरस में फसल सुरक्षित रहती है`;
  }

  if (videos.length) {
    msg += lang === "mr" ? `\n\n👉 तुमच्या पिकाचे व्हिडिओ:` : `\n\n👉 आपकी फसल के वीडियो:`;
    videos.forEach(v => {
      msg += `\n${v}`;
    });
  }

  if (pack) {
    msg += lang === "mr"
      ? `\n\n👉 ${waterLiters} लिटर पाण्यासाठी योग्य पॅक:\n${pack}`
      : `\n\n👉 ${waterLiters} लीटर पानी के लिए सही पैक:\n${pack}`;
  }

  msg += `\n\nक्या हम आपका ऑर्डर बुक कर दें? 👌
Online payment → 10% छूट 👍
COD → कीमत वही रहेगी`;

  return msg;
}

function paymentReply(lang, mode) {
  if (lang === "mr") {
    if (mode === "online") {
      return `👌 ऑनलाइन पेमेंटवर 10% सूट मिळेल 👍

👉 तुमचं नाव आणि पूर्ण पत्ता पाठवा.`;
    }
    return `👌 COD वर किंमत तीच राहील

👉 तुमचं नाव आणि पूर्ण पत्ता पाठवा.`;
  }

  if (mode === "online") {
    return `👌 Online payment पर 10% छूट मिलेगी 👍

👉 अपना नाम और पूरा पता भेज दीजिए।`;
  }

  return `👌 COD पर कीमत वही रहेगी

👉 अपना नाम और पूरा पता भेज दीजिए।`;
}

function genericNoOutsideAdvice(lang) {
  if (lang === "mr") {
    return `🙏 या समस्येसाठी आमची उत्पादने लागू नसतील तर आम्ही फक्त आमच्या उत्पादनांपुरतीच माहिती देऊ शकतो.`;
  }
  return `🙏 अगर इस समस्या के लिए हमारे प्रोडक्ट लागू नहीं हैं, तो हम सिर्फ अपने प्रोडक्ट से जुड़ी जानकारी ही दे सकते हैं।`;
}

/* =========================
   SEND MESSAGE
========================= */
async function sendWhatsAppText(to, body) {
  const cleaned = stripThinkTags(body);
  if (!cleaned) return;

  await axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: cleaned }
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}

/* =========================
   AGENT SILENCE
========================= */
function markAgentSilence(phone, minutes = 15) {
  const session = getSession(phone);
  session.agentSilentUntil = Date.now() + minutes * 60 * 1000;
}

function isSilentDueToAgent(phone) {
  const session = getSession(phone);
  return Date.now() < session.agentSilentUntil;
}

/* =========================
   HANDLE MESSAGE
========================= */
async function handleIncomingText(from, text) {
  const session = getSession(from);
  session.lastUserMessageAt = Date.now();
  session.stopFollowup = true;

  const cleanText = stripThinkTags(text || "").trim();
  if (!cleanText) return;

  session.language = detectLanguage(cleanText);

  if (containsAny(cleanText, HUMAN_AGENT_TRIGGERS)) {
    markAgentSilence(from, 15);
    return sendWhatsAppText(
      from,
      session.language === "mr"
        ? "👌 आमच्या टीमकडून संपर्क होईपर्यंत आम्ही शांत राहू."
        : "👌 हमारी टीम के जवाब तक हम शांत रहेंगे।"
    );
  }

  if (isSilentDueToAgent(from)) return;

  if (containsAny(cleanText, DELETE_WORD_TRIGGERS)) {
    if (!session.crop || !session.waterLiters) {
      return sendWhatsAppText(from, session.crop ? askWaterOnlyMsg(session.language, session.crop) : askCropOnlyMsg(session.language));
    }
    return sendWhatsAppText(from, recommendationMsg(session.language, session.crop, session.waterLiters));
  }

  if (!session.introSent && isLikelyGreeting(cleanText)) {
    session.introSent = true;
    return sendWhatsAppText(from, welcomeMsg(session.language));
  }

  const foundCrop = detectCrop(cleanText);
  const foundWater = extractWaterLiters(cleanText);

  if (foundCrop) session.crop = foundCrop;
  if (!session.waterLiters && foundWater) session.waterLiters = foundWater;
  if (!session.introSent) session.introSent = true;

  if (!session.crop && !session.waterLiters) {
    return sendWhatsAppText(from, welcomeMsg(session.language));
  }

  if (session.crop && !session.waterLiters) {
    return sendWhatsAppText(from, askWaterOnlyMsg(session.language, session.crop));
  }

  if (!session.crop && session.waterLiters) {
    return sendWhatsAppText(from, askCropOnlyMsg(session.language));
  }

  if (session.crop && session.waterLiters && !session.recommendationSent) {
    session.recommendationSent = true;
    session.orderAsked = true;
    return sendWhatsAppText(from, recommendationMsg(session.language, session.crop, session.waterLiters));
  }

  if (session.orderAsked && containsAny(cleanText, ORDER_YES_WORDS)) {
    return sendWhatsAppText(
      from,
      session.language === "mr"
        ? `👌 ठीक आहे

Online payment → 10% सूट 👍
COD → किंमत तीच राहील

👉 ऑनलाइन की COD?`
        : `👌 ठीक है

Online payment → 10% छूट 👍
COD → कीमत वही रहेगी

👉 Online या COD?`
    );
  }

  if (containsAny(cleanText, PAYMENT_ONLINE_WORDS)) {
    return sendWhatsAppText(from, paymentReply(session.language, "online"));
  }

  if (containsAny(cleanText, PAYMENT_COD_WORDS)) {
    return sendWhatsAppText(from, paymentReply(session.language, "cod"));
  }

  if (session.crop && session.waterLiters && session.recommendationSent) {
    return sendWhatsAppText(
      from,
      session.language === "mr"
        ? `👌 तुमची माहिती आमच्याकडे आहे

पीक: ${session.crop}
पाणी: ${session.waterLiters} लिटर

${getBestPack(session.waterLiters)}

क्या हम आपका ऑर्डर बुक कर दें? 👌`
        : `👌 आपकी जानकारी हमारे पास है

फसल: ${session.crop}
पानी: ${session.waterLiters} लीटर

${getBestPack(session.waterLiters)}

क्या हम आपका ऑर्डर बुक कर दें? 👌`
    );
  }

  return sendWhatsAppText(from, genericNoOutsideAdvice(session.language));
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
   WEBHOOK RECEIVE
========================= */
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    if (body.object !== "whatsapp_business_account") {
      return res.sendStatus(404);
    }

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) return res.sendStatus(200);

    const messages = value.messages || [];

    if (messages.length > 0) {
      const msg = messages[0];
      const from = msg.from;
      const type = msg.type;

      let text = "";

      if (type === "text") {
        text = msg.text?.body || "";
      } else if (type === "button") {
        text = msg.button?.text || "";
      } else if (type === "interactive") {
        text =
          msg.interactive?.button_reply?.title ||
          msg.interactive?.list_reply?.title ||
          "";
      } else {
        const session = getSession(from);
        await sendWhatsAppText(
          from,
          session.crop ? askWaterOnlyMsg(session.language, session.crop) : welcomeMsg(session.language)
        );
        return res.sendStatus(200);
      }

      console.log("Incoming from", from, ":", text);
      await handleIncomingText(from, text);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err.response?.data || err.message || err);
    return res.sendStatus(200);
  }
});

/* =========================
   OPTIONAL AGENT SILENCE
========================= */
app.post("/agent-replied", (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ ok: false, error: "phone required" });
    }

    markAgentSilence(phone, 15);
    return res.json({ ok: true, message: "AI silent for 15 minutes" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/", (req, res) => {
  res.send("Primia WhatsApp bot is running 👍");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
