import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "primia_verify_123";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const SARVAM_API_KEY = process.env.SARVAM_API_KEY;

const sessions = new Map();

const CROP_VIDEOS = {
  karela: [
    "https://drive.google.com/file/d/1hlQBz3BZxY8dRLcnYTjUFQPWpLtP92F_/view"
  ],
  belvargiya: [
    "https://drive.google.com/file/d/1hlQBz3BZxY8dRLcnYTjUFQPWpLtP92F_/view"
  ],
  tomato: [
    "https://drive.google.com/file/d/1R4PGjIMhvvi3zSZ5r9861Tmc2zsl58wq/view"
  ],
  tarbuj: [
    "https://drive.google.com/file/d/1YDuPmmwpvkKBOAGokd0aPMt51AtAUDHc/view"
  ],
  papita: [
    "https://drive.google.com/file/d/1OsV7eED2LUxMwxVylUBYMKbV_VuQ-gch/view"
  ],
  mirch: [
    "https://drive.google.com/file/d/17ZVFm1L_wjb1vh1cP5JYvTW39dMV6tI3/view",
    "https://drive.google.com/file/d/1xk6lrDsi9waFtXkhBA1fdVFQ95mxeTQl/view",
    "https://drive.google.com/file/d/1XqQBNRROZeRuyrqDA5kAhs9SUKCRU1Vw/view",
    "https://drive.google.com/file/d/1i41L62gbhpUMIQ9aiyjeJeDncUs3rGIP/view",
    "https://drive.google.com/file/d/1WQdw66tw-YQioeB7NoKHaE9WOzidOLPI/view"
  ]
};

const PACKS = [
  {
    min: 50,
    max: 60,
    text: "👉 100 ml + 100 g + 50 g pack\n₹620"
  },
  {
    min: 100,
    max: 120,
    text: "👉 200 ml + 200 g + 100 g pack\n₹1040"
  },
  {
    min: 150,
    max: 170,
    text: "👉 300 ml + 300 g + 150 g pack\n₹1360"
  },
  {
    min: 200,
    max: 220,
    text: "👉 400 ml + 400 g + 200 g pack\n₹1620"
  },
  {
    min: 300,
    max: 340,
    text: "👉 500 ml + 500 g + 300 g pack\n₹2260\n+ 100 ml Shooter + 100 g Viron FREE"
  },
  {
    min: 600,
    max: 650,
    text: "👉 1 लीटर + 1 किलो + 600 g pack\n₹4020\n+ 200 ml Shooter + 200 g Viron FREE"
  }
];

function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function stripThinkBlocks(text = "") {
  return String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();
}

function detectLanguage(text = "") {
  const t = String(text).trim();
  if (/[\u0900-\u097F]/.test(t)) {
    return "hi";
  }
  return "hi";
}

function getSession(user) {
  if (!sessions.has(user)) {
    sessions.set(user, {
      crop: null,
      waterLiters: null,
      language: "hi",
      lastBotReplyAt: 0,
      lastUserAt: 0,
      askedIntro: false
    });
  }
  return sessions.get(user);
}

function resetSessionIfNeeded(session) {
  return session;
}

function detectCrop(text = "") {
  const t = normalize(text);

  if (t.includes("टमाटर") || t.includes("tamatar") || t.includes("tomato")) {
    return "tomato";
  }

  if (
    t.includes("मिर्च") ||
    t.includes("mirch") ||
    t.includes("shimla mirch") ||
    t.includes("शिमला मिर्च") ||
    t.includes("chilli") ||
    t.includes("chili") ||
    t.includes("capsicum")
  ) {
    return "mirch";
  }

  if (t.includes("तरबूज") || t.includes("tarbuj") || t.includes("watermelon")) {
    return "tarbuj";
  }

  if (t.includes("पपीता") || t.includes("papita") || t.includes("papaya")) {
    return "papita";
  }

  if (t.includes("करेला") || t.includes("karela") || t.includes("bitter gourd")) {
    return "karela";
  }

  if (
    t.includes("बेलवर्गीय") ||
    t.includes("belvargiya") ||
    t.includes("बेल वाली")
  ) {
    return "belvargiya";
  }

  return null;
}

