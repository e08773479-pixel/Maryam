"use strict";

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const elements = {
    body: document.body,
    newChat: $("#newChat"),
    searchChats: $("#searchChats"),
    historyList: $("#historyList"),
    historyEmpty: $("#historyEmpty"),
    historyCount: $("#historyCount"),
    promptInput: $("#promptInput"),
    sendButton: $("#sendButton"),
    welcomeScreen: $("#welcomeScreen"),
    messagesContainer: $("#messagesContainer"),
    messagesList: $("#messagesList"),
    themeToggle: $("#themeToggle"),
    openSettings: $("#openSettings"),
    openPlans: $("#openPlans"),
    closeModal: $("#closeModal"),
    modalBackdrop: $("#modalBackdrop"),
    modalTitle: $("#modalTitle"),
    modalBody: $("#modalBody"),
    openSidebar: $("#openSidebar"),
    closeSidebar: $("#closeSidebar"),
    mobileOverlay: $("#mobileOverlay"),
    attachButton: $("#attachButton"),
    fileInput: $("#fileInput"),
    attachmentPreview: $("#attachmentPreview"),
    webSearchButton: $("#webSearchButton"),
    voiceButton: $("#voiceButton"),
    charCounter: $("#charCounter"),
    shareChat: $("#shareChat"),
    serviceNotice: $("#serviceNotice"),
    toastContainer: $("#toastContainer")
  };

  const STORAGE_KEY = "mika_chat_conversations_v1";
  const SETTINGS_KEY = "mika_chat_settings_v1";
  const MAX_CONVERSATIONS = 100;
  const MAX_MESSAGE_LENGTH = 12000;
  const MAX_FILES = 5;
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  let conversations = [];
  let activeConversationId = null;
  let pendingFiles = [];
  let webSearchEnabled = false;
  let recognition = null;
  let isListening = false;
  let isSending = false;
  let toastSequence = 0;

  const defaultSettings = {
    theme: "dark",
    displayName: "ضيف ميكا"
  };

  let settings = { ...defaultSettings };

  function makeId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }

    return "mika-" + Date.now().toString(36) + "-" +
      Math.random().toString(36).slice(2, 10);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat("ar-EG", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function showToast(message, type = "normal", duration = 3200) {
    const toast = document.createElement("div");
    toast.className = "toast" + (type === "normal" ? "" : " " + type);
    toast.textContent = message;
    toast.dataset.toastId = String(++toastSequence);

    elements.toastContainer.appendChild(toast);

    window.setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(6px)";

      window.setTimeout(() => toast.remove(), 220);
    }, duration);
  }

  function setServiceNotice(message = "") {
    elements.serviceNotice.textContent = message;
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");

      if (saved && typeof saved === "object") {
        settings = {
          ...defaultSettings,
          ...saved
        };
      }
    } catch {
      settings = { ...defaultSettings };
    }

    applyTheme(false);
    updateProfile();
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      showToast("تعذر حفظ الإعدادات على هذا الجهاز.", "error");
    }
  }

  function applyTheme(showMessage = false) {
    const light = settings.theme === "light";

    elements.body.classList.toggle("light-theme", light);

    const metaTheme = $('meta[name="theme-color"]');

    if (metaTheme) {
      metaTheme.content = light ? "#f4f6fc" : "#080b14";
    }

    if (showMessage) {
      showToast(light ? "تم تفعيل المظهر الفاتح." : "تم تفعيل المظهر الداكن.", "success");
    }
  }

  function updateProfile() {
    const name = String(settings.displayName || "ضيف ميكا").trim() || "ضيف ميكا";
    const nameElement = $(".profile-info strong");
    const avatarElement = $(".profile-button .avatar");

    if (nameElement) {
      nameElement.textContent = name;
    }

    if (avatarElement) {
      avatarElement.textContent = Array.from(name)[0] || "M";
    }
  }

  function normalizeConversation(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    if (typeof raw.id !== "string" || !Array.isArray(raw.messages)) {
      return null;
    }

    const messages = raw.messages
      .filter(message =>
        message &&
        typeof message.id === "string" &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string"
      )
      .map(message => ({
        id: message.id,
        role: message.role,
        content: message.content.slice(0, MAX_MESSAGE_LENGTH),
        timestamp: Number(message.timestamp) || Date.now(),
        attachments: Array.isArray(message.attachments)
          ? message.attachments
              .filter(file => file && typeof file.name === "string")
              .slice(0, MAX_FILES)
              .map(file => ({
                name: file.name.slice(0, 240),
                size: Number(file.size) || 0,
                type: String(file.type || "").slice(0, 120)
              }))
          : [],
        webSearch: Boolean(message.webSearch)
      }));

    return {
      id: raw.id,
      title: typeof raw.title === "string"
        ? raw.title.slice(0, 100)
        : "محادثة جديدة",
      createdAt: Number(raw.createdAt) || Date.now(),
      updatedAt: Number(raw.updatedAt) || Date.now(),
      messages
    };
  }

  function loadConversations() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

      conversations = Array.isArray(saved)
        ? saved.map(normalizeConversation).filter(Boolean).slice(0, MAX_CONVERSATIONS)
        : [];
    } catch {
      conversations = [];
    }

    conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    renderHistory();
  }

  function saveConversations() {
    try {
      const compact = conversations.slice(0, MAX_CONVERSATIONS);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));

      return true;
    } catch {
      showToast(
        "مساحة التخزين المحلية قد تكون ممتلئة. جرّب حذف محادثات قديمة.",
        "error",
        4500
      );

      return false;
    }
  }

  function getActiveConversation() {
    return conversations.find(item => item.id === activeConversationId) || null;
  }

  function createConversation() {
    if (conversations.length >= MAX_CONVERSATIONS) {
      showToast("وصلت للحد المحلي للمحادثات. احذف محادثة قديمة أولًا.", "error");
      return null;
    }

    const conversation = {
      id: makeId(),
      title: "محادثة جديدة",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };

    conversations.unshift(conversation);
    activeConversationId = conversation.id;

    saveConversations();
    renderHistory();
    renderActiveConversation();
    closeSidebar();

    elements.promptInput.focus();

    return conversation;
  }

  function getOrCreateConversation() {
    return getActiveConversation() || createConversation();
  }

  function makeConversationTitle(content) {
    const normalized = String(content || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized) {
      return "محادثة جديدة";
    }

    return normalized.length > 38
      ? normalized.slice(0, 38).trim() + "…"
      : normalized;
  }

  function renderHistory() {
    const query = elements.searchChats.value.trim().toLocaleLowerCase("ar");
    const visibleConversations = conversations.filter(conversation => {
      if (!query) {
        return true;
      }

      return conversation.title.toLocaleLowerCase("ar").includes(query) ||
        conversation.messages.some(message =>
          message.content.toLocaleLowerCase("ar").includes(query)
        );
    });

    elements.historyCount.textContent = String(conversations.length);

    const existingEmpty = elements.historyList.querySelector(".history-empty");
    if (existingEmpty) {
      existingEmpty.remove();
    }

    elements.historyList.replaceChildren();

    if (visibleConversations.length === 0) {
      const empty = document.createElement("div");
      empty.className = "history-empty";

      const icon = document.createElement("span");
      icon.className = "empty-history-icon";
      icon.textContent = query ? "⌕" : "◷";

      const title = document.createElement("p");
      title.textContent = query ? "مفيش نتائج مطابقة" : "محادثاتك هتظهر هنا";

      const description = document.createElement("small");
      description.textContent = query
        ? "جرّب كلمات بحث مختلفة."
        : "ابدأ محادثة جديدة علشان تنطلق.";

      empty.append(icon, title, description);
      elements.historyList.appendChild(empty);
      return;
    }

    visibleConversations.forEach(conversation => {
      const row = document.createElement("div");
      row.className = "history-item" +
        (conversation.id === activeConversationId ? " active" : "");
      row.dataset.conversationId = conversation.id;

      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("viewBox", "0 0 24 24");
      icon.innerHTML = '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8v.5Z"/>';

      const title = document.createElement("span");
      title.className = "history-item-title";
      title.textContent = conversation.title;

      const deleteButton = document.createElement("button");
      deleteButton.className = "history-delete";
      deleteButton.type = "button";
      deleteButton.textContent = "×";
      deleteButton.title = "حذف المحادثة";
      deleteButton.setAttribute("aria-label", "حذف المحادثة");

      deleteButton.addEventListener("click", event => {
        event.stopPropagation();
        deleteConversation(conversation.id);
      });

      row.append(icon, title, deleteButton);

      row.addEventListener("click", () => {
        openConversation(conversation.id);
      });

      elements.historyList.appendChild(row);
    });
  }

  function openConversation(id) {
    const conversation = conversations.find(item => item.id === id);

    if (!conversation) {
      showToast("المحادثة المطلوبة مش موجودة.", "error");
      return;
    }

    activeConversationId = id;

    renderHistory();
    renderActiveConversation();
    closeSidebar();
  }

  function deleteConversation(id) {
    const conversation = conversations.find(item => item.id === id);

    if (!conversation) {
      return;
    }

    const confirmed = window.confirm(
      `هل تريد حذف المحادثة "${conversation.title}"؟`
    );

    if (!confirmed) {
      return;
    }

    conversations = conversations.filter(item => item.id !== id);

    if (activeConversationId === id) {
      activeConversationId = null;
    }

    saveConversations();
    renderHistory();
    renderActiveConversation();

    showToast("تم حذف المحادثة من التخزين المحلي.", "success");
  }

  function clearMessages() {
    elements.messagesList.replaceChildren();
  }

  function renderActiveConversation() {
    const conversation = getActiveConversation();

    if (!conversation || conversation.messages.length === 0) {
      elements.welcomeScreen.classList.remove("hidden");
      elements.messagesContainer.classList.add("hidden");
      clearMessages();
      return;
    }

    elements.welcomeScreen.classList.add("hidden");
    elements.messagesContainer.classList.remove("hidden");

    clearMessages();

    conversation.messages.forEach(message => {
      renderMessage(message, false);
    });

    scrollMessagesToBottom();
  }

  function renderMessage(message, shouldScroll = true) {
    const row = document.createElement("article");
    row.className = "message " + message.role;
    row.dataset.messageId = message.id;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = message.role === "assistant" ? "M" : (
      Array.from(settings.displayName || "M")[0] || "M"
    );

    const body = document.createElement("div");
    body.className = "message-body";

    const heading = document.createElement("div");
    heading.className = "message-heading";

    const name = document.createElement("strong");
    name.textContent = message.role === "assistant"
      ? "ميكا شات"
      : (settings.displayName || "أنت");

    const time = document.createElement("time");
    time.textContent = formatTime(message.timestamp);
    time.dateTime = new Date(message.timestamp).toISOString();

    heading.append(name, time);

    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent = message.content;

    body.append(heading, content);

    if (message.attachments && message.attachments.length) {
      const attachments = document.createElement("div");
      attachments.className = "message-attachments";

      message.attachments.forEach(file => {
        const chip = document.createElement("div");
        chip.className = "message-attachment";

        const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        icon.setAttribute("viewBox", "0 0 24 24");
        icon.innerHTML = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>';

        const filename = document.createElement("span");
        filename.textContent = file.name;

        chip.append(icon, filename);
        attachments.appendChild(chip);
      });

      body.appendChild(attachments);
    }

    if (message.role === "assistant") {
      const actions = document.createElement("div");
      actions.className = "message-actions";

      const copy = document.createElement("button");
      copy.className = "message-action";
      copy.type = "button";
      copy.title = "نسخ الرد";
      copy.setAttribute("aria-label", "نسخ الرد");
      copy.innerHTML = '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>';

      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(message.content);
          showToast("تم نسخ الرد.", "success");
        } catch {
          showToast("المتصفح منع النسخ. حدّد النص وانسخه يدويًا.", "error");
        }
      });

      actions.appendChild(copy);
      body.appendChild(actions);
    }

    row.append(avatar, body);
    elements.messagesList.appendChild(row);

    if (shouldScroll) {
      scrollMessagesToBottom();
    }
  }

  function scrollMessagesToBottom() {
    requestAnimationFrame(() => {
      elements.messagesContainer.scrollTop =
        elements.messagesContainer.scrollHeight;
    });
  }

  function addMessage(role, content, attachments = [], options = {}) {
    const conversation = getOrCreateConversation();

    if (!conversation) {
      return null;
    }

    const message = {
      id: makeId(),
      role,
      content: String(content || "").slice(0, MAX_MESSAGE_LENGTH),
      timestamp: Date.now(),
      attachments: attachments.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type
      })),
      webSearch: Boolean(options.webSearch)
    };

    conversation.messages.push(message);
    conversation.updatedAt = Date.now();

    if (role === "user" && conversation.messages.filter(item => item.role === "user").length === 1) {
      conversation.title = makeConversationTitle(content || attachments[0]?.name);
    }

    conversations.sort((a, b) => b.updatedAt - a.updatedAt);

    saveConversations();
    renderHistory();

    elements.welcomeScreen.classList.add("hidden");
    elements.messagesContainer.classList.remove("hidden");

    renderMessage(message);

    return message;
  }

  function showTypingIndicator() {
    const row = document.createElement("article");
    row.className = "message assistant";
    row.id = "typingIndicator";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = "M";

    const body = document.createElement("div");
    body.className = "message-body";

    const heading = document.createElement("div");
    heading.className = "message-heading";

    const title = document.createElement("strong");
    title.textContent = "ميكا شات";

    heading.appendChild(title);

    const indicator = document.createElement("div");
    indicator.className = "typing-indicator";
    indicator.setAttribute("aria-label", "جاري تجهيز الرد");

    for (let i = 0; i < 3; i++) {
      indicator.appendChild(document.createElement("span"));
    }

    body.append(heading, indicator);
    row.append(avatar, body);
    elements.messagesList.appendChild(row);

    scrollMessagesToBottom();
  }

  function removeTypingIndicator() {
    $("#typingIndicator")?.remove();
  }

  function updateCharCounter() {
    const length = elements.promptInput.value.length;

    elements.charCounter.textContent =
      `${length.toLocaleString("ar-EG")} / ${MAX_MESSAGE_LENGTH.toLocaleString("ar-EG")}`;

    elements.sendButton.disabled = isSending || (
      !elements.promptInput.value.trim() && pendingFiles.length === 0
    );
  }

  function resizeTextarea() {
    elements.promptInput.style.height = "auto";
    elements.promptInput.style.height =
      Math.min(elements.promptInput.scrollHeight, 180) + "px";
  }

  function clearPendingFiles() {
    pendingFiles = [];
    elements.fileInput.value = "";
    renderPendingFiles();
  }

  function renderPendingFiles() {
    elements.attachmentPreview.replaceChildren();

    if (pendingFiles.length === 0) {
      elements.attachmentPreview.classList.add("hidden");
      return;
    }

    elements.attachmentPreview.classList.remove("hidden");

    pendingFiles.forEach((file, index) => {
      const chip = document.createElement("div");
      chip.className = "attachment-chip";

      const icon = document.createElement("span");
      icon.textContent = file.type.startsWith("image/") ? "▧" : "▤";

      const name = document.createElement("span");
      name.textContent = `${file.name} (${formatBytes(file.size)})`;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "إزالة الملف");

      remove.addEventListener("click", () => {
        pendingFiles.splice(index, 1);
        renderPendingFiles();
        updateCharCounter();
      });

      chip.append(icon, name, remove);
      elements.attachmentPreview.appendChild(chip);
    });
  }

  function formatBytes(bytes) {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleFileSelection(fileList) {
    const incoming = Array.from(fileList || []);

    if (!incoming.length) {
      return;
    }

    for (const file of incoming) {
      if (pendingFiles.length >= MAX_FILES) {
        showToast(`الحد الأقصى ${MAX_FILES} ملفات في الرسالة الواحدة.`, "error");
        break;
      }

      if (file.size > MAX_FILE_SIZE) {
        showToast(`الملف "${file.name}" أكبر من 10 ميجابايت.`, "error");
        continue;
      }

      if (pendingFiles.some(existing =>
        existing.name === file.name &&
        existing.size === file.size &&
        existing.lastModified === file.lastModified
      )) {
        continue;
      }

      pendingFiles.push(file);
    }

    renderPendingFiles();
    updateCharCounter();

    if (pendingFiles.length) {
      showToast("تم اختيار الملفات. تحليل محتواها يحتاج خدمة خلفية متصلة.", "normal", 3800);
    }
  }

  async function sendMessage() {
    if (isSending) {
      return;
    }

    const content = elements.promptInput.value.trim();

    if (!content && pendingFiles.length === 0) {
      elements.promptInput.focus();
      return;
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      showToast("الرسالة أطول من الحد المسموح.", "error");
      return;
    }

    const filesForMessage = pendingFiles.slice();
    const requestedWebSearch = webSearchEnabled;

    const userMessage = content || (
      filesForMessage.length
        ? "أرفقت ملفات. حلّل محتواها من فضلك."
        : ""
    );

    const conversation = getOrCreateConversation();

    if (!conversation) {
      return;
    }

    addMessage("user", userMessage, filesForMessage, {
      webSearch: requestedWebSearch
    });

    elements.promptInput.value = "";
    elements.promptInput.style.height = "auto";
    clearPendingFiles();

    isSending = true;
    updateCharCounter();

    elements.sendButton.disabled = true;
    showTypingIndicator();

    try {
      if (!window.MikaServices || typeof window.MikaServices.chat !== "function") {
        throw new Error(
          "الخدمة غير متصلة بعد. جهّزنا الواجهة، لكننا نحتاج ربط نموذج ذكاء اصطناعي حقيقي."
        );
      }

      const result = await window.MikaServices.chat({
        conversationId: conversation.id,
        message: userMessage,
        webSearch: requestedWebSearch,
        attachments: filesForMessage.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type
        })),
        history: conversation.messages.slice(-20).map(message => ({
          role: message.role,
          content: message.content
        }))
      });

      removeTypingIndicator();

      const answer = typeof result === "string"
        ? result
        : result && typeof result.answer === "string"
          ? result.answer
          : "";

      if (!answer.trim()) {
        throw new Error("الخدمة لم تُرجع إجابة صالحة.");
      }

      addMessage("assistant", answer);
      setServiceNotice("");

    } catch (error) {
      removeTypingIndicator();

      const message = error && error.message
        ? error.message
        : "تعذر الاتصال بخدمة الذكاء الاصطناعي.";

      const failedConversation = getActiveConversation();

      if (failedConversation) {
        failedConversation.messages.push({
          id: makeId(),
          role: "assistant",
          content: "تعذر الحصول على إجابة من نموذج الذكاء الاصطناعي.\n\n" +
            message +
            "\n\nرسالتك محفوظة محليًا. بعد توصيل خدمة الذكاء الاصطناعي الحقيقية، جرّب إرسالها مرة أخرى.",
          timestamp: Date.now(),
          attachments: [],
          webSearch: false
        });

        failedConversation.updatedAt = Date.now();
        saveConversations();
        renderHistory();
        renderActiveConversation();
      }

      setServiceNotice("خدمة الذكاء الاصطناعي غير متصلة حاليًا.");
      showToast("لم يصل رد من خدمة الذكاء الاصطناعي.", "error", 4000);

    } finally {
      isSending = false;
      updateCharCounter();
      elements.promptInput.focus();
    }
  }

  function toggleWebSearch() {
    webSearchEnabled = !webSearchEnabled;

    elements.webSearchButton.classList.toggle("active", webSearchEnabled);
    elements.webSearchButton.setAttribute("aria-pressed", String(webSearchEnabled));

    if (webSearchEnabled) {
      setServiceNotice("تم اختيار البحث للرسالة التالية. يلزم ربط خدمة بحث حقيقية لتشغيله.");
      showToast("تم تفعيل خيار البحث لهذه الرسالة.", "success");
    } else {
      setServiceNotice("");
      showToast("تم إيقاف خيار البحث.");
    }
  }

  function setupVoiceRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showToast("الإملاء الصوتي غير مدعوم في هذا المتصفح. جرّب متصفحًا يدعمه.", "error", 4000);
      return;
    }

    if (isListening && recognition) {
      recognition.stop();
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = "ar-EG";
    recognition.interimResults = true;
    recognition.continuous = false;

    let finalTranscript = "";

    recognition.onstart = () => {
      isListening = true;
      elements.voiceButton.classList.add("active");
      elements.voiceButton.setAttribute("aria-pressed", "true");
      showToast("اتكلم دلوقتي؛ المتصفح بيحوّل صوتك لنص.", "normal");
    };

    recognition.onresult = event => {
      let interimTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index++) {
        const transcript = event.results[index][0].transcript;

        if (event.results[index].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const currentText = [finalTranscript, interimTranscript]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (currentText) {
        const existing = elements.promptInput.value.trim();
        elements.promptInput.value = [existing, currentText]
          .filter(Boolean)
          .join(existing ? " " : "");

        resizeTextarea();
        updateCharCounter();
      }
    };

    recognition.onerror = event => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        showToast("حصلت مشكلة في الإملاء الصوتي: " + event.error, "error");
      }
    };

    recognition.onend = () => {
      isListening = false;
      elements.voiceButton.classList.remove("active");
      elements.voiceButton.setAttribute("aria-pressed", "false");
    };

    try {
      recognition.start();
    } catch {
      showToast("تعذر بدء الإملاء الصوتي. جرّب مرة أخرى.", "error");
    }
  }

  function openModal(title, contentBuilder) {
    elements.modalTitle.textContent = title;
    elements.modalBody.replaceChildren();
    contentBuilder(elements.modalBody);

    elements.modalBackdrop.classList.remove("hidden");
    elements.closeModal.focus();
  }

  function closeModal() {
    elements.modalBackdrop.classList.add("hidden");
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = text;
    }

    return element;
  }

  function openSettingsModal() {
    openModal("الإعدادات", body => {
      const description = makeElement(
        "p",
        "modal-description",
        "خصص تجربتك على هذا الجهاز. الإعدادات الحالية محلية وليست مرتبطة بحساب مستخدم."
      );

      const nameGroup = makeElement("div", "settings-group");
      const nameLabel = makeElement("label", "", "الاسم الظاهر");
      nameLabel.htmlFor = "settingsDisplayName";

      const nameInput = makeElement("input");
      nameInput.id = "settingsDisplayName";
      nameInput.type = "text";
      nameInput.maxLength = 40;
      nameInput.value = settings.displayName || "ضيف ميكا";

      nameGroup.append(nameLabel, nameInput);

      const themeGroup = makeElement("div", "settings-group");
      const themeLabel = makeElement("label", "", "المظهر");
      themeLabel.htmlFor = "settingsTheme";

      const themeSelect = makeElement("select");
      themeSelect.id = "settingsTheme";

      [
        ["dark", "المظهر الداكن"],
        ["light", "المظهر الفاتح"]
      ].forEach(([value, label]) => {
        const option = makeElement("option", "", label);
        option.value = value;
        themeSelect.appendChild(option);
      });

      themeSelect.value = settings.theme;
      themeGroup.append(themeLabel, themeSelect);

      const saveButton = makeElement("button", "modal-primary", "حفظ الإعدادات");
      saveButton.type = "button";

      saveButton.addEventListener("click", () => {
        settings.displayName = nameInput.value.trim().slice(0, 40) || "ضيف ميكا";
        settings.theme = themeSelect.value === "light" ? "light" : "dark";

        saveSettings();
        applyTheme();
        updateProfile();
        renderActiveConversation();
        closeModal();
        showToast("تم حفظ الإعدادات على جهازك.", "success");
      });

      body.append(description, nameGroup, themeGroup, saveButton);
    });
  }

  function openPlansModal() {
    openModal("خطط ميكا شات", body => {
      body.appendChild(makeElement(
        "p",
        "modal-description",
        "دي واجهة تعريفية فقط. مفيش اشتراكات أو مدفوعات فعلية مفعّلة في النسخة الحالية."
      ));

      const plans = [
        {
          name: "MIKA Free",
          description: "تجربة الواجهة والمحادثات المحلية. استخدام الذكاء الاصطناعي يحتاج اتصال الخدمة.",
          status: "النسخة الحالية"
        },
        {
          name: "MIKA Plus",
          description: "خطة مستقبلية يمكن ربطها بحدود استخدام أعلى وأدوات إضافية بعد تجهيز الخادم ونظام الحسابات.",
          status: "غير متاحة حاليًا"
        },
        {
          name: "MIKA Pro",
          description: "خطة مستقبلية للاستخدام المتقدم، بعد تحديد الخدمات والتكلفة وآلية الاشتراك.",
          status: "غير متاحة حاليًا"
        }
      ];

      plans.forEach(plan => {
        const card = makeElement("div", "plan-option");
        const title = makeElement("strong", "", plan.name);
        const description = makeElement("p", "", plan.description);
        const status = makeElement("span", "plan-status", plan.status);

        card.append(title, description, status);
        body.appendChild(card);
      });
    });
  }

  async function shareConversation() {
    const conversation = getActiveConversation();

    if (!conversation || conversation.messages.length === 0) {
      showToast("ابدأ محادثة قبل محاولة مشاركتها.", "error");
      return;
    }

    const text = [
      "MIKA CHAT — " + conversation.title,
      "",
      ...conversation.messages.map(message =>
        (message.role === "user" ? "أنت: " : "ميكا شات: ") + message.content
      )
    ].join("\n\n");

    if (navigator.share) {
      try {
        await navigator.share({
          title: conversation.title,
          text
        });

        return;
      } catch (error) {
        if (error && error.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast("تم نسخ نص المحادثة. تقدر تشاركه بنفسك.", "success");
    } catch {
      showToast("المتصفح لا يسمح بالمشاركة أو النسخ في السياق الحالي.", "error");
    }
  }

  function openSidebar() {
    elements.body.classList.add("sidebar-open");
  }

  function closeSidebar() {
    elements.body.classList.remove("sidebar-open");
  }

  function setupEvents() {
    elements.newChat.addEventListener("click", () => {
      createConversation();
      setServiceNotice("");
    });

    elements.searchChats.addEventListener("input", renderHistory);

    elements.sendButton.addEventListener("click", sendMessage);

    elements.promptInput.addEventListener("input", () => {
      resizeTextarea();
      updateCharCounter();
    });

    elements.promptInput.addEventListener("keydown", event => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.isComposing
      ) {
        event.preventDefault();
        sendMessage();
      }
    });

    $$(".suggestion-card").forEach(button => {
      button.addEventListener("click", () => {
        elements.promptInput.value = button.dataset.prompt || "";
        resizeTextarea();
        updateCharCounter();
        elements.promptInput.focus();
      });
    });

    elements.themeToggle.addEventListener("click", () => {
      settings.theme = settings.theme === "light" ? "dark" : "light";
      saveSettings();
      applyTheme(true);
    });

    elements.openSettings.addEventListener("click", openSettingsModal);
    elements.openPlans.addEventListener("click", openPlansModal);
    elements.closeModal.addEventListener("click", closeModal);

    elements.modalBackdrop.addEventListener("click", event => {
      if (event.target === elements.modalBackdrop) {
        closeModal();
      }
    });

    elements.openSidebar.addEventListener("click", openSidebar);
    elements.closeSidebar.addEventListener("click", closeSidebar);
    elements.mobileOverlay.addEventListener("click", closeSidebar);

    elements.attachButton.addEventListener("click", () => {
      elements.fileInput.click();
    });

    elements.fileInput.addEventListener("change", event => {
      handleFileSelection(event.target.files);
    });

    elements.webSearchButton.addEventListener("click", toggleWebSearch);
    elements.voiceButton.addEventListener("click", setupVoiceRecognition);
    elements.shareChat.addEventListener("click", shareConversation);

    document.addEventListener("keydown", event => {
      const activeTag = document.activeElement?.tagName;
      const isTyping = activeTag === "INPUT" || activeTag === "TEXTAREA";

      if (
        event.key === "/" &&
        !isTyping &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        elements.searchChats.focus();
      }

      if (event.key === "Escape") {
        closeModal();
        closeSidebar();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        createConversation();
      }
    });

    window.addEventListener("storage", event => {
      if (event.key === STORAGE_KEY) {
        loadConversations();
        renderActiveConversation();
      }

      if (event.key === SETTINGS_KEY) {
        loadSettings();
      }
    });
  }

  function initialize() {
    loadSettings();
    loadConversations();
    setupEvents();
    updateCharCounter();
    renderActiveConversation();

    window.MIKA_CHAT = {
      newConversation: createConversation,
      openConversation,
      getConversations: () => JSON.parse(JSON.stringify(conversations)),
      getActiveConversation: () => {
        const active = getActiveConversation();
        return active ? JSON.parse(JSON.stringify(active)) : null;
      },
      refresh: () => {
        loadConversations();
        renderActiveConversation();
      }
    };

    console.info("MIKA CHAT interface initialized.");
  }

  initialize();
})();
