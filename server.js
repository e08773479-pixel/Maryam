require("dotenv").config();

const express = require("express");
const path = require("path");
const OpenAI = require("openai");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

app.disable("x-powered-by");

app.use(express.json({
  limit: "12mb"
}));

app.use(express.static(path.join(__dirname)));

function cleanMessages(input) {
  if (!Array.isArray(input)) return [];

  return input
    .slice(-24)
    .filter(message =>
      message &&
      ["user", "assistant"].includes(message.role) &&
      typeof message.content === "string" &&
      message.content.length <= 30000
    )
    .map(message => {
      const clean = {
        role: message.role,
        content: message.content
      };

      if (
        message.role === "user" &&
        typeof message.imageData === "string" &&
        /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(message.imageData)
      ) {
        clean.content = [
          {
            type: "text",
            text: message.content || "حلل الصورة المرفقة."
          },
          {
            type: "image_url",
            image_url: {
              url: message.imageData
            }
          }
        ];
      }

      return clean;
    });
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "MIKA CHAT",
    configured: Boolean(process.env.OPENAI_API_KEY),
    model: MODEL
  });
});

app.post("/api/chat", async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: "مفتاح API مش مضبوط. أضف OPENAI_API_KEY في ملف .env ثم أعد تشغيل الخادم."
    });
  }

  const messages = cleanMessages(req.body?.messages);

  if (!messages.length) {
    return res.status(400).json({
      error: "اكتب رسالة الأول."
    });
  }

  const mode = ["auto", "fast", "reasoning"].includes(req.body?.mode)
    ? req.body.mode
    : "auto";

  let model = MODEL;

  if (mode === "fast") {
    model = process.env.OPENAI_FAST_MODEL || MODEL;
  }

  if (mode === "reasoning") {
    model = process.env.OPENAI_REASONING_MODEL || MODEL;
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "أنت MIKA CHAT، مساعد ذكي مفيد ودقيق. أجب بلغة المستخدم، واستخدم العربية المصرية عندما يكتب بها. نظّم الإجابات بعناوين وخطوات عند الحاجة. إذا لم تكن متأكدًا فوضّح ذلك، ولا تدّعِ أنك بحثت على الإنترنت أو نفذت إجراءً لم تنفذه."
        },
        ...messages
      ],
      temperature: 0.7
    });

    const reply = response.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error("النموذج لم يُرجع نصًا.");
    }

    res.json({
      reply,
      model: response.model || model
    });

  } catch (error) {
    console.error(
      "MIKA API error:",
      error?.status || "",
      error?.message || error
    );

    let message = "تعذر الحصول على إجابة من مزود الذكاء الاصطناعي.";

    if (error?.status === 401) {
      message = "مفتاح API غير صحيح أو غير مصرح له.";
    } else if (error?.status === 429) {
      message = "تم تجاوز حد الاستخدام أو الرصيد المتاح في حساب API.";
    } else if (error?.status === 404) {
      message = "اسم النموذج غير متاح لحسابك. غيّر OPENAI_MODEL في .env إلى نموذج متاح.";
    }

    res.status(502).json({ error: message });
  }
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`MIKA CHAT is running at http://localhost:${PORT}`);
});
