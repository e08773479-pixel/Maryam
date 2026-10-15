"use strict";

(() => {
  const CONFIG = {
    appName: "JOKER",
    storagePrefix: "joker_",
    animationDuration: 220,
    searchDelay: 180
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const state = {
    currentPage: "home",
    currentCategory: "all",
    searchQuery: "",
    favorites: new Set(),
    activeModal: null,
    searchTimer: null,
    toastTimer: null
  };

  const storage = {
    get(key, fallback = null) {
      try {
        const value = localStorage.getItem(CONFIG.storagePrefix + key);
        return value === null ? fallback : JSON.parse(value);
      } catch {
        return fallback;
      }
    },

    set(key, value) {
      try {
        localStorage.setItem(CONFIG.storagePrefix + key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(CONFIG.storagePrefix + key);
      } catch {}
    }
  };

  function normalizeText(value) {
    return String(value ?? "")
      .trim()
      .toLocaleLowerCase("ar")
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/\s+/g, " ");
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function announce(message, type = "info") {
    let toast = $("#joker-toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "joker-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      toast.style.cssText = [
        "position:fixed",
        "z-index:99999",
        "bottom:24px",
        "left:50%",
        "transform:translate(-50%,20px)",
        "opacity:0",
        "max-width:min(90vw,420px)",
        "padding:13px 18px",
        "border:1px solid rgba(212,175,55,.4)",
        "border-radius:14px",
        "background:#10120f",
        "color:#fff",
        "font:500 14px/1.7 system-ui,sans-serif",
        "box-shadow:0 12px 40px rgba(0,0,0,.4)",
        "transition:opacity .2s ease,transform .2s ease",
        "text-align:center"
      ].join(";");

      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.dataset.type = type;
    toast.style.borderColor =
      type === "error" ? "#e05a5a" :
      type === "success" ? "#28b878" :
      "rgba(212,175,55,.4)";

    clearTimeout(state.toastTimer);
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translate(-50%,0)";
    });

    state.toastTimer = setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translate(-50%,20px)";
    }, 3000);
  }

  function setPage(pageName, options = {}) {
    const target = normalizeText(pageName || "home") || "home";
    const pageElements = $$("[data-page]");
    let matched = false;

    pageElements.forEach(page => {
      const active = normalizeText(page.dataset.page) === target;
      page.hidden = !active;
      page.classList.toggle("active", active);
      page.setAttribute("aria-hidden", String(!active));
      if (active) matched = true;
    });

    if (!matched) {
      const fallback = $(`[data-page="${CSS.escape(target)}"]`);
      if (fallback) {
        fallback.hidden = false;
        matched = true;
      }
    }

    if (!matched) {
      announce("الصفحة دي لسه مش موجودة في واجهة المشروع.");
      return false;
    }

    state.currentPage = target;

    $$("[data-nav]").forEach(link => {
      const active = normalizeText(link.dataset.nav) === target;
      link.classList.toggle("active", active);

      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    closeMobileMenu();
    closeModal();

    if (options.scroll !== false) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    document.dispatchEvent(new CustomEvent("joker:pagechange", {
      detail: { page: target }
    }));

    return true;
  }

  function getGameCards() {
    return $$("[data-game], .game-card, [data-game-id]");
  }

  function getCardName(card) {
    return card.dataset.gameName ||
      card.dataset.name ||
      card.dataset.game ||
      $(".game-title, .game-name, h3, h4", card)?.textContent ||
      card.getAttribute("aria-label") ||
      "";
  }

  function getCardCategory(card) {
    return normalizeText(
      card.dataset.category ||
      card.dataset.gameCategory ||
      "all"
    );
  }

  function getCardId(card) {
    return String(
      card.dataset.gameId ||
      card.dataset.id ||
      card.id ||
      getCardName(card)
    ).trim();
  }

  function applyGameFilters() {
    const cards = getGameCards();
    const query = normalizeText(state.searchQuery);
    const category = normalizeText(state.currentCategory);
    let visibleCount = 0;

    cards.forEach(card => {
      const name = normalizeText(getCardName(card));
      const description = normalizeText(
        card.dataset.description ||
        $(".game-description, p", card)?.textContent ||
        ""
      );

      const cardCategory = getCardCategory(card);
      const isFavorite = state.favorites.has(getCardId(card));

      const matchesSearch =
        !query || name.includes(query) || description.includes(query);

      const matchesCategory =
        category === "all" ||
        cardCategory === category ||
        normalizeText(card.dataset.categoryLabel) === category;

      const matchesFavorite =
        category !== "favorites" || isFavorite;

      const visible = matchesSearch && matchesCategory && matchesFavorite;

      card.hidden = !visible;
      card.classList.toggle("filtered-out", !visible);

      if (visible) visibleCount++;
    });

    $$("[data-empty-results]").forEach(element => {
      element.hidden = visibleCount !== 0;
    });

    $$("[data-results-count]").forEach(element => {
      element.textContent = String(visibleCount);
    });

    document.dispatchEvent(new CustomEvent("joker:gamesfiltered", {
      detail: {
        query,
        category,
        visibleCount
      }
    }));
  }

  function selectCategory(category, clickedElement) {
    state.currentCategory = normalizeText(category || "all");

    $$("[data-category-filter], [data-filter]").forEach(element => {
      const value = normalizeText(
        element.dataset.categoryFilter ||
        element.dataset.filter
      );

      const active = value === state.currentCategory;
      element.classList.toggle("active", active);
      element.setAttribute("aria-pressed", String(active));
    });

    if (clickedElement) {
      clickedElement.classList.add("active");
    }

    applyGameFilters();
  }

  function handleSearch(input) {
    state.searchQuery = input.value || "";

    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => {
      applyGameFilters();
    }, CONFIG.searchDelay);
  }

  function toggleFavorite(cardOrId) {
    const id = typeof cardOrId === "string"
      ? cardOrId
      : getCardId(cardOrId);

    if (!id) return;

    if (state.favorites.has(id)) {
      state.favorites.delete(id);
      announce("اتشالت من المفضلة.");
    } else {
      state.favorites.add(id);
      announce("اتضافت للمفضلة.", "success");
    }

    const saved = storage.set("favorites", [...state.favorites]);

    if (!saved) {
      announce("المفضلة اتحدثت للجلسة الحالية، لكن تعذر حفظها على الجهاز.", "error");
    }

    updateFavoriteButtons();
    applyGameFilters();

    document.dispatchEvent(new CustomEvent("joker:favoritechange", {
      detail: {
        id,
        favorites: [...state.favorites]
      }
    }));
  }

  function updateFavoriteButtons() {
    $$("[data-favorite]").forEach(button => {
      const card = button.closest("[data-game], .game-card, [data-game-id]");
      const id = button.dataset.favorite || (card && getCardId(card));

      if (!id) return;

      const active = state.favorites.has(String(id));
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", active ? "إزالة من المفضلة" : "إضافة للمفضلة");

      const label = $("[data-favorite-label]", button);
      if (label) label.textContent = active ? "في المفضلة" : "المفضلة";
    });
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      announce("النافذة المطلوبة مش موجودة في الصفحة.");
      return false;
    }

    closeModal();

    state.activeModal = modal;
    modal.hidden = false;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");

    const focusable = $$(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      modal
    );

    setTimeout(() => focusable[0]?.focus(), 20);
    document.body.classList.add("modal-open");

    return true;
  }

  function closeModal() {
    if (!state.activeModal) {
      document.body.classList.remove("modal-open");
      return;
    }

    state.activeModal.classList.remove("open");
    state.activeModal.hidden = true;
    state.activeModal.setAttribute("aria-hidden", "true");
    state.activeModal = null;
    document.body.classList.remove("modal-open");
  }

  function openMobileMenu() {
    const menu = $("[data-mobile-menu]") || $(".sidebar");
    if (!menu) return;

    menu.classList.add("mobile-open");
    document.body.classList.add("menu-open");

    const closeButton = $("[data-menu-close]", menu);
    closeButton?.focus();
  }

  function closeMobileMenu() {
    const menu = $("[data-mobile-menu]") || $(".sidebar");
    menu?.classList.remove("mobile-open");
    document.body.classList.remove("menu-open");
  }

  function toggleMobileMenu() {
    const menu = $("[data-mobile-menu]") || $(".sidebar");
    if (!menu) return;

    menu.classList.contains("mobile-open")
      ? closeMobileMenu()
      : openMobileMenu();
  }

  function setTheme(theme) {
    const validTheme = ["dark", "light"].includes(theme) ? theme : "dark";

    document.documentElement.dataset.theme = validTheme;
    storage.set("theme", validTheme);

    $$("[data-theme-toggle]").forEach(button => {
      button.setAttribute("aria-pressed", String(validTheme === "light"));
    });

    document.dispatchEvent(new CustomEvent("joker:themechange", {
      detail: { theme: validTheme }
    }));
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme || "dark";
    setTheme(current === "dark" ? "light" : "dark");
  }

  function showComingSoon(featureName) {
    const name = featureName || "الميزة دي";
    announce(`${name}: محتاجة استكمال الربط قبل التشغيل الفعلي.`);
  }

  function requestOnlineMatch(options = {}) {
    const mode = options.mode || "random";
    const gameId = options.gameId || "";
    const endpoint = document.documentElement.dataset.apiBase;

    if (!endpoint) {
      announce(
        "اللعب أونلاين محتاج Backend واتصال حقيقي عشان نلاقي لاعبين فعليين.",
        "error"
      );
      return;
    }

    if (!navigator.onLine) {
      announce("مفيش اتصال بالإنترنت حاليًا.", "error");
      return;
    }

    document.dispatchEvent(new CustomEvent("joker:matchrequest", {
      detail: { mode, gameId }
    }));

    announce("تم إرسال طلب بدء البحث. حالة المطابقة تعتمد على السيرفر.");
  }

  function setButtonLoading(button, loading, label = "جاري التنفيذ...") {
    if (!button) return;

    if (loading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent.trim();
      }

      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = label;
    } else {
      button.disabled = false;
      button.removeAttribute("aria-busy");

      if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  }

  function validateForm(form) {
    let firstInvalid = null;

    $$("input, textarea, select", form).forEach(field => {
      if (field.disabled || field.type === "hidden") return;

      const valid = field.checkValidity();
      field.setAttribute("aria-invalid", String(!valid));

      if (!valid && !firstInvalid) {
        firstInvalid = field;
      }
    });

    if (firstInvalid) {
      firstInvalid.reportValidity();
      firstInvalid.focus();
      return false;
    }

    return true;
  }

  function handleFormSubmit(form) {
    if (!validateForm(form)) return;

    const formName = form.dataset.jokerForm || form.dataset.form || "";

    if (formName === "search-friend") {
      const input = $('input[name="friend"], input[name="username"]', form);
      const query = input?.value.trim();

      if (!query) {
        announce("اكتب اسم المستخدم أو المعرّف الأول.");
        return;
      }

      const endpoint = document.documentElement.dataset.apiBase;

      if (!endpoint) {
        announce("البحث عن مستخدمين حقيقيين محتاج Backend متصل.");
        return;
      }

      document.dispatchEvent(new CustomEvent("joker:friendsearch", {
        detail: { query }
      }));

      announce("تم تجهيز طلب البحث؛ لازم يتربط بمسار API فعلي.");
      return;
    }

    if (formName === "contact") {
      announce("نموذج التواصل محتاج ربط بخدمة استقبال الرسائل.");
      return;
    }

    if (formName === "settings") {
      const formData = new FormData(form);
      const settings = {};

      for (const [key, value] of formData.entries()) {
        settings[key] = value;
      }

      const saved = storage.set("settings", settings);
      announce(
        saved ? "تم حفظ الإعدادات على الجهاز." : "تعذر حفظ الإعدادات.",
        saved ? "success" : "error"
      );
      return;
    }

    if (formName === "login" || formName === "register") {
      announce("تسجيل الدخول الحقيقي محتاج نظام مصادقة آمن على السيرفر.");
      return;
    }

    if (formName === "matchmaking") {
      requestOnlineMatch({
        mode: form.dataset.matchMode || "random",
        gameId: form.dataset.gameId || ""
      });
      return;
    }

    document.dispatchEvent(new CustomEvent("joker:formsubmit", {
      detail: {
        name: formName,
        form
      }
    }));
  }

  function restoreSettings() {
    const favorites = storage.get("favorites", []);
    state.favorites = new Set(Array.isArray(favorites) ? favorites : []);

    const theme = storage.get("theme", "dark");
    setTheme(theme);

    const settings = storage.get("settings", {});

    $$("[data-setting]").forEach(field => {
      const key = field.dataset.setting;
      if (!(key in settings)) return;

      if (field.type === "checkbox") {
        field.checked = Boolean(settings[key]);
      } else {
        field.value = settings[key];
      }
    });

    updateFavoriteButtons();
  }

  function setupKeyboard() {
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeModal();
        closeMobileMenu();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        const search = $("[data-search], #gameSearch, input[type='search']");
        if (search) {
          event.preventDefault();
          search.focus();
        }
      }

      if (state.activeModal && event.key === "Tab") {
        const items = $$(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          state.activeModal
        ).filter(element => !element.hidden);

        if (!items.length) return;

        const first = items[0];
        const last = items[items.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }

  function setupDelegatedEvents() {
    document.addEventListener("click", event => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const nav = target.closest("[data-nav]");
      if (nav) {
        event.preventDefault();
        setPage(nav.dataset.nav);
        return;
      }

      const pageButton = target.closest("[data-go-page]");
      if (pageButton) {
        event.preventDefault();
        setPage(pageButton.dataset.goPage);
        return;
      }

      const category = target.closest("[data-category-filter], [data-filter]");
      if (category) {
        event.preventDefault();
        selectCategory(
          category.dataset.categoryFilter || category.dataset.filter,
          category
        );
        return;
      }

      const favoriteButton = target.closest("[data-favorite]");
      if (favoriteButton) {
        event.preventDefault();

        const card = favoriteButton.closest("[data-game], .game-card, [data-game-id]");
        const id = favoriteButton.dataset.favorite || (card && getCardId(card));

        if (id) toggleFavorite(id);
        return;
      }

      const modalTrigger = target.closest("[data-modal-open]");
      if (modalTrigger) {
        event.preventDefault();
        openModal(modalTrigger.dataset.modalOpen);
        return;
      }

      if (target.closest("[data-modal-close]")) {
        event.preventDefault();
        closeModal();
        return;
      }

      if (state.activeModal && target === state.activeModal) {
        closeModal();
        return;
      }

      if (target.closest("[data-menu-toggle]")) {
        event.preventDefault();
        toggleMobileMenu();
        return;
      }

      if (target.closest("[data-menu-close]")) {
        event.preventDefault();
        closeMobileMenu();
        return;
      }

      if (target.closest("[data-theme-toggle]")) {
        event.preventDefault();
        toggleTheme();
        return;
      }

      const launchButton = target.closest("[data-launch-game]");
      if (launchButton) {
        event.preventDefault();

        const gameId = launchButton.dataset.launchGame;
        const card = launchButton.closest("[data-game], .game-card, [data-game-id]");
        const gameName = card ? getCardName(card) : gameId;

        document.dispatchEvent(new CustomEvent("joker:launchgame", {
          detail: {
            gameId,
            gameName,
            card
          }
        }));

        const destination = launchButton.dataset.gamePage;

        if (destination) {
          setPage(destination);
        } else {
          showComingSoon(`تشغيل ${gameName || "اللعبة"}`);
        }

        return;
      }

      const matchButton = target.closest("[data-matchmaking], [data-find-match]");
      if (matchButton) {
        event.preventDefault();

        requestOnlineMatch({
          mode: matchButton.dataset.matchmaking || "random",
          gameId: matchButton.dataset.gameId || ""
        });

        return;
      }

      const featureButton = target.closest("[data-feature]");
      if (featureButton) {
        event.preventDefault();
        showComingSoon(featureButton.dataset.feature);
      }
    });

    document.addEventListener("input", event => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;

      if (
        target.matches("[data-search]") ||
        target.id === "gameSearch" ||
        target.matches('input[type="search"]')
      ) {
        handleSearch(target);
      }
    });

    document.addEventListener("submit", event => {
      const form = event.target;

      if (!(form instanceof HTMLFormElement)) return;

      if (form.matches("[data-joker-form], [data-form]")) {
        event.preventDefault();
        handleFormSubmit(form);
      }
    });
  }

  function setupConnectivity() {
    window.addEventListener("online", () => {
      announce("رجع اتصال الإنترنت.", "success");
    });

    window.addEventListener("offline", () => {
      announce("أنت غير متصل بالإنترنت. اللعب الأونلاين قد لا يعمل.", "error");
    });
  }

  function setupNavigationFallback() {
    const hash = window.location.hash.replace(/^#\/?/, "").trim();

    if (hash) {
      const page = hash.split("/")[0];
      if ($(`[data-page="${CSS.escape(page)}"]`)) {
        setPage(page, { scroll: false });
      }
    }

    window.addEventListener("hashchange", () => {
      const page = window.location.hash.replace(/^#\/?/, "").split("/")[0];
      if (page && $(`[data-page="${CSS.escape(page)}"]`)) {
        setPage(page, { scroll: false });
      }
    });

    document.addEventListener("joker:pagechange", event => {
      const page = event.detail.page;
      if (window.location.hash !== `#${page}`) {
        history.replaceState(null, "", `#${page}`);
      }
    });
  }

  function setupAccessibility() {
    $$("[data-page]").forEach(page => {
      if (!page.classList.contains("active") && !page.hidden) {
        page.hidden = true;
      }

      page.setAttribute("aria-hidden", String(page.hidden));
    });

    $$("[data-modal]").forEach(modal => {
      if (!modal.classList.contains("open")) {
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
      }
    });
  }

  function setupCurrentYear() {
    $$("[data-current-year]").forEach(element => {
      element.textContent = String(new Date().getFullYear());
    });
  }

  function init() {
    restoreSettings();
    setupAccessibility();
    setupDelegatedEvents();
    setupKeyboard();
    setupConnectivity();
    setupNavigationFallback();
    setupCurrentYear();
    applyGameFilters();

    document.documentElement.dataset.app = "joker";

    document.dispatchEvent(new CustomEvent("joker:ready", {
      detail: {
        name: CONFIG.appName,
        page: state.currentPage
      }
    }));

    console.info("JOKER initialized.");
  }

  window.JOKER = Object.freeze({
    state,
    setPage,
    selectCategory,
    applyGameFilters,
    toggleFavorite,
    openModal,
    closeModal,
    announce,
    requestOnlineMatch,
    showComingSoon,
    setTheme,
    storage,
    escapeHTML
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
