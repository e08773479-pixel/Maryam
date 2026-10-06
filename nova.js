/* =========================================================
   NOVA — Core Application Engine
   Phase 01 — Frontend / UI / Interaction Layer
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     01 — CONFIG
     ========================================================= */

  const CONFIG = window.NOVA_CONFIG || window.NOVA_CONFIG || {
    appName: "NOVA",
    version: "1.0.0",
    api: {
      baseURL: "/api",
      timeout: 15000
    },
    realtime: {
      url: "/ws"
    },
    storage: {
      theme: "nova.theme",
      settings: "nova.settings",
      session: "nova.session"
    }
  };

  const APP = {
    name: CONFIG.appName || "NOVA",
    version: CONFIG.version || "1.0.0"
  };

  /* =========================================================
     02 — GLOBAL STATE
     ========================================================= */

  const state = {
    ready: false,
    currentView: "chats",
    previousView: null,

    conversation: null,

    conversations: [],
    messages: [],

    selectedMessages: new Set(),

    search: {
      open: false,
      query: "",
      scope: "all"
    },

    composer: {
      text: "",
      replyTo: null,
      editing: null,
      recording: false
    },

    call: {
      active: false,
      type: null,
      direction: null,
      contact: null,
      muted: false,
      camera: true,
      speaker: false,
      timer: 0
    },

    status: {
      viewerOpen: false,
      index: 0
    },

    modal: {
      open: false,
      type: null
    },

    settings: {
      theme: "dark",
      wallpaper: "default",
      enterToSend: true,
      mediaVisibility: true,
      notifications: true,
      lastSeen: "contacts",
      profilePhoto: "everyone",
      about: "everyone",
      statusPrivacy: "contacts"
    },

    ui: {
      sidebarOpen: false,
      drawerOpen: false,
      attachmentOpen: false,
      emojiOpen: false,
      stickerOpen: false,
      messageMenuOpen: false,
      contextMessageId: null,
      toastTimer: null
    }
  };

  window.NOVA_STATE = state;

  /* =========================================================
     03 — DOM HELPERS
     ========================================================= */

  const $ = (selector, root = document) => {
    try {
      return root.querySelector(selector);
    } catch {
      return null;
    }
  };

  const $$ = (selector, root = document) => {
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch {
      return [];
    }
  };

  const byId = (id) => document.getElementById(id);

  const exists = (selector) => Boolean($(selector));

  const create = (tag, className = "", html = "") => {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (html) {
      element.innerHTML = html;
    }

    return element;
  };

  /* =========================================================
     04 — SAFE STORAGE
     ========================================================= */

  const storage = {
    get(key, fallback = null) {
      try {
        const value = localStorage.getItem(key);

        if (value === null) {
          return fallback;
        }

        return JSON.parse(value);
      } catch {
        return fallback;
      }
    },

    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* Storage can be unavailable. */
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* Ignore */
      }
    }
  };

  /* =========================================================
     05 — UTILITIES
     ========================================================= */

  const escapeHTML = (value) => {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  };

  const formatTime = (date = new Date()) => {
    try {
      return new Intl.DateTimeFormat("ar-EG", {
        hour: "2-digit",
        minute: "2-digit"
      }).format(date);
    } catch {
      return date.toLocaleTimeString();
    }
  };

  const formatDate = (date = new Date()) => {
    try {
      return new Intl.DateTimeFormat("ar-EG", {
        day: "numeric",
        month: "long"
      }).format(date);
    } catch {
      return date.toLocaleDateString();
    }
  };

  const generateId = (prefix = "nova") => {
    return `${prefix}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 9)}`;
  };

  /* =========================================================
     06 — TOAST SYSTEM
     ========================================================= */

  function ensureToastContainer() {
    let container =
      byId("nova-toast-container") ||
      $(".nova-toast-container") ||
      $(".toast-container");

    if (!container) {
      container = create("div", "nova-toast-container");
      container.id = "nova-toast-container";
      document.body.appendChild(container);
    }

    return container;
  }

  function toast(message, type = "info", duration = 2800) {
    const container = ensureToastContainer();

    if (state.ui.toastTimer) {
      clearTimeout(state.ui.toastTimer);
    }

    const item = create("div", `nova-toast nova-toast-${type}`);

    item.innerHTML = `
      <div class="nova-toast-icon">
        ${type === "success" ? "✓" : type === "error" ? "!" : "i"}
      </div>
      <div class="nova-toast-text">${escapeHTML(message)}</div>
    `;

    container.appendChild(item);

    requestAnimationFrame(() => {
      item.classList.add("is-visible");
    });

    setTimeout(() => {
      item.classList.remove("is-visible");

      setTimeout(() => {
        item.remove();
      }, 250);
    }, duration);
  }

  /* =========================================================
     07 — LOADER
     ========================================================= */

  function updateLoaderProgress(value) {
    const progress = Math.max(0, Math.min(100, value));

    const bar =
      byId("loader-progress-bar") ||
      $(".loader-progress-bar") ||
      $(".progress-bar");

    if (bar) {
      bar.style.width = `${progress}%`;
    }

    const percentage =
      byId("loader-progress-value") ||
      $(".loader-progress-value");

    if (percentage) {
      percentage.textContent = `${Math.round(progress)}%`;
    }
  }

  function setLoaderText(text) {
    const candidates = [
      byId("loader-text"),
      byId("loading-text"),
      $(".loader-text"),
      $(".loading-text"),
      $(".app-loader-text")
    ];

    const element = candidates.find(Boolean);

    if (element) {
      element.textContent = text;
    }
  }

  function hideLoader() {
    const loaders = [
      byId("app-loader"),
      $(".app-loader"),
      $(".loading-screen"),
      $(".splash-screen"),
      $(".loader-screen")
    ].filter(Boolean);

    loaders.forEach((loader) => {
      loader.classList.add("is-complete");
      loader.classList.add("hidden");

      setTimeout(() => {
        loader.style.pointerEvents = "none";
        loader.style.visibility = "hidden";
      }, 650);
    });

    document.documentElement.classList.remove("nova-loading");
    document.body.classList.remove("nova-loading");
  }

  async function bootLoader() {
    /*
      مهم:
      لا نعتمد على API أو قاعدة بيانات لكي ننهي شاشة البداية.
      المرحلة الأولى Frontend فقط، لذلك لا يمكن أن تتعلق الشاشة.
    */

    const steps = [
      [10, "بدء تشغيل نوفا..."],
      [28, "تجهيز الواجهة..."],
      [48, "تجهيز المحادثات..."],
      [68, "تجهيز المكالمات..."],
      [84, "تجهيز الإشعارات..."],
      [100, "أهلاً بك في NOVA"]
    ];

    for (const [progress, text] of steps) {
      updateLoaderProgress(progress);
      setLoaderText(text);

      await new Promise((resolve) => {
        setTimeout(resolve, progress === 100 ? 450 : 160);
      });
    }

    hideLoader();
    state.ready = true;

    document.dispatchEvent(
      new CustomEvent("nova:ready", {
        detail: {
          version: APP.version
        }
      })
    );
  }

  /* =========================================================
     08 — NAVIGATION
     ========================================================= */

  const viewAliases = {
    chat: "chats",
    messages: "chats",
    conversation: "chats",
    status: "status",
    stories: "status",
    calls: "calls",
    community: "communities",
    communitys: "communities",
    group: "groups",
    profile: "profile",
    settings: "settings",
    contacts: "contacts",
    search: "search"
  };

  function normalizeView(view) {
    return viewAliases[view] || view || "chats";
  }

  function getViewElements() {
    return $$("[data-view], .nova-view, .app-view, .page-view");
  }

  function showView(view, options = {}) {
    const normalized = normalizeView(view);

    state.previousView = state.currentView;
    state.currentView = normalized;

    const views = getViewElements();

    let matched = false;

    views.forEach((element) => {
      const target =
        element.dataset.view ||
        element.dataset.page ||
        element.id ||
        "";

      const isMatch =
        target === normalized ||
        target === `view-${normalized}` ||
        target === `${normalized}-view`;

      element.classList.toggle("active", isMatch);
      element.classList.toggle("is-active", isMatch);
      element.hidden = !isMatch;

      if (isMatch) {
        matched = true;
      }
    });

    document.body.dataset.view = normalized;

    $$("[data-nav]").forEach((button) => {
      const target = normalizeView(button.dataset.nav);

      button.classList.toggle("active", target === normalized);
      button.classList.toggle("is-active", target === normalized);
      button.setAttribute(
        "aria-current",
        target === normalized ? "page" : "false"
      );
    });

    $$("[data-route]").forEach((button) => {
      const target = normalizeView(button.dataset.route);
      button.classList.toggle("active", target === normalized);
    });

    if (!options.silent) {
      document.dispatchEvent(
        new CustomEvent("nova:navigate", {
          detail: {
            view: normalized,
            matched
          }
        })
      );
    }

    if (window.innerWidth <= 900 && normalized !== "chats") {
      closeMobileSidebar();
    }

    return matched;
  }

  function navigate(view) {
    showView(view);

    if (window.history && window.history.pushState) {
      try {
        window.history.replaceState(
          {
            novaView: normalizeView(view)
          },
          "",
          window.location.href
        );
      } catch {
        /* Ignore */
      }
    }
  }

  /* =========================================================
     09 — SIDEBAR / DRAWERS
     ========================================================= */

  function openMobileSidebar() {
    state.ui.sidebarOpen = true;

    document.body.classList.add("sidebar-open");
    document.body.classList.add("mobile-sidebar-open");

    const sidebar =
      $(".app-sidebar") ||
      $(".nova-sidebar") ||
      $("#app-sidebar");

    if (sidebar) {
      sidebar.classList.add("open");
      sidebar.classList.add("is-open");
    }
  }

  function closeMobileSidebar() {
    state.ui.sidebarOpen = false;

    document.body.classList.remove("sidebar-open");
    document.body.classList.remove("mobile-sidebar-open");

    const sidebar =
      $(".app-sidebar") ||
      $(".nova-sidebar") ||
      $("#app-sidebar");

    if (sidebar) {
      sidebar.classList.remove("open");
      sidebar.classList.remove("is-open");
    }
  }

  function toggleSidebar() {
    if (state.ui.sidebarOpen) {
      closeMobileSidebar();
    } else {
      openMobileSidebar();
    }
  }

  /* =========================================================
     10 — MODAL SYSTEM
     ========================================================= */

  function ensureModalRoot() {
    let root =
      byId("nova-modal-root") ||
      byId("modal-root") ||
      $(".modal-root");

    if (!root) {
      root = create("div", "nova-modal-root");
      root.id = "nova-modal-root";
      document.body.appendChild(root);
    }

    return root;
  }

  function closeModal() {
    const root = ensureModalRoot();

    root.classList.remove("open");
    root.classList.remove("is-open");

    state.modal.open = false;
    state.modal.type = null;

    setTimeout(() => {
      root.innerHTML = "";
    }, 220);
  }

  function openModal({
    title = "",
    body = "",
    type = "default",
    actions = ""
  } = {}) {
    const root = ensureModalRoot();

    root.innerHTML = `
      <div class="nova-modal-backdrop" data-modal-close></div>

      <section
        class="nova-modal nova-modal-${escapeHTML(type)}"
        role="dialog"
        aria-modal="true"
      >
        <header class="nova-modal-header">
          <button
            class="nova-icon-button"
            type="button"
            data-modal-close
            aria-label="إغلاق"
          >
            ×
          </button>

          <h3>${escapeHTML(title)}</h3>

          <span class="nova-modal-spacer"></span>
        </header>

        <div class="nova-modal-body">
          ${body}
        </div>

        ${
          actions
            ? `<footer class="nova-modal-actions">${actions}</footer>`
            : ""
        }
      </section>
    `;

    root.classList.add("open");
    root.classList.add("is-open");

    state.modal.open = true;
    state.modal.type = type;

    return root;
  }

  /* =========================================================
     11 — EMPTY STATES
     ========================================================= */

  function renderEmptyState({
    title = "لا يوجد شيء هنا",
    description = "عندما تتوفر بيانات حقيقية ستظهر هنا.",
    icon = "N"
  } = {}) {
    return `
      <div class="nova-empty-state">
        <div class="nova-empty-icon">${escapeHTML(icon)}</div>
        <h3>${escapeHTML(title)}</h3>
        <p>${escapeHTML(description)}</p>
      </div>
    `;
  }

  /* =========================================================
     12 — CONVERSATION
     ========================================================= */

  function openConversation(conversation = null) {
    if (!conversation) {
      return;
    }

    state.conversation = conversation;

    const name =
      conversation.name ||
      conversation.title ||
      "محادثة";

    const avatar =
      conversation.avatar ||
      "";

    const headerName =
      byId("conversation-name") ||
      $(".conversation-name") ||
      $(".chat-header-name");

    if (headerName) {
      headerName.textContent = name;
    }

    const headerAvatar =
      byId("conversation-avatar") ||
      $(".conversation-avatar") ||
      $(".chat-header-avatar");

    if (headerAvatar) {
      if (avatar) {
        headerAvatar.style.backgroundImage = `url("${avatar}")`;
        headerAvatar.textContent = "";
      } else {
        headerAvatar.style.backgroundImage = "";
        headerAvatar.textContent = name.charAt(0);
      }
    }

    const status =
      byId("conversation-status") ||
      $(".conversation-status") ||
      $(".chat-header-status");

    if (status) {
      status.textContent =
        conversation.status ||
        "محادثة";
    }

    renderConversationMessages();

    document.body.classList.add("conversation-open");

    showView("chats");
  }

  function closeConversation() {
    state.conversation = null;

    document.body.classList.remove("conversation-open");

    if (window.innerWidth <= 900) {
      const list =
        byId("chat-list-view") ||
        $(".chat-list-view");

      const conversation =
        byId("conversation-view") ||
        $(".conversation-view");

      if (list) {
        list.classList.add("active");
        list.hidden = false;
      }

      if (conversation) {
        conversation.classList.remove("active");
        conversation.hidden = true;
      }
    }
  }

  function renderConversationMessages() {
    const container =
      byId("messages-list") ||
      $(".messages-list") ||
      $(".chat-messages") ||
      $(".conversation-messages");

    if (!container) {
      return;
    }

    if (!state.conversation) {
      container.innerHTML = renderEmptyState({
        title: "اختر محادثة",
        description: "اختر محادثة لبدء التواصل."
      });

      return;
    }

    const conversationId =
      state.conversation.id ||
      state.conversation.conversationId;

    const messages = state.messages.filter((message) => {
      return message.conversationId === conversationId;
    });

    if (!messages.length) {
      container.innerHTML = renderEmptyState({
        title: "لا توجد رسائل بعد",
        description:
          "هذه المحادثة لا تحتوي على رسائل محفوظة حتى الآن."
      });

      return;
    }

    container.innerHTML = messages
      .map(renderMessage)
      .join("");

    container.scrollTop = container.scrollHeight;
  }

  /* =========================================================
     13 — MESSAGE RENDERING
     ========================================================= */

  function renderMessage(message) {
    const mine = message.direction === "outgoing";

    const selected = state.selectedMessages.has(message.id);

    const text = escapeHTML(message.text || "");

    return `
      <article
        class="nova-message ${
          mine ? "nova-message-outgoing" : "nova-message-incoming"
        }
        ${selected ? "selected" : ""}"
        data-message-id="${escapeHTML(message.id)}"
        tabindex="0"
      >
        ${
          message.replyTo
            ? `
              <div class="nova-message-reply">
                <span>${escapeHTML(message.replyTo.text || "")}</span>
              </div>
            `
            : ""
        }

        ${
          message.type === "image"
            ? `
              <div class="nova-message-media">
                <div class="nova-media-placeholder">
                  صورة
                </div>
              </div>
            `
            : ""
        }

        ${
          message.type === "document"
            ? `
              <div class="nova-document-card">
                <strong>${escapeHTML(
                  message.fileName || "مستند"
                )}</strong>
                <small>${escapeHTML(
                  message.fileSize || ""
                )}</small>
              </div>
            `
            : ""
        }

        ${
          text
            ? `<div class="nova-message-text">${text}</div>`
            : ""
        }

        <footer class="nova-message-meta">
          <time>${escapeHTML(
            message.time || formatTime()
          )}</time>

          ${
            mine
              ? `<span class="nova-message-status">✓✓</span>`
              : ""
          }
        </footer>
      </article>
    `;
  }

  /* =========================================================
     14 — SEND MESSAGE
     ========================================================= */

  function getComposerElement() {
    return (
      byId("message-input") ||
      byId("composer-input") ||
      $(".message-input") ||
      $(".composer-input") ||
      $("textarea[data-composer]")
    );
  }

  function sendMessage() {
    const input = getComposerElement();

    if (!input) {
      return;
    }

    const text = input.value.trim();

    if (!text) {
      return;
    }

    if (!state.conversation) {
      toast("اختر محادثة أولاً", "info");
      return;
    }

    const conversationId =
      state.conversation.id ||
      state.conversation.conversationId;

    const message = {
      id: generateId("message"),
      conversationId,
      direction: "outgoing",
      type: "text",
      text,
      time: formatTime(),
      createdAt: new Date().toISOString(),
      status: "pending"
    };

    /*
      لا يتم الادعاء أن الرسالة وصلت للسيرفر.
      في المرحلة الأولى هي حالة واجهة فقط.
    */

    state.messages.push(message);

    input.value = "";
    state.composer.text = "";

    renderConversationMessages();

    toast(
      "تم تجهيز الرسالة للربط مع الخادم في المرحلة التالية",
      "info"
    );

    document.dispatchEvent(
      new CustomEvent("nova:message:queued", {
        detail: message
      })
    );
  }

  /* =========================================================
     15 — REPLY
     ========================================================= */

  function startReply(messageId) {
    const message = state.messages.find(
      (item) => item.id === messageId
    );

    if (!message) {
      return;
    }

    state.composer.replyTo = message;

    const replyBar =
      byId("reply-preview") ||
      $(".reply-preview");

    if (replyBar) {
      replyBar.innerHTML = `
        <div class="nova-reply-preview-content">
          <strong>الرد على</strong>
          <span>${escapeHTML(message.text || "رسالة")}</span>
        </div>

        <button
          type="button"
          data-cancel-reply
          aria-label="إلغاء الرد"
        >
          ×
        </button>
      `;

      replyBar.classList.add("active");
      replyBar.hidden = false;
    }

    const input = getComposerElement();

    if (input) {
      input.focus();
    }
  }

  function cancelReply() {
    state.composer.replyTo = null;

    const replyBar =
      byId("reply-preview") ||
      $(".reply-preview");

    if (replyBar) {
      replyBar.classList.remove("active");
      replyBar.hidden = true;
      replyBar.innerHTML = "";
    }
  }

  /* =========================================================
     16 — MESSAGE SELECTION
     ========================================================= */

  function toggleMessageSelection(messageId) {
    if (state.selectedMessages.has(messageId)) {
      state.selectedMessages.delete(messageId);
    } else {
      state.selectedMessages.add(messageId);
    }

    updateSelectionToolbar();
    renderConversationMessages();
  }

  function clearMessageSelection() {
    state.selectedMessages.clear();
    updateSelectionToolbar();
    renderConversationMessages();
  }

  function updateSelectionToolbar() {
    const toolbar =
      byId("selection-toolbar") ||
      $(".selection-toolbar") ||
      $(".message-selection-toolbar");

    if (!toolbar) {
      return;
    }

    const count = state.selectedMessages.size;

    toolbar.classList.toggle("active", count > 0);
    toolbar.hidden = count === 0;

    const counter =
      toolbar.querySelector("[data-selection-count]") ||
      toolbar.querySelector(".selection-count");

    if (counter) {
      counter.textContent = String(count);
    }
  }

  /* =========================================================
     17 — MESSAGE CONTEXT MENU
     ========================================================= */

  function openMessageMenu(messageId, x = 0, y = 0) {
    closeMessageMenu();

    state.ui.contextMessageId = messageId;
    state.ui.messageMenuOpen = true;

    const menu = create(
      "div",
      "nova-message-context-menu"
    );

    menu.id = "nova-message-context-menu";

    menu.innerHTML = `
      <button type="button" data-message-action="reply">
        <span>↩</span>
        <span>رد</span>
      </button>

      <button type="button" data-message-action="forward">
        <span>➜</span>
        <span>إعادة توجيه</span>
      </button>

      <button type="button" data-message-action="copy">
        <span>▣</span>
        <span>نسخ</span>
      </button>

      <button type="button" data-message-action="star">
        <span>★</span>
        <span>تمييز بنجمة</span>
      </button>

      <button type="button" data-message-action="pin">
        <span>⌖</span>
        <span>تثبيت</span>
      </button>

      <button type="button" data-message-action="select">
        <span>✓</span>
        <span>تحديد</span>
      </button>

      <button type="button" data-message-action="info">
        <span>ⓘ</span>
        <span>معلومات</span>
      </button>

      <button
        type="button"
        class="danger"
        data-message-action="delete"
      >
        <span>⌫</span>
        <span>حذف</span>
      </button>
    `;

    document.body.appendChild(menu);

    const width = menu.offsetWidth || 230;
    const height = menu.offsetHeight || 300;

    const safeX = Math.min(
      Math.max(8, x),
      window.innerWidth - width - 8
    );

    const safeY = Math.min(
      Math.max(8, y),
      window.innerHeight - height - 8
    );

    menu.style.left = `${safeX}px`;
    menu.style.top = `${safeY}px`;

    requestAnimationFrame(() => {
      menu.classList.add("active");
    });
  }

  function closeMessageMenu() {
    const menu = byId("nova-message-context-menu");

    if (menu) {
      menu.remove();
    }

    state.ui.messageMenuOpen = false;
    state.ui.contextMessageId = null;
  }

  /* =========================================================
     18 — MESSAGE ACTIONS
     ========================================================= */

  async function handleMessageAction(action) {
    const id = state.ui.contextMessageId;

    if (!id) {
      return;
    }

    const message = state.messages.find(
      (item) => item.id === id
    );

    closeMessageMenu();

    if (!message) {
      return;
    }

    switch (action) {
      case "reply":
        startReply(id);
        break;

      case "forward":
        openForwardSheet(message);
        break;

      case "copy":
        try {
          await navigator.clipboard.writeText(
            message.text || ""
          );

          toast("تم نسخ الرسالة", "success");
        } catch {
          toast("تعذر النسخ من الجهاز", "error");
        }
        break;

      case "star":
        message.starred = !message.starred;
        toast(
          message.starred
            ? "تم تمييز الرسالة"
            : "تم إلغاء التمييز",
          "success"
        );
        break;

      case "pin":
        message.pinned = !message.pinned;
        toast(
          message.pinned
            ? "تم تثبيت الرسالة"
            : "تم إلغاء تثبيت الرسالة",
          "success"
        );
        break;

      case "select":
        toggleMessageSelection(id);
        break;

      case "info":
        openMessageInfo(message);
        break;

      case "delete":
        deleteMessage(message);
        break;

      default:
        break;
    }
  }

  function deleteMessage(message) {
    openModal({
      title: "حذف الرسالة",
      type: "confirm",
      body: `
        <div class="nova-confirm-content">
          <p>هل تريد حذف هذه الرسالة من الواجهة الحالية؟</p>
          <small>
            الحذف من الخادم سيتم تنفيذه مع API في المرحلة التالية.
          </small>
        </div>
      `,
      actions: `
        <button type="button" class="nova-button secondary" data-modal-close>
          إلغاء
        </button>

        <button
          type="button"
          class="nova-button danger"
          data-confirm-delete="${escapeHTML(message.id)}"
        >
          حذف
        </button>
      `
    });
  }

  function openMessageInfo(message) {
    openModal({
      title: "معلومات الرسالة",
      type: "info",
      body: `
        <div class="nova-info-list">
          <div>
            <span>النوع</span>
            <strong>${escapeHTML(message.type || "text")}</strong>
          </div>

          <div>
            <span>الوقت</span>
            <strong>${escapeHTML(message.time || "-")}</strong>
          </div>

          <div>
            <span>الحالة</span>
            <strong>${escapeHTML(message.status || "غير متصل بالخادم")}</strong>
          </div>

          <div>
            <span>المعرّف</span>
            <strong>${escapeHTML(message.id)}</strong>
          </div>
        </div>
      `
    });
  }

  /* =========================================================
     19 — FORWARD SHEET
     ========================================================= */

  function openForwardSheet(message) {
    openModal({
      title: "إعادة توجيه",
      type: "forward",
      body: `
        <div class="nova-forward-empty">
          <div class="nova-empty-icon">➜</div>
          <h3>لا توجد محادثات متاحة</h3>
          <p>
            سيتم عرض المحادثات الحقيقية هنا بعد ربط الحساب والـ API.
          </p>
        </div>
      `
    });
  }

  /* =========================================================
     20 — ATTACHMENTS
     ========================================================= */

  function openAttachmentSheet() {
    closeAttachmentSheet();

    const sheet = create(
      "div",
      "nova-attachment-sheet"
    );

    sheet.id = "nova-attachment-sheet";

    sheet.innerHTML = `
      <div class="nova-sheet-backdrop" data-close-attachment></div>

      <section class="nova-sheet">
        <header>
          <h3>إرفاق</h3>

          <button
            type="button"
            data-close-attachment
            aria-label="إغلاق"
          >
            ×
          </button>
        </header>

        <div class="nova-attachment-grid">

          <button type="button" data-attachment="camera">
            <span>◉</span>
            <strong>الكاميرا</strong>
          </button>

          <button type="button" data-attachment="gallery">
            <span>▧</span>
            <strong>المعرض</strong>
          </button>

          <button type="button" data-attachment="document">
            <span>▤</span>
            <strong>مستند</strong>
          </button>

          <button type="button" data-attachment="contact">
            <span>♙</span>
            <strong>جهة اتصال</strong>
          </button>

          <button type="button" data-attachment="location">
            <span>⌖</span>
            <strong>الموقع</strong>
          </button>

          <button type="button" data-attachment="poll">
            <span>☷</span>
            <strong>استطلاع</strong>
          </button>

        </div>
      </section>
    `;

    document.body.appendChild(sheet);

    requestAnimationFrame(() => {
      sheet.classList.add("active");
    });

    state.ui.attachmentOpen = true;
  }

  function closeAttachmentSheet() {
    const sheet = byId("nova-attachment-sheet");

    if (sheet) {
      sheet.remove();
    }

    state.ui.attachmentOpen = false;
  }

  function handleAttachment(type) {
    closeAttachmentSheet();

    switch (type) {
      case "camera":
        toast("واجهة الكاميرا جاهزة للربط في المرحلة التالية");
        break;

      case "gallery":
        toast("واجهة المعرض جاهزة للربط في المرحلة التالية");
        break;

      case "document":
        toast("اختيار المستندات جاهز للربط في المرحلة التالية");
        break;

      case "contact":
        toast("مشاركة جهة اتصال جاهزة للربط");
        break;

      case "location":
        toast("مشاركة الموقع جاهزة للربط");
        break;

      case "poll":
        openPollComposer();
        break;

      default:
        break;
    }
  }

  /* =========================================================
     21 — POLL COMPOSER
     ========================================================= */

  function openPollComposer() {
    openModal({
      title: "إنشاء استطلاع",
      type: "poll",
      body: `
        <form id="nova-poll-form" class="nova-poll-form">

          <label>
            السؤال
            <input
              type="text"
              name="question"
              placeholder="اكتب سؤال الاستطلاع"
              required
            >
          </label>

          <label>
            الاختيار الأول
            <input
              type="text"
              name="option1"
              placeholder="الاختيار الأول"
              required
            >
          </label>

          <label>
            الاختيار الثاني
            <input
              type="text"
              name="option2"
              placeholder="الاختيار الثاني"
              required
            >
          </label>

          <button class="nova-button primary" type="submit">
            إنشاء
          </button>

        </form>
      `
    });
  }

  /* =========================================================
     22 — EMOJI
     ========================================================= */

  const EMOJIS = [
    "😀",
    "😂",
    "😍",
    "🥰",
    "😎",
    "🤍",
    "❤️",
    "🔥",
    "👏",
    "👍",
    "🙏",
    "🎉",
    "✨",
    "💯",
    "😢",
    "😮",
    "😡",
    "🤣",
    "🤝",
    "💙",
    "💚",
    "💛",
    "🖤",
    "⭐"
  ];

  function openEmojiPicker() {
    closeEmojiPicker();

    const picker = create(
      "div",
      "nova-emoji-picker"
    );

    picker.id = "nova-emoji-picker";

    picker.innerHTML = `
      <div class="nova-emoji-header">
        <strong>الإيموجي</strong>
        <button type="button" data-close-emoji>×</button>
      </div>

      <div class="nova-emoji-grid">
        ${EMOJIS.map(
          (emoji) =>
            `<button type="button" data-emoji="${emoji}">${emoji}</button>`
        ).join("")}
      </div>
    `;

    document.body.appendChild(picker);

    requestAnimationFrame(() => {
      picker.classList.add("active");
    });

    state.ui.emojiOpen = true;
  }

  function closeEmojiPicker() {
    const picker = byId("nova-emoji-picker");

    if (picker) {
      picker.remove();
    }

    state.ui.emojiOpen = false;
  }

  function insertEmoji(emoji) {
    const input = getComposerElement();

    if (!input) {
      return;
    }

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;

    input.value =
      input.value.slice(0, start) +
      emoji +
      input.value.slice(end);

    input.focus();

    const cursor = start + emoji.length;

    try {
      input.setSelectionRange(cursor, cursor);
    } catch {
      /* Ignore */
    }
  }

  /* =========================================================
     23 — STICKERS
     ========================================================= */

  function openStickerPicker() {
    closeStickerPicker();

    const picker = create(
      "div",
      "nova-sticker-picker"
    );

    picker.id = "nova-sticker-picker";

    picker.innerHTML = `
      <header>
        <strong>الملصقات</strong>

        <button type="button" data-close-sticker>
          ×
        </button>
      </header>

      <div class="nova-sticker-empty">
        <div class="nova-empty-icon">✦</div>
        <h3>لا توجد ملصقات</h3>
        <p>
          مكتبة الملصقات ستتصل بمصدر البيانات في مرحلة الوسائط.
        </p>
      </div>
    `;

    document.body.appendChild(picker);

    requestAnimationFrame(() => {
      picker.classList.add("active");
    });

    state.ui.stickerOpen = true;
  }

  function closeStickerPicker() {
    const picker = byId("nova-sticker-picker");

    if (picker) {
      picker.remove();
    }

    state.ui.stickerOpen = false;
  }

  /* =========================================================
     24 — SEARCH
     ========================================================= */

  function openSearch() {
    state.search.open = true;

    const search =
      byId("global-search") ||
      $(".global-search") ||
      $(".nova-search");

    if (search) {
      search.classList.add("active");
      search.hidden = false;

      const input =
        search.querySelector("input") ||
        byId("global-search-input");

      if (input) {
        input.focus();
      }
    } else {
      showView("search");
    }
  }

  function closeSearch() {
    state.search.open = false;

    const search =
      byId("global-search") ||
      $(".global-search") ||
      $(".nova-search");

    if (search) {
      search.classList.remove("active");
      search.hidden = true;
    }
  }

  function performSearch(query, scope = "all") {
    state.search.query = query.trim();
    state.search.scope = scope;

    const resultContainer =
      byId("search-results") ||
      $(".search-results");

    if (!resultContainer) {
      return;
    }

    if (!state.search.query) {
      resultContainer.innerHTML = renderEmptyState({
        title: "ابحث في NOVA",
        description:
          "ابحث عن محادثات أو رسائل أو أشخاص أو مجموعات."
      });

      return;
    }

    /*
      لا نضيف نتائج مزيفة.
      نبحث فقط داخل البيانات الموجودة فعلاً في الذاكرة.
    */

    const q = state.search.query.toLowerCase();

    const results = state.messages.filter((message) => {
      return String(message.text || "")
        .toLowerCase()
        .includes(q);
    });

    if (!results.length) {
      resultContainer.innerHTML = renderEmptyState({
        title: "لا توجد نتائج",
        description:
          "لم يتم العثور على بيانات مطابقة في البيانات المتاحة حالياً."
      });

      return;
    }

    resultContainer.innerHTML = results
      .map(
        (message) => `
          <button
            class="nova-search-result"
            type="button"
            data-search-message="${escapeHTML(message.id)}"
          >
            <span>${escapeHTML(message.text)}</span>
            <small>${escapeHTML(message.time || "")}</small>
          </button>
        `
      )
      .join("");
  }

  /* =========================================================
     25 — STATUS / STORIES
     ========================================================= */

  function openStatusViewer(index = 0) {
    state.status.viewerOpen = true;
    state.status.index = index;

    openModal({
      title: "الحالة",
      type: "status-viewer",
      body: `
        <div class="nova-status-viewer">

          <div class="nova-status-progress">
            <span></span>
          </div>

          <div class="nova-status-content">
            ${renderEmptyState({
              title: "لا توجد حالات",
              description:
                "ستظهر الحالات الحقيقية هنا بعد إضافة بيانات الحساب."
            })}
          </div>

          <div class="nova-status-reply">
            <input
              type="text"
              placeholder="اكتب ردًا..."
              disabled
            >
            <button
              type="button"
              disabled
              title="سيتم تفعيله مع الحالات الحقيقية"
            >
              ➤
            </button>
          </div>

        </div>
      `
    });
  }

  /* =========================================================
     26 — CALL UI
     ========================================================= */

  function openCallUI(type = "voice", contact = null) {
    state.call.active = true;
    state.call.type = type;
    state.call.direction = "outgoing";
    state.call.contact = contact;

    const contactName =
      contact?.name ||
      contact?.title ||
      "مكالمة NOVA";

    const modal = openModal({
      title: type === "video" ? "مكالمة فيديو" : "مكالمة صوتية",
      type: "call",
      body: `
        <div class="nova-call-screen">

          <div class="nova-call-avatar">
            ${
              contact?.avatar
                ? `<img src="${escapeHTML(contact.avatar)}" alt="">`
                : escapeHTML(contactName.charAt(0))
            }
          </div>

          <h2>${escapeHTML(contactName)}</h2>

          <p class="nova-call-state">
            جاري الاتصال...
          </p>

          ${
            type === "video"
              ? `
                <div class="nova-local-video">
                  <span>الكاميرا</span>
                </div>
              `
              : ""
          }

          <div class="nova-call-controls">

            <button
              type="button"
              data-call-action="mute"
              title="كتم"
            >
              🎙
            </button>

            ${
              type === "video"
                ? `
                  <button
                    type="button"
                    data-call-action="camera"
                    title="الكاميرا"
                  >
                    ▣
                  </button>
                `
                : ""
            }

            <button
              type="button"
              data-call-action="speaker"
              title="مكبر الصوت"
            >
              🔊
            </button>

            <button
              type="button"
              class="hangup"
              data-call-action="hangup"
              title="إنهاء"
            >
              ☎
            </button>

          </div>

          <small class="nova-call-note">
            الاتصال الفعلي سيتم تشغيله عبر WebRTC في المرحلة الثانية.
          </small>

        </div>
      `
    });

    if (modal) {
      modal.dataset.callType = type;
    }
  }

  function handleCallAction(action) {
    switch (action) {
      case "mute":
        state.call.muted = !state.call.muted;
        toast(
          state.call.muted
            ? "تم كتم الميكروفون"
            : "تم تشغيل الميكروفون"
        );
        break;

      case "camera":
        state.call.camera = !state.call.camera;
        toast(
          state.call.camera
            ? "تم تشغيل الكاميرا"
            : "تم إيقاف الكاميرا"
        );
        break;

      case "speaker":
        state.call.speaker = !state.call.speaker;
        toast(
          state.call.speaker
            ? "تم تشغيل مكبر الصوت"
            : "تم إيقاف مكبر الصوت"
        );
        break;

      case "hangup":
        endCall();
        break;

      default:
        break;
    }
  }

  function endCall() {
    state.call.active = false;
    state.call.type = null;
    state.call.direction = null;
    state.call.contact = null;

    closeModal();

    toast("تم إنهاء واجهة المكالمة");
  }

  /* =========================================================
     27 — PROFILE
     ========================================================= */

  function openProfile() {
    showView("profile");
  }

  function openProfileEditor() {
    openModal({
      title: "تعديل الملف الشخصي",
      type: "profile-editor",
      body: `
        <form id="nova-profile-form" class="nova-profile-form">

          <label>
            الاسم
            <input
              type="text"
              name="name"
              placeholder="اسمك"
            >
          </label>

          <label>
            اسم المستخدم
            <input
              type="text"
              name="username"
              placeholder="@username"
            >
          </label>

          <label>
            نبذة
            <textarea
              name="about"
              placeholder="اكتب نبذة عنك"
            ></textarea>
          </label>

          <button
            type="submit"
            class="nova-button primary"
          >
            حفظ محليًا
          </button>

          <small>
            الحفظ النهائي في الحساب سيتم بعد ربط المصادقة وقاعدة البيانات.
          </small>

        </form>
      `
    });
  }

  /* =========================================================
     28 — SETTINGS
     ========================================================= */

  function loadSettings() {
    const saved = storage.get(
      CONFIG.storage?.settings || "nova.settings",
      {}
    );

    if (saved && typeof saved === "object") {
      state.settings = {
        ...state.settings,
        ...saved
      };
    }

    applySettings();
  }

  function saveSettings() {
    storage.set(
      CONFIG.storage?.settings || "nova.settings",
      state.settings
    );
  }

  function applySettings() {
    document.documentElement.dataset.theme =
      state.settings.theme;

    document.body.dataset.theme =
      state.settings.theme;

    document.body.dataset.wallpaper =
      state.settings.wallpaper;

    document.documentElement.style.setProperty(
      "--nova-wallpaper",
      state.settings.wallpaper
    );
  }

  function updateSetting(key, value) {
    if (!(key in state.settings)) {
      return;
    }

    state.settings[key] = value;

    saveSettings();
    applySettings();

    toast("تم تحديث الإعداد");
  }

  /* =========================================================
     29 — FILE INPUT
     ========================================================= */

  function createHiddenFileInput(accept = "*/*", multiple = false) {
    const input = create("input");

    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = "none";

    document.body.appendChild(input);

    input.addEventListener("change", () => {
      const files = Array.from(input.files || []);

      if (!files.length) {
        input.remove();
        return;
      }

      toast(
        `${files.length} ملف جاهز للرفع عند ربط التخزين`,
        "info"
      );

      document.dispatchEvent(
        new CustomEvent("nova:files:selected", {
          detail: {
            files
          }
        })
      );

      input.remove();
    });

    input.click();
  }

  /* =========================================================
     30 — CONTACTS
     ========================================================= */

  function openContacts() {
    showView("contacts");
  }

  function openNewChat() {
    openModal({
      title: "محادثة جديدة",
      type: "new-chat",
      body: `
        <div class="nova-new-chat">

          <button type="button" data-new-chat-action="contact">
            <span>♙</span>
            <strong>جهة اتصال</strong>
          </button>

          <button type="button" data-new-chat-action="group">
            <span>◎</span>
            <strong>مجموعة جديدة</strong>
          </button>

          <button type="button" data-new-chat-action="community">
            <span>◈</span>
            <strong>مجتمع جديد</strong>
          </button>

        </div>
      `
    });
  }

  /* =========================================================
     31 — GROUPS
     ========================================================= */

  function openGroup(group = null) {
    if (!group) {
      showView("groups");
      return;
    }

    openModal({
      title: group.name || "المجموعة",
      type: "group",
      body: `
        <div class="nova-group-details">

          <div class="nova-group-cover"></div>

          <h3>${escapeHTML(group.name || "مجموعة")}</h3>

          <p>
            لا توجد بيانات أعضاء محفوظة في هذه المرحلة.
          </p>

          <div class="nova-group-actions">
            <button type="button" data-group-action="media">
              الوسائط
            </button>

            <button type="button" data-group-action="files">
              الملفات
            </button>

            <button type="button" data-group-action="links">
              الروابط
            </button>

            <button type="button" data-group-action="settings">
              إعدادات المجموعة
            </button>
          </div>

        </div>
      `
    });
  }

  /* =========================================================
     32 — COMMUNITIES
     ========================================================= */

  function openCommunities() {
    showView("communities");
  }

  /* =========================================================
     33 — NOTIFICATION CENTER
     ========================================================= */

  function openNotifications() {
    openModal({
      title: "الإشعارات",
      type: "notifications",
      body: renderEmptyState({
        title: "لا توجد إشعارات",
        description:
          "عندما تصل إشعارات حقيقية من النظام ستظهر هنا."
      })
    });
  }

  /* =========================================================
     34 — MAIN MENU
     ========================================================= */

  function openMainMenu(anchor = null) {
    const old = byId("nova-main-menu");

    if (old) {
      old.remove();
      return;
    }

    const menu = create(
      "div",
      "nova-main-menu"
    );

    menu.id = "nova-main-menu";

    menu.innerHTML = `
      <button type="button" data-menu-action="new-chat">
        <span>＋</span>
        محادثة جديدة
      </button>

      <button type="button" data-menu-action="new-group">
        <span>◎</span>
        مجموعة جديدة
      </button>

      <button type="button" data-menu-action="communities">
        <span>◈</span>
        المجتمعات
      </button>

      <button type="button" data-menu-action="starred">
        <span>★</span>
        الرسائل المميزة
      </button>

      <button type="button" data-menu-action="settings">
        <span>⚙</span>
        الإعدادات
      </button>

      <div class="nova-menu-divider"></div>

      <button type="button" data-menu-action="about">
        <span>ⓘ</span>
        عن NOVA
      </button>
    `;

    document.body.appendChild(menu);

    if (anchor) {
      const rect = anchor.getBoundingClientRect();

      menu.style.top = `${rect.bottom + 8}px`;
      menu.style.right = `${Math.max(
        8,
        window.innerWidth - rect.right
      )}px`;
    }

    requestAnimationFrame(() => {
      menu.classList.add("active");
    });
  }

  /* =========================================================
     35 — ABOUT NOVA
     ========================================================= */

  function openAbout() {
    openModal({
      title: "عن NOVA",
      type: "about",
      body: `
        <div class="nova-about">

          <div class="nova-about-logo">
            N
          </div>

          <h2>NOVA</h2>

          <p>
            منصة تواصل ومراسلة حديثة بهوية أصلية.
          </p>

          <div class="nova-about-version">
            الإصدار ${escapeHTML(APP.version)}
          </div>

          <small>
            واجهة المرحلة الأولى — بدون قاعدة بيانات أو بيانات وهمية.
          </small>

        </div>
      `
   