function extractWaterLiters(text = "", session = null) {
  const t = normalize(text);

  let match = t.match(/(\d+(?:\.\d+)?)\s*(लीटर|liter|litre|ltr|l)\b/i);
  if (match) return Number(match[1]);

  match = t.match(/^(\d+(?:\.\d+)?)$/);
  if (match) {
    const num = Number(match[1]);
    if (num > 0 && num <= 5000) return num;
  }

  match = t.match(/(\d+(?:\.\d+)?)/);
  if (match && /(पानी|लीटर|liter|litre|ltr|स्प्रे)/i.test(t)) {
    const num = Number(match[1]);
    if (num > 0 && num <= 5000) return num;
  }

  if (session?.crop && !session?.waterLiters) {
    match = t.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const num = Number(match[1]);
      if (num > 0 && num <= 5000) return num;
    }
  }

  return null;
}

function getCropLabel(crop) {
  const map = {
    tomato: "टमाटर",
    mirch: "मिर्च",
    tarbuj: "तरबूज",
    papita: "पपीता",
    karela: "करेला",
    belvargiya: "बेलवर्गीय"
  };
  return map[crop] || "फसल";
}

function getPackByWater(waterLiters) {
  for (const pack of PACKS) {
    if (waterLiters >= pack.min && waterLiters <= pack.max) {
      return pack.text;
    }
  }

  if (waterLiters > 60 && waterLiters < 100) {
    return "👉 100 ml + 100 g + 50 g pack\n₹620\n\nया\n\n👉 200 ml + 200 g + 100 g pack\n₹1040";
  }

  if (waterLiters > 120 && waterLiters < 150) {
    return "👉 200 ml + 200 g + 100 g pack\n₹1040\n\nया\n\n👉 300 ml + 300 g + 150 g pack\n₹1360";
  }

  if (waterLiters > 170 && waterLiters < 200) {
    return "👉 300 ml + 300 g + 150 g pack\n₹1360\n\nया\n\n👉 400 ml + 400 g + 200 g pack\n₹1620";
  }

  if (waterLiters > 220 && waterLiters < 300) {
    return "👉 400 ml + 400 g + 200 g pack\n₹1620\n\nया\n\n👉 500 ml + 500 g + 300 g pack\n₹2260\n+ 100 ml Shooter + 100 g Viron FREE";
  }

  if (waterLiters > 340 && waterLiters < 600) {
    return "👉 500 ml + 500 g + 300 g pack\n₹2260\n+ 100 ml Shooter + 100 g Viron FREE";
  }

  if (waterLiters > 650) {
    return "👉 आपके पानी के हिसाब से बड़ा पैक लगेगा\nकृपया exact पानी बताइए, हम सही pack समझा देंगे 👍";
  }

  return "👉 कृपया पानी की मात्रा फिर से बताइए, हम सही pack समझा देंगे 👍";
}

function buildIntroMessage() {
  return `🙏 नमस्ते किसान भाई
Primia Crop Care में आपका स्वागत है 👌
अगर फसल में वायरस या ग्रोथ की दिक्कत है, तो हम मदद के लिए यहाँ हैं 👍

👉 आपकी फसल कौन सी है?
👉 स्प्रे में कितने लीटर पानी इस्तेमाल करते हैं?`;
}

function buildAskWaterOnlyMessage() {
  return `👉 स्प्रे में कितने लीटर पानी इस्तेमाल करते हैं?`;
}

function buildAskCropOnlyMessage() {
  return `👉 आपकी फसल कौन सी है?`;
}

function buildSalesMessage(crop, waterLiters) {
  const cropLabel = getCropLabel(crop);
  const videos = CROP_VIDEOS[crop] || [];
  const packText = getPackByWater(waterLiters);

  let videoSection = "";
  if (videos.length > 0) {
    videoSection = "\n\n🎥 रिजल्ट वीडियो:\n" + videos.join("\n");
  }

  return `🙏 ${cropLabel} फसल के लिए हम ये 3 दवाएँ साथ में देते हैं:

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

👉 तीनों दवाएँ एक साथ मिलाकर स्प्रे करें${videoSection}

${packText}

👉 क्या हम आपका ऑर्डर बुक कर दें? 👌`;
}

function shouldIgnoreBecauseDeleteIntent(text = "") {
  const t = normalize(text);
  return (
    t.includes("delete") ||
    t.includes("kyon delete") ||
    t.includes("message hata") ||
    t.includes("dubara bhejo")
  );
}

