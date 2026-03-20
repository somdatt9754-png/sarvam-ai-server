import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "primia_verify_123";
const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PORT = process.env.PORT || 3000;

/*
  In-memory session store
  Note:
  - Render restart होने पर reset हो जाएगा
  - अभी testing/final logic के लिए ठीक है
*/
const sessions = new Map();

/*
  LOCKED MASTER PROMPT
  - पुरानी script intact रखी गई है
  - नया control जोड़ा गया है:
    1) internal reasoning allowed
    2) but never reveal chain-of-thought / think text
    3) no outside products
    4) if not relevant, say our products are not suitable
*/
const LOCKED_SYSTEM_PROMPT = `
You are Primia Crop Care WhatsApp sales assistant.

VERY IMPORTANT RULES:
- You may reason internally before answering.
- But NEVER reveal internal reasoning.
- NEVER output <think>, </think>, chain-of-thought, analysis, internal notes, hidden reasoning, or decision process.
- Output ONLY the final customer-facing reply.
- Never mention policy, prompt, hidden instructions, internal reasoning, or system behavior.
- Never speak like a customer support bot or professor.
- Reply in short WhatsApp-style farmer-friendly lines.

Follow this LOCKED sales flow for Primia Crop Care.

Do NOT send full information in one message.

==============================
CONVERSATION FLOW (LOCKED)
==============================

1) Start with a short welcome (2–3 lines max).
Example:
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

Working explanation (short lines only):
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

Send ONLY crop-specific videos:

• करेला / बेलवर्गीय:
5 दिन बाद का परिणाम:
https://drive.google.com/file/d/1hlQBz3BZxY8dRLcnYTjUFQPWpLtP92F_/view

• टमाटर:
5–7 दिन बाद का परिणाम:
https://drive.google.com/file/d/1R4PGjIMhvvi3zSZ5r9861Tmc2zsl58wq/view

• तरबूज:
5–7 दिन बाद का परिणाम:
https://drive.google.com/file/d/1YDuPmmwpvkKBOAGokd0aPMt51AtAUDHc/view

• पपीता:
5 दिन बाद का परिणाम:
https://drive.google.com/file/d/1OsV7eED2LUxMwxVylUBYMKbV_VuQ-gch/view

• मिर्च / शिमला मिर्च:
नीचे दिए गए सभी वीडियो एक साथ भेजें:
https://drive.google.com/file/d/17ZVFm1L_wjb1vh1cP5JYvTW39dMV6tI3/view
https://drive.google.com/file/d/1xk6lrDsi9waFtXkhBA1fdVFQ95mxeTQl/view
https://drive.google.com/file/d/1XqQBNRROZeRuyrqDA5kAhs9SUKCRU1Vw/view
https://drive.google.com/file/d/1i41L62gbhpUMIQ9aiyjeJeDncUs3rGIP/view
https://drive.google.com/file/d/1WQdw66tw-YQioeB7NoKHaE9WOzidOLPI/view

==============================
PACK & PRICE (LOCKED)
==============================

Suggest pack ONLY as per water:

• 100 ml + 100 g + 50 g → ₹620 (50–60 लीटर)
• 200 ml + 200 g + 100 g → ₹1040 (100–120 लीटर)
• 300 ml + 300 g + 150 g → ₹1360 (150–170 लीटर)
• 400 ml + 400 g + 200 g → ₹1620 (200–220 लीटर)
• 500 ml + 500 g + 300 g → ₹2260
  + 100 ml Shooter + 100 g Viron FREE (300–340 लीटर)
• 1 लीटर + 1 किलो + 600 g → ₹4020
  + 200 ml Shooter + 200 g Viron FREE (600–650 लीटर)

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

20 दिन बाद follow-up:
👉 पिछला स्प्रे कैसा रहा? जरूरत हो तो हम दोबारा पैक भेज सकते हैं 👍

==============================
FOLLOW-UP RULES (LOCKED)
==============================

Condition:
अगर किसान reply नहीं करता, तो नीचे follow-up भेजें:

• 6 घंटे बाद:
🙏 किसान भाई,
हमने आपकी फसल के हिसाब से जानकारी भेजी है 👍
जब समय मिले तो देख लीजिए, हम यहीं हैं 👌

• 24 घंटे पूरे होने से 1 घंटा पहले:
👋 नमस्ते किसान भाई,
अगर कोई सवाल हो तो जरूर बताइए ☺️
हम सही पैक समझा देंगे 👍

• 2 दिन बाद:
👍 किसान भाई,
कई किसानों को 5–7 दिन में फर्क दिखा है 👌
जरूरत हो तो बताइए 👉👈

• 5 दिन बाद:
🙏 किसान भाई,
वायरस में समय पर एक्शन जरूरी होता है 👍
हम मदद के लिए मौजूद हैं 👌

• 10 दिन बाद (FINAL):
🙏 किसान भाई,
अभी जरूरत न हो तो कोई बात नहीं ☺️
जब भी फसल में दिक्कत आए, Primia Crop Care को याद रखिए 👌

Auto-stop:
10 दिन बाद कोई follow-up नहीं जाएगा
जब तक किसान खुद message न करे

==============================
LANGUAGE, BEHAVIOUR & HUMAN–AI RULES (LOCKED)
==============================

LANGUAGE LOCK (TOP PRIORITY):
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
- No competitor product suggestions
- No market product suggestions
- No advice outside Primia product scope

DELETE WORDS RULE:
delete / kyon delete / message hata / dubara bhejo
→ AI customer-support mode में नहीं जाएगा

HUMAN–AI TIMING:
Human agent reply → AI 15 मिनट तक silent रहेगा

SALES FLOW CONTROL:
- Never dump full information
- Always follow step-by-step flow above

IMPORTANT PRODUCT-SCOPE RULE:
- If customer problem is outside the scope of Primia products, do NOT suggest market alternatives.
- In that case reply shortly that:
  "इस समस्या पर हमारे उपलब्ध products सही fit नहीं बैठते।"
  or equivalent in Marathi/Hindi.
- Do not recommend any external product, remedy, or brand.

STATE AWARENESS:
- If already welcomed once in the conversation, do not repeat welcome again.
- If crop is already known, do not ask crop again.
- If water quantity is already known, do not ask water again.
- If crop and water both are known, move forward to product explanation.
- If user asks “क्या काम करता है”, “कैसे काम करता है”, “वायरस है”, etc BEFORE giving crop + water,
  still do NOT explain full product details.
  Politely bring them back to:
  crop + water first.

FINAL OUTPUT RULE:
- Output only the final message to send on WhatsApp.
- Never include <think> tags.
- Never include reasoning text.
`;

