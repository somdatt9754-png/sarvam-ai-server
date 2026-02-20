import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  try {
    // 1️⃣ Log incoming BotBee JSON
    console.log("BotBee JSON:", JSON.stringify(req.body, null, 2));

    // 2️⃣ User message extract
    const userMessage =
      req.body?.message ||
      req.body?.text ||
      req.body?.payload?.text;

    if (!userMessage) {
      return res.json({ reply: "कृपया अपना सवाल लिखें।" });
    }

    // 3️⃣ Sarvam AI payload
    const sarvamPayload = {
      model: "sarvam-m",
      messages: [
        {
          role: "user",
          content: userMessage
        }
      ]
    };

    // 4️⃣ Call Sarvam AI
    const sarvamRes = await fetch(
      "https://api.sarvam.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.SARVAM_API_KEY}`
        },
        body: JSON.stringify(sarvamPayload)
      }
    );

    const sarvamData = await sarvamRes.json();
    console.log("Sarvam Response:", sarvamData);

    // 5️⃣ Extract Sarvam reply text
    const sarvamReply =
      sarvamData?.choices?.[0]?.message?.content ||
      "अभी जवाब उपलब्ध नहीं है।";

    // 6️⃣ FINAL response to BotBee
    return res.json({
      reply: sarvamReply
    });

  } catch (err) {
    console.error("Webhook Error:", err);
    return res.json({
      reply: "सर्वर में समस्या है, थोड़ी देर बाद कोशिश करें।"
    });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