async function askSarvam(userText) {
  const payload = {
    model: "sarvam-m",
    messages: [
      {
        role: "system",
        content:
          "आप किसान से हिंदी में छोटे WhatsApp-style reply में बात करें। अंग्रेज़ी में reply न दें। कोई बाहरी product suggest न करें। अगर जवाब छोटा हो सकता है तो छोटा रखें।"
      },
      {
        role: "user",
        content: userText
      }
    ]
  };

  const sarvamRes = await fetch("https://api.sarvam.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SARVAM_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const sarvamData = await sarvamRes.json();
  console.log("Sarvam Response:", JSON.stringify(sarvamData, null, 2));

  let reply =
    sarvamData?.choices?.[0]?.message?.content ||
    "अभी जवाब उपलब्ध नहीं है।";

  reply = stripThinkBlocks(reply);

  if (!reply) {
    reply = "अभी जवाब उपलब्ध नहीं है।";
  }

  return reply;
}

async function sendWhatsAppMessage(phoneNumberId, to, body) {
  const response = await fetch(
    `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_TOKEN}`
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        text: { body }
      })
    }
  );

  const data = await response.json();
  console.log("WhatsApp send response:", JSON.stringify(data, null, 2));
  return data;
}

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
    const phoneNumberId = value?.metadata?.phone_number_id;

    if (!message || !phoneNumberId) {
      return res.sendStatus(200);
    }

    if (message.type !== "text") {
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message?.text?.body?.trim();

    if (!from || !text) {
      return res.sendStatus(200);
    }

    const session = resetSessionIfNeeded(getSession(from));
    session.lastUserAt = Date.now();
    session.language = detectLanguage(text);

    if (shouldIgnoreBecauseDeleteIntent(text)) {
      return res.sendStatus(200);
    }

    const crop = detectCrop(text);
    const water = extractWaterLiters(text, session);

    if (!session.crop && crop) {
      session.crop = crop;
    }

    if (!session.waterLiters && water) {
      session.waterLiters = water;
    }

    let reply = null;

    if (!session.askedIntro) {
      session.askedIntro = true;

      if (session.crop && session.waterLiters) {
        reply = buildSalesMessage(session.crop, session.waterLiters);
      } else {
        reply = buildIntroMessage();
      }
    } else if (!session.crop && !session.waterLiters) {
      reply = buildIntroMessage();
    } else if (session.crop && !session.waterLiters) {
      if (water) {
        session.waterLiters = water;
        reply = buildSalesMessage(session.crop, session.waterLiters);
      } else {
        reply = buildAskWaterOnlyMessage();
      }
    } else if (!session.crop && session.waterLiters) {
      if (crop) {
        session.crop = crop;
        reply = buildSalesMessage(session.crop, session.waterLiters);
      } else {
        reply = buildAskCropOnlyMessage();
      }
    } else if (session.crop && session.waterLiters) {
      const t = normalize(text);

      const isFreshGreeting =
        /^(hi|hii|hiii|hello|hy|hey|namaste|नमस्ते)$/.test(t);

      if (isFreshGreeting) {
        reply = `👉 आपकी फसल कौन सी है?
👉 स्प्रे में कितने लीटर पानी इस्तेमाल करते हैं?`;
        session.crop = null;
        session.waterLiters = null;
      } else {
        const salesKeywords = [
          "क्या काम करता है",
          "price",
          "प्राइस",
          "दाम",
          "कितना",
          "ऑर्डर",
          "order",
          "बुक",
          "virus",
          "वायरस",
          "काम करता",
          "pack",
          "पैक"
        ];

        const hasSalesKeyword = salesKeywords.some((k) => t.includes(k));

        if (crop && crop !== session.crop) {
          session.crop = crop;
          if (water) session.waterLiters = water;
          reply = buildSalesMessage(session.crop, session.waterLiters);
        } else if (water) {
          session.waterLiters = water;
          reply = buildSalesMessage(session.crop, session.waterLiters);
        } else if (hasSalesKeyword) {
          reply = buildSalesMessage(session.crop, session.waterLiters);
        } else {
          reply = await askSarvam(text);
        }
      }
    }

    if (!reply) {
      reply = "अभी जवाब उपलब्ध नहीं है।";
    }

    reply = stripThinkBlocks(reply);

    await sendWhatsAppMessage(phoneNumberId, from, reply);
    session.lastBotReplyAt = Date.now();

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