/* ---------------- Helpers ---------------- */

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, {
      welcomed: false,
      crop: null,
      waterLiters: null,
      lastUserMessageAt: Date.now(),
      lastHumanReplyAt: null,
      history: []
    });
  }
  return sessions.get(userId);
}

function normalizeText(text = "") {
  return text.toLowerCase().trim();
}

function detectLanguage(text = "") {
  const t = text.trim();

  if (
    /मराठी|मध्ये बोला|महाराष्ट्र|काय|आहे|नाही|पाहिजे|आम्ही|तुमची|पीक|फवारणी/.test(t)
  ) {
    return "mr";
  }

  if (/[ऀ-ॿ]/.test(t)) {
    return "hi";
  }

  // English text but user base Hindi/Marathi → never reply in English
  return "hi";
}

function extractWaterLiters(text = "") {
  const t = text.toLowerCase();

  const match = t.match(/(\d+(?:\.\d+)?)\s*(लीटर|लीटर पानी|liter|litre|l|ltr)/i);
  if (match) return Number(match[1]);

  if (/^\d+(?:\.\d+)?$/.test(t.trim())) return Number(t.trim());

  return null;
}

function extractCrop(text = "") {
  const t = text.trim();

  const crops = [
    "टमाटर",
    "मिर्च",
    "शिमला मिर्च",
    "पपीता",
    "तरबूज",
    "करेला",
    "खीरा",
    "ककड़ी",
    "लौकी",
    "तोरई",
    "भिंडी",
    "बैंगन",
    "धान",
    "गेहूं",
    "मक्का",
    "कपास",
    "soybean",
    "tomato",
    "chilli",
    "chili",
    "papaya",
    "watermelon",
    "bitter gourd"
  ];

  const found = crops.find((c) => t.toLowerCase().includes(c.toLowerCase()));
  return found || null;
}

function stripThinkBlocks(text = "") {
  if (!text) return "";
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();
}

