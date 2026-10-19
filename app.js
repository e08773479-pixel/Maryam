(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const config = window.MIKA_CONFIG || {
    apiEndpoint: "/api/chat",
    maxImageSizeMB: 8,
    maxHistoryMessages: 24
  };

  const STORAGE_KEY = "mika-chat-conversations-v1";
  const THEME_KEY = "mika-chat-theme-v1";

  let conversations = [];
  let activeId = null;
  let pendingImage = null;
  let isSending = false;
  let abortController = null;
  let selectedMode = "auto";
  let recognition = null;

  const els = {
    sidebar: $("#sidebar"),
    history: $("#chatHistory"),
    welcome: $("#welcome"),
    messages: $("#messages"),
    input: $("#promptInput"),
    send: $("#sendButton"),
    attachmentPreview: $("#attachmentPreview"),
    imageInput: $("#imageInput"),
    toastRegion: $("#toastRegion"),
    modelMenu: $("#modelMenu"),
    modelLabel: $("#modelLabel"),
    settingsModal: $("#settingsModal"),
    themeSelect: $("#themeSelect"),
    saveChats: $("#saveChats")
  };

  function makeId() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function toast(message) {
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    els.toastRegion.append(node);

    setTimeout(() => node.remove(), 3200);
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      conversations = Array.isArray(parsed) ? parsed : [];
    } catch {
      conversations = [];
    }

    const theme = localStorage.getItem(THEME_KEY) || "dark";
    applyTheme(theme);

    els.saveChats.checked = localStorage.getItem("mika-save-chats") !== "false";

    renderHistory();

    if (conversations.length) {
      openConversation(conversations[0].id);
    } else {
      showWelcome();
    }
  }

  function persist() {
    if (!els.saveChats.checked) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      toast("مساحة التخزين ممتلئة؛ صدّر محادثاتك أو امسح بعضها.");
    }
  }

  function activeConversation() {
    return conversations.find(item => item.id === activeId);
  }

  function createConversation() {
    const chat = {
      id: makeId(),
      title: "محادثة جديدة",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };

    conversations.unshift(chat);
    activeId = chat.id;

    persist();
    renderHistory();
    showWelcome();
    closeSidebarMobile();
    els.input.focus();
  }

  function showWelcome() {
    els.welcome.classList.remove("hidden");
    els.messages.classList.add("hidden");
    els.messages.replaceChildren();
  }

  function openConversation(chatId) {
    const chat = conversations.find(item => item.id === chatId);
    if (!chat) return;

    activeId = chat.id;
    els.welcome.classList.add("hidden");
    els.messages.classList.remove("hidden");
    els.messages.replaceChildren();

    chat.messages.forEach(message => {
      appendMessage(message.role, message.content, {
        imageData: message.imageData,
        skipAction: message.role === "user"
      });
    });

    renderHistory();
    closeSidebarMobile();
    scrollBottom();
  }

  function renderHistory() {
    els.history.replaceChildren();

    if (!conversations.length) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = "محادثاتك الجديدة هتظهر هنا.";
      els.history.append(empty);
      return;
    }

    conversations.slice(0, 80).forEach(chat => {
      const row = document.createElement("button");
      row.className = `history-item${chat.id === activeId ? " active" : ""}`;
      row.type = "button";

      const title = document.createElement("span");
      title.className = "history-title";
      title.textContent = chat.title || "محادثة جديدة";

      const del = document.createElement("span");
      del.className = "delete-one";
      del.textContent = "×";
      del.title = "حذف المحادثة";

      del.addEventListener("click", event => {
        event.stopPropagation();
        deleteConversation(chat.id);
      });

      row.append(title, del);
      row.addEventListener("click", () => openConversation(chat.id));
      els.history.append(row);
    });
  }

  function deleteConversation(chatId) {
    conversations = conversations.filter(chat => chat.id !== chatId);

    if (activeId === chatId) {
      activeId = null;

      if (conversations.length) {
        openConversation(conversations[0].id);
      } else {
        showWelcome();
      }
    }

    persist();
    renderHistory();
  }

  function appendMessage(role, content, options = {}) {
    const wrap = document.createElement("article");
    wrap.className = `message ${role === "user" ? "user" : "assistant"}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "م" : "m";

    const body = document.createElement("div");
    body.className = "message-body";

    const contentNode = document.createElement("div");
    contentNode.className = "message-content";

    if (options.typing) {
      contentNode.innerHTML =
        '<div class="typing-dots"><span></span><span></span><span></span></div>';

      wrap.dataset.typing = "true";
    } else {
      contentNode.innerHTML = renderMarkdown(content || "");

      if (options.imageData) {
        const img = document.createElement("img");
        img.src = options.imageData;
        img.alt = "الصورة المرفقة";
        img.style.cssText =
          "max-width:240px;max-height:220px;display:block;border-radius:10px;margin-top:8px";

        contentNode.append(img);
      }
    }

    body.append(contentNode);

    if (!options.typing && role === "assistant" && !options.skipAction) {
      const actions = document.createElement("div");
      actions.className = "message-actions";
      actions.innerHTML =
        '<button data-act="copy">نسخ</button>' +
        '<button data-act="speak">استماع</button>' +
        '<button data-act="regenerate">إعادة الإجابة</button>';

      actions.addEventListener("click", event => {
        const button = event.target.closest("button");
        if (!button) return;

        if (button.dataset.act === "copy") {
          copyText(content).then(() => toast("اتنسخ الرد."));
        }

        if (button.dataset.act === "speak") speak(content);

        if (button.dataset.act === "regenerate") regenerate();
      });

      body.append(actions);
    }

    wrap.append(avatar, body);
    els.messages.append(wrap);

    return wrap;
  }

  function renderMarkdown(text) {
    const escaped = escapeHTML(text);
    const codeBlocks = [];

    let output = escaped.replace(
      /```([\w-]*)\n?([\s\S]*?)```/g,
      (_, language, code) => {
        const token = `MIKACODEBLOCK${codeBlocks.length}TOKEN`;
        codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
        return token;
      }
    );

    output = output
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/^\s*[-*] (.+)$/gm, "• $1")
      .replace(/\n/g, "<br>");

    codeBlocks.forEach((block, index) => {
      output = output.replace(`MIKACODEBLOCK${index}TOKEN`, block);
    });

    return output
      .split(/<br><br>/)
      .map(part => part.trim() ? `<p>${part}</p>` : "")
      .join("");
  }

  function scrollBottom() {
    requestAnimationFrame(() => {
      const conversation = $(".conversation");
      conversation.scrollTop = conversation.scrollHeight;
    });
  }

  function setBusy(busy) {
    isSending = busy;

    els.send.textContent = busy ? "■" : "↑";
    els.send.title = busy ? "إيقاف الرد" : "إرسال الرسالة";
    els.send.setAttribute(
      "aria-label",
      busy ? "إيقاف الرد" : "إرسال الرسالة"
    );

    els.input.disabled = busy;
  }

  async function sendMessage(overrideText) {
    if (isSending) {
      abortController?.abort();
      return;
    }

    const text = (overrideText ?? els.input.value).trim();

    if (!text && !pendingImage) return;

    if (!activeConversation()) createConversation();

    const chat = activeConversation();
    const imageData = pendingImage?.data || null;

    const userMessage = {
      role: "user",
      content: text || "حلّل الصورة المرفقة.",
      ...(imageData ? { imageData } : {})
    };

    chat.messages.push(userMessage);

    if (chat.title === "محادثة جديدة") {
      chat.title = (text || "صورة مرفقة").slice(0, 36);
    }

    chat.updatedAt = Date.now();
    persist();

    els.welcome.classList.add("hidden");
    els.messages.classList.remove("hidden");

    appendMessage("user", userMessage.content, { imageData });

    els.input.value = "";
    autoResize();
    clearAttachment();
    renderHistory();
    scrollBottom();

    const typing = appendMessage("assistant", "", { typing: true });
    scrollBottom();

    setBusy(true);
    abortController = new AbortController();

    try {
      const history = chat.messages
        .slice(-config.maxHistoryMessages)
        .map(message => ({
          role: message.role,
          content: message.content,
          ...(message.imageData ? { imageData: message.imageData } : {})
        }));

      const response = await fetch(config.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          mode: selectedMode
        }),
        signal: abortController.signal
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `حصل خطأ من الخادم (${response.status}).`);
      }

      const answer = data.reply || data.output || "وصل رد فارغ من الخدمة.";

      typing.remove();

      chat.messages.push({
        role: "assistant",
        content: answer
      });

      chat.updatedAt = Date.now();

      persist();
      appendMessage("assistant", answer);
      renderHistory();
      scrollBottom();

    } catch (error) {
      typing.remove();

      if (error.name === "AbortError") {
        toast("تم إيقاف الطلب.");
      } else {
        appendMessage(
          "assistant",
          `**مش قادر أوصل لخدمة الذكاء الاصطناعي.**\n\n${error.message}\n\nتأكد إن الخادم شغال وإن مفتاح API مضبوط في ملف البيئة \`.env\`.`
        );

        toast("راجع اتصال الخادم وإعدادات API.");
      }

      scrollBottom();

    } finally {
      setBusy(false);
      abortController = null;
    }
  }

  function autoResize() {
    els.input.style.height = "auto";
    els.input.style.height = `${Math.min(els.input.scrollHeight, 180)}px`;
  }

  function clearAttachment() {
    pendingImage = null;
    els.attachmentPreview.classList.add("hidden");
    els.attachmentPreview.replaceChildren();
    els.imageInput.value = "";
  }

  function applyTheme(theme) {
    let actual = theme;

    if (theme === "system") {
      actual = matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    }

    document.body.classList.toggle("light", actual === "light");

    localStorage.setItem(THEME_KEY, theme);
    els.themeSelect.value = theme;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      return toast("ميزة القراءة الصوتية مش مدعومة في المتصفح ده.");
    }

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-EG";
    speechSynthesis.speak(utterance);
  }

  async function regenerate() {
    const chat = activeConversation();

    if (!chat || isSending) return;

    const lastAssistantIndex = chat.messages
      .map(message => message.role)
      .lastIndexOf("assistant");

    if (lastAssistantIndex >= 0) {
      chat.messages.splice(lastAssistantIndex, 1);
    }

    persist();
    openConversation(chat.id);

    await requestAnswer(chat);
  }

  async function requestAnswer(chat) {
    const typing = appendMessage("assistant", "", { typing: true });

    setBusy(true);
    abortController = new AbortController();

    try {
      const response = await fetch(config.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chat.messages.slice(-config.maxHistoryMessages),
          mode: selectedMode
        }),
        signal: abortController.signal
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "تعذر إعادة الإجابة.");
      }

      typing.remove();

      const answer = data.reply || data.output || "";
      chat.messages.push({ role: "assistant", content: answer });

      persist();
      appendMessage("assistant", answer);
      scrollBottom();

    } catch (error) {
      typing.remove();
      appendMessage("assistant", `تعذر إعادة الإجابة: ${error.message}`);

    } finally {
      setBusy(false);
      abortController = null;
    }
  }

  function closeSidebarMobile() {
    if (innerWidth <= 760) {
      els.sidebar.classList.remove("open");
    }
  }

  function exportChats() {
    const blob = new Blob(
      [JSON.stringify({
        app: "MIKA CHAT",
        version: 1,
        exportedAt: new Date().toISOString(),
        conversations
      }, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "mika-chat-conversations.json";
    anchor.click();

    URL.revokeObjectURL(url);
    toast("تم تجهيز ملف التصدير.");
  }

  $("#newChat").addEventListener("click", createConversation);

  $("#sendButton").addEventListener("click", () => sendMessage());

  els.input.addEventListener("input", autoResize);

  els.input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  $$(".suggestion-card").forEach(button => {
    button.addEventListener("click", () => {
      els.input.value = button.dataset.prompt;
      autoResize();
      els.input.focus();
    });
  });

  $("#openSidebar").addEventListener("click", () => {
    els.sidebar.classList.add("open");
  });

  $("#closeSidebar").addEventListener("click", closeSidebarMobile);

  $("#themeToggle").addEventListener("click", () => {
    applyTheme(document.body.classList.contains("light") ? "dark" : "light");
  });

  $("#modelPicker").addEventListener("click", () => {
    els.modelMenu.classList.toggle("hidden");
  });

  $$("#modelMenu button").forEach(button => {
    button.addEventListener("click", () => {
      selectedMode = button.dataset.model;

      els.modelLabel.textContent = button
        .querySelector("b")
        .textContent
        .replace(/^[✳ϟ◈]\s*/, "");

      els.modelMenu.classList.add("hidden");

      toast("تم تغيير وضع الواجهة. النموذج الفعلي يتحدد من إعدادات الخادم.");
    });
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".model-picker-wrap")) {
      els.modelMenu.classList.add("hidden");
    }
  });

  $("#settingsButton").addEventListener("click", () => {
    els.settingsModal.classList.remove("hidden");
  });

  $("#closeSettings").addEventListener("click", () => {
    els.settingsModal.classList.add("hidden");
  });

  $("#doneSettings").addEventListener("click", () => {
    els.settingsModal.classList.add("hidden");
  });

  els.settingsModal.addEventListener("click", event => {
    if (event.target === els.settingsModal) {
      els.settingsModal.classList.add("hidden");
    }
  });

  els.themeSelect.addEventListener("change", () => {
    applyTheme(els.themeSelect.value);
  });

  els.saveChats.addEventListener("change", () => {
    localStorage.setItem("mika-save-chats", String(els.saveChats.checked));

    if (!els.saveChats.checked) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      persist();
    }

    toast(
      els.saveChats.checked
        ? "الحفظ المحلي اتفعّل."
        : "الحفظ المحلي اتوقف واتمسح السجل المحفوظ."
    );
  });

  $("#exportChats").addEventListener("click", exportChats);

  $("#clearHistory").addEventListener("click", () => {
    if (!conversations.length) {
      return toast("سجل المحادثات فاضي.");
    }

    if (confirm("متأكد إنك عايز تمسح كل المحادثات المحفوظة؟")) {
      conversations = [];
      activeId = null;
      persist();
      renderHistory();
      showWelcome();
      toast("تم مسح المحادثات.");
    }
  });

  els.imageInput.addEventListener("change", async () => {
    const file = els.imageInput.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return toast("اختار ملف صورة صالح.");
    }

    if (file.size > config.maxImageSizeMB * 1024 * 1024) {
      els.imageInput.value = "";
      return toast(`حجم الصورة لازم يكون أقل من ${config.maxImageSizeMB} ميجابايت.`);
    }

    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    pendingImage = { data, name: file.name };

    const img = document.createElement("img");
    img.src = data;
    img.alt = "";

    const name = document.createElement("span");
    name.textContent = file.name;

    const remove = document.createElement("button");
    remove.textContent = "×";
    remove.setAttribute("aria-label", "إزالة الصورة");
    remove.onclick = clearAttachment;

    els.attachmentPreview.replaceChildren(img, name, remove);
    els.attachmentPreview.classList.remove("hidden");
  });

  $("#voiceInput").addEventListener("click", () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return toast("الإملاء الصوتي مش مدعوم في المتصفح ده. جرّب Chrome.");
    }

    if (recognition) {
      recognition.stop();
      recognition = null;
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = "ar-EG";
    recognition.interimResults = true;

    recognition.onresult = event => {
      let transcript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      els.input.value = transcript;
      autoResize();
    };

    recognition.onerror = () => toast("ما قدرناش نسمع الكلام بوضوح.");
    recognition.onend = () => { recognition = null; };

    recognition.start();
    toast("اتكلم دلوقتي...");
  });

  $("#shareButton").addEventListener("click", async () => {
    const chat = activeConversation();

    if (!chat || !chat.messages.length) {
      return toast("ابدأ محادثة الأول علشان تشاركها.");
    }

    const text = chat.messages
      .map(message => `${message.role === "user" ? "أنت" : "MIKA"}: ${message.content}`)
      .join("\n\n");

    if (navigator.share) {
      try {
        await navigator.share({ title: chat.title, text });
      } catch {}
    } else {
      await copyText(text);
      toast("نسخت المحادثة؛ تقدر تبعتها لأي حد.");
    }
  });

  $$("[data-action]").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.action === "image") {
        toast("توليد الصور يحتاج ربط مزوّد توليد صور.");
      }

      if (button.dataset.action === "voice") {
        toast("المتاح حاليًا الإملاء الصوتي وقراءة الرد؛ الصوت المباشر يحتاج خدمة إضافية.");
      }
    });
  });

  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      createConversation();
    }

    if (event.key === "Escape") {
      els.settingsModal.classList.add("hidden");
      closeSidebarMobile();
      els.modelMenu.classList.add("hidden");
    }
  });

  load();
})();
