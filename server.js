import express from "express";
const app = express();

app.use(express.json()); // 🔴 बहुत जरूरी

app.post("/webhook", (req, res) => {
  console.log("Webhook HIT");
  console.log(req.body);

  res.json({
    reply: "Sarvam AI se reply aa raha hai ✅"
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