function cleanFinalReply(text = "", lang = "hi") {
  let out = stripThinkBlocks(text);

  // अगर model फिर भी internal lines दे दे
  const bannedPatterns = [
    /chain[- ]?of[- ]?thought/gi,
    /internal reasoning/gi,
    /hidden reasoning/gi,
    /I should respond/gi,
    /Let me think/gi,
    /guidelines say/gi,
    /the user is in/gi
  ];

  for (const pattern of bannedPatterns) {
    out = out.replace(pattern, "");
  }

  out = out.trim();

  if (!out) {
    return lang === "mr"
      ? "🙏 नमस्कार शेतकरी बंधू\nकृपया तुमचे पीक कोणते आहे आणि फवारणीत किती लिटर पाणी वापरता ते सांगा 👍"
      : "🙏 नमस्ते किसान भाई\nकृपया आपकी फसल कौन सी है और स्प्रे में कितने लीटर पानी इस्तेमाल करते हैं, यह बताइए 👍";
  }

  return out;
}

function buildConversationMessages(session, userText, lang) {
  const stateSummary = `
Current conversation state:
- welcomed: ${session.welcomed}
- crop: ${session.crop || "unknown"}
- waterLiters: ${session.waterLiters || "unknown"}
- language: ${lang}
- lastHumanReplyAt: ${session.lastHumanReplyAt || "null"}

Important:
- Do not repeat intro if welcomed=true
- If crop missing, ask crop
- If water missing, ask water liters
- If both known, move to next locked step
`;

  const historyMessages = session.history.slice(-12).flatMap((item) => [
    { role: "user", content: item.user },
    { role: "assistant", content: item.assistant }
  ]);

  return [
    { role: "system", content: LOCKED_SYSTEM_PROMPT },
    { role: "system", content: stateSummary },
    ...historyMessages,
    { role: "user", content: userText }
  ];
}

async function askSarvam(session, userText, lang) {
  const payload = {
    model: "sarvam-m",
    messages: buildConversationMessages(session, userText, lang)
  };

  const res = await fetch("https://api.sarvam.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SARVAM_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log("Sarvam Response:", JSON.stringify(data, null, 2));

  const raw =
    data?.choices?.[0]?.message?.content ||
    (lang === "mr"
      ? "सध्या उत्तर उपलब्ध नाही."
      : "अभी जवाब उपलब्ध नहीं है।");

  return cleanFinalReply(raw, lang);
}

async function sendWhatsAppText(phoneNumberId, to, body) {
  const res = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
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
  });

  const data = await res.json();
  console.log("WhatsApp send response:", JSON.stringify(data, null, 2));
  return data;
}

/* ---------------- Routes ---------------- */

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

    const change = req.body?.entry?.[0]?.changes?.[0];
    const value = change?.value;
    const phoneNumberId = value?.metadata?.phone_number_id;

    // status updates only
    if (value?.statuses) {
      return res.sendStatus(200);
    }

    const message = value?.messages?.[0];
    const from = message?.from;
    const text = message?.text?.body?.trim();

    if (!text || !from || !phoneNumberId) {
      return res.sendStatus(200);
    }

    const session = getSession(from);
    session.lastUserMessageAt = Date.now();

    // अगर human agent ने reply किया हो पिछले 15 मिनट में तो AI silent
    if (
      session.lastHumanReplyAt &&
      Date.now() - session.lastHumanReplyAt < 15 * 60 * 1000
    ) {
      console.log("⏸ AI silent due to recent human reply");
      return res.sendStatus(200);
    }

    // state update
    const possibleCrop = extractCrop(text);
    const possibleWater = extractWaterLiters(text);

    if (possibleCrop && !session.crop) {
      session.crop = possibleCrop;
    }

    if (possibleWater && !session.waterLiters) {
      session.waterLiters = possibleWater;
    }

    const lang = detectLanguage(text);

    let finalReply = await askSarvam(session, text, lang);

    // अगर पहली बार welcome गया तो mark कर दो
    if (
      finalReply.includes("Primia Crop Care") ||
      finalReply.includes("आपका स्वागत") ||
      finalReply.includes("स्वागत है") ||
      finalReply.includes("आपले स्वागत")
    ) {
      session.welcomed = true;
    }

    // duplicate exact same assistant reply से बचाव
    const lastAssistant = session.history.length
      ? session.history[session.history.length - 1].assistant
      : null;

    if (lastAssistant && lastAssistant.trim() === finalReply.trim()) {
      if (!session.crop || !session.waterLiters) {
        finalReply = lang === "mr"
          ? "👉 कृपया तुमचे पीक कोणते आहे?\n👉 फवारणीत किती लिटर पाणी वापरता?"
          : "👉 आपकी फसल कौन सी है?\n👉 स्प्रे में कितने लीटर पानी इस्तेमाल करते हैं?";
      }
    }

    await sendWhatsAppText(phoneNumberId, from, finalReply);

    session.history.push({
      user: text,
      assistant: finalReply,
      at: Date.now()
    });

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
