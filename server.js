import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  try {
    const userMessage =
      req.body?.message ||
      req.body?.text ||
      req.body?.query ||
      "Hello";

    const sarvamResponse = await fetch(
      "https://api.sarvam.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.SARVAM_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "sarvam-m",
          messages: [
            { role: "user", content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 300
        })
      }
    );

    const data = await sarvamResponse.json();

    const reply =
      data?.choices?.[0]?.message?.content ||
      "Reply nahi mila";

    res.json({ reply });

  } catch (error) {
    res.json({ reply: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
