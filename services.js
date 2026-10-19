const MikaServices = (() => {
"use strict";

const CONFIG = Object.freeze({
API_BASE_URL: "/api",
CHAT_ENDPOINT: "/chat",
REQUEST_TIMEOUT: 120000,
MAX_MESSAGE_LENGTH: 30000,
MAX_HISTORY_MESSAGES: 40,
MAX_FILES: 5,
MAX_FILE_SIZE: 10 * 1024 * 1024
});

class MikaError extends Error {
constructor(message, code = "MIKA_ERROR", status = 0) {
super(message);
this.name = "MikaError";
this.code = code;
this.status = status;
}
}

function getEndpoint(path) {
const base = CONFIG.API_BASE_URL.replace(//+$/, "");
const endpoint = String(path).replace(/^/+/, "");
return "${base}/${endpoint}";
}

function validateMessage(message) {
if (typeof message !== "string") {
throw new MikaError("الرسالة المرسلة غير صالحة.", "INVALID_MESSAGE");
}

const value = message.trim();

if (!value) {
  throw new MikaError("اكتب رسالتك الأول.", "EMPTY_MESSAGE");
}

if (value.length > CONFIG.MAX_MESSAGE_LENGTH) {
  throw new MikaError(
    "الرسالة طويلة جدًا. اختصرها وحاول مرة تانية.",
    "MESSAGE_TOO_LONG"
  );
}

return value;

}

function normalizeHistory(history) {
if (!Array.isArray(history)) {
return [];
}

return history
  .slice(-CONFIG.MAX_HISTORY_MESSAGES)
  .filter(item => {
    return (
      item &&
      typeof item.content === "string" &&
      ["user", "assistant"].includes(item.role)
    );
  })
  .map(item => ({
    role: item.role,
    content: item.content.slice(0, CONFIG.MAX_MESSAGE_LENGTH)
  }));

}

function validateFiles(files) {
if (!Array.isArray(files)) {
return [];
}

if (files.length > CONFIG.MAX_FILES) {
  throw new MikaError(
    `مسموح بإرفاق ${CONFIG.MAX_FILES} ملفات فقط في الرسالة الواحدة.`,
    "TOO_MANY_FILES"
  );
}

for (const file of files) {
  if (!(file instanceof File)) {
    throw new MikaError(
      "أحد المرفقات غير صالح.",
      "INVALID_FILE"
    );
  }

  if (file.size > CONFIG.MAX_FILE_SIZE) {
    throw new MikaError(
      `الملف "${file.name}" أكبر من الحد المسموح، وهو 10 ميجابايت.`,
      "FILE_TOO_LARGE"
    );
  }
}

return files;

}

async function request(path, payload, options = {}) {
const controller = new AbortController();

const timeout = setTimeout(() => {
  controller.abort();
}, CONFIG.REQUEST_TIMEOUT);

if (options.signal) {
  if (options.signal.aborted) {
    controller.abort();
  } else {
    options.signal.addEventListener(
      "abort",
      () => controller.abort(),
      { once: true }
    );
  }
}

try {
  const response = await fetch(getEndpoint(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    credentials: "same-origin",
    cache: "no-store",
    signal: controller.signal,
    body: JSON.stringify(payload)
  });

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new MikaError(
      "الخادم رجّع استجابة غير متوقعة. تأكد إن خدمة MIKA CHAT متوصلة صح.",
      "INVALID_SERVER_RESPONSE",
      response.status
    );
  }

  const data = await response.json();

  if (!response.ok) {
    const message =
      typeof data.message === "string"
        ? data.message
        : "حصلت مشكلة أثناء الاتصال بالخادم.";

    throw new MikaError(
      message,
      data.code || "SERVER_ERROR",
      response.status
    );
  }

  return data;
} catch (error) {
  if (error instanceof MikaError) {
    throw error;
  }

  if (error.name === "AbortError") {
    throw new MikaError(
      "انتهى وقت الانتظار أو تم إلغاء الطلب. حاول تاني.",
      "REQUEST_ABORTED"
    );
  }

  if (error instanceof TypeError) {
    throw new MikaError(
      "مش قادرين نوصل لخادم MIKA CHAT حاليًا. تأكد إن الخادم شغال وإن اتصال الإنترنت متاح.",
      "NETWORK_ERROR"
    );
  }

  throw new MikaError(
    "حصل خطأ غير متوقع أثناء إرسال الرسالة.",
    "UNKNOWN_ERROR"
  );
} finally {
  clearTimeout(timeout);
}

}

async function chat(options = {}) {
const message = validateMessage(options.message || "");
const history = normalizeHistory(options.history || []);
const files = validateFiles(options.files || []);

const attachments = [];

for (const file of files) {
  attachments.push({
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size
  });
}

const payload = {
  message,
  history,
  conversationId:
    typeof options.conversationId === "string"
      ? options.conversationId
      : null,
  options: {
    webSearch: Boolean(options.webSearch),
    attachments
  }
};

const data = await request(
  CONFIG.CHAT_ENDPOINT,
  payload,
  { signal: options.signal }
);

if (
  !data ||
  typeof data.reply !== "string" ||
  !data.reply.trim()
) {
  throw new MikaError(
    "الخادم استجاب، لكن الرد المستلم غير صالح.",
    "INVALID_AI_REPLY"
  );
}

return {
  reply: data.reply,
  conversationId:
    typeof data.conversationId === "string"
      ? data.conversationId
      : payload.conversationId,
  sources: Array.isArray(data.sources) ? data.sources : [],
  usage: data.usage || null
};

}

async function checkHealth() {
const controller = new AbortController();

const timeout = setTimeout(() => {
  controller.abort();
}, 10000);

try {
  const response = await fetch(getEndpoint("health"), {
    method: "GET",
    headers: {
      "Accept": "application/json"
    },
    credentials: "same-origin",
    cache: "no-store",
    signal: controller.signal
  });

  if (!response.ok) {
    return {
      online: false,
      message: "خدمة الذكاء الاصطناعي غير متاحة حاليًا."
    };
  }

  const data = await response.json();

  return {
    online: data.status === "ok",
    message:
      data.status === "ok"
        ? "الاتصال بالخادم ناجح."
        : "الخادم موجود، لكن الخدمة غير جاهزة."
  };
} catch {
  return {
    online: false,
    message: "تعذر الاتصال بالخادم."
  };
} finally {
  clearTimeout(timeout);
}

}

return Object.freeze({
chat,
checkHealth,
MikaError,
CONFIG
});
})();

window.MikaServices = MikaServices;
