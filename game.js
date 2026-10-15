"use strict";

(() => {
  const TOTAL_LEVELS = 3000;
  const INITIAL_COINS = 100;
  const HINT_COSTS = {
    reveal: 10,
    remove: 15,
    text: 20
  };

  const STORAGE_KEY = "wordPuzzleGameSaveV1";
  const LEVELS_PER_PAGE = 100;

  const $ = (selector) => document.querySelector(selector);

  const elements = {
    homeScreen: $("#home-screen"),
    gameScreen: $("#game-screen"),
    mapScreen: $("#map-screen"),
    shopScreen: $("#shop-screen"),
    settingsScreen: $("#settings-screen"),

    coinBalance: $("#coin-balance"),
    homeCurrentLevel: $("#home-current-level"),
    homeCompletedLevels: $("#home-completed-levels"),

    levelNumber: $("#level-number"),
    puzzleNumber: $("#puzzle-number"),
    puzzleImage: $("#puzzle-image"),
    imageFallback: $("#image-fallback"),
    puzzleInstruction: $("#puzzle-instruction"),

    answerSlots: $("#answer-slots"),
    letterBank: $("#letter-bank"),
    answerFeedback: $("#answer-feedback"),
    lettersRemaining: $("#letters-remaining"),

    levelProgressBar: $("#level-progress-bar"),
    hintCost: $("#hint-cost"),

    mapProgressText: $("#map-progress-text"),
    mapCoins: $("#map-coins"),
    levelMap: $("#level-map"),
    levelPageLabel: $("#level-page-label"),

    shopCoinBalance: $("#shop-coin-balance"),
    dialogOverlay: $("#dialog-overlay"),
    dialogTitle: $("#dialog-title"),
    dialogMessage: $("#dialog-message"),
    dialogActions: $("#dialog-actions"),
    toastMessage: $("#toast-message")
  };

  const defaultSave = () => ({
    version: 1,
    coins: INITIAL_COINS,
    currentLevel: 1,
    completedLevels: [],
    claimedRewards: [],
    soundEnabled: true,
    vibrationEnabled: false,
    levelMapPage: 0
  });

  let save = loadSave();
  let currentLevelData = null;
  let selectedLetters = [];
  let availableLetters = [];
  let removedLetters = new Set();
  let locked = false;
  let toastTimer = null;
  let imageRequestId = 0;

  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSave();

      const parsed = JSON.parse(raw);
      const base = defaultSave();

      const completed = Array.isArray(parsed.completedLevels)
        ? parsed.completedLevels
            .filter(Number.isInteger)
            .filter((n) => n >= 1 && n <= TOTAL_LEVELS)
        : [];

      const claimed = Array.isArray(parsed.claimedRewards)
        ? parsed.claimedRewards
            .filter(Number.isInteger)
            .filter((n) => n >= 1 && n <= TOTAL_LEVELS)
        : [];

      return {
        ...base,
        coins: Number.isFinite(parsed.coins)
          ? Math.max(0, Math.floor(parsed.coins))
          : base.coins,
        currentLevel: Number.isInteger(parsed.currentLevel)
          ? Math.min(TOTAL_LEVELS, Math.max(1, parsed.currentLevel))
          : 1,
        completedLevels: [...new Set(completed)],
        claimedRewards: [...new Set(claimed)],
        soundEnabled: parsed.soundEnabled !== false,
        vibrationEnabled: parsed.vibrationEnabled === true,
        levelMapPage: Number.isInteger(parsed.levelMapPage)
          ? Math.max(0, Math.floor(parsed.levelMapPage))
          : 0
      };
    } catch {
      return defaultSave();
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
      return true;
    } catch {
      showToast("تعذر حفظ التقدم في هذا المتصفح.");
      return false;
    }
  }

  function normalizeArabic(value) {
    return String(value ?? "")
      .normalize("NFC")
      .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getLevel(levelId) {
    const sources = [
      window.WORD_PUZZLE_LEVELS,
      window.GAME_LEVELS,
      window.LEVELS
    ];

    for (const source of sources) {
      if (Array.isArray(source)) {
        const found = source.find((item) => item && item.id === levelId);
        if (found) return found;
      }

      if (source && typeof source === "object" && source[levelId]) {
        return source[levelId];
      }
    }

    return null;
  }

  function getAnswer(level) {
    if (!level) return "";
    return String(level.answer ?? level.answers?.[0] ?? "");
  }

  function getAnswerLetters(answer) {
    return Array.from(normalizeArabic(answer).replace(/\s/g, ""));
  }

  function getAvailableLetters(level, answer) {
    const source = Array.isArray(level.letters)
      ? level.letters.map(String)
      : getAnswerLetters(answer);

    return source.map((letter, index) => ({
      id: `${level.id}-${index}`,
      letter,
      index
    }));
  }

  function isLevelUnlocked(levelId) {
    if (levelId === 1) return true;
    return save.completedLevels.includes(levelId - 1);
  }

  function showScreen(screenId) {
    const screens = [
      elements.homeScreen,
      elements.gameScreen,
      elements.mapScreen,
      elements.shopScreen,
      elements.settingsScreen
    ];

    screens.forEach((screen) => {
      if (!screen) return;
      const active = screen.id === screenId;
      screen.hidden = !active;
      screen.classList.toggle("active", active);
    });

    document.querySelectorAll(".nav-button").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.screen === screenId
      );
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateBalances() {
    if (elements.coinBalance) {
      elements.coinBalance.textContent = save.coins.toLocaleString("ar");
    }

    if (elements.shopCoinBalance) {
      elements.shopCoinBalance.textContent = save.coins.toLocaleString("ar");
    }

    if (elements.mapCoins) {
      elements.mapCoins.textContent = save.coins.toLocaleString("ar");
    }

    if (elements.homeCurrentLevel) {
      elements.homeCurrentLevel.textContent =
        save.currentLevel.toLocaleString("ar");
    }

    if (elements.homeCompletedLevels) {
      elements.homeCompletedLevels.textContent =
        save.completedLevels.length.toLocaleString("ar");
    }

    if (elements.mapProgressText) {
      elements.mapProgressText.textContent =
        `${save.completedLevels.length.toLocaleString("ar")} / ${TOTAL_LEVELS.toLocaleString("ar")}`;
    }

    if (elements.hintCost) {
      elements.hintCost.textContent = HINT_COSTS.reveal.toLocaleString("ar");
    }
  }

  function showToast(message) {
    if (!elements.toastMessage) return;

    elements.toastMessage.textContent = message;
    elements.toastMessage.classList.add("visible");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      elements.toastMessage.classList.remove("visible");
    }, 2400);
  }

  function openDialog(title, message, actions = []) {
    if (!elements.dialogOverlay) return;

    elements.dialogTitle.textContent = title;
    elements.dialogMessage.textContent = message;
    elements.dialogActions.replaceChildren();

    actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = action.primary
        ? "primary-button"
        : "secondary-button";
      button.textContent = action.label;

      button.addEventListener("click", () => {
        closeDialog();
        if (typeof action.run === "function") action.run();
      });

      elements.dialogActions.appendChild(button);
    });

    elements.dialogOverlay.hidden = false;
  }

  function closeDialog() {
    if (elements.dialogOverlay) {
      elements.dialogOverlay.hidden = true;
    }
  }

  function updateProgressBar() {
    if (!elements.levelProgressBar) return;

    const answerLength = getAnswerLetters(getAnswer(currentLevelData)).length;
    const ratio = answerLength
      ? selectedLetters.length / answerLength
      : 0;

    elements.levelProgressBar.style.width =
      `${Math.max(0, Math.min(100, ratio * 100))}%`;
  }

  function updateFeedback(message, type = "") {
    if (!elements.answerFeedback) return;

    elements.answerFeedback.textContent = message;
    elements.answerFeedback.className =
      `feedback-message${type ? ` ${type}` : ""}`;
  }

  function renderAnswerSlots() {
    if (!elements.answerSlots) return;

    elements.answerSlots.replaceChildren();

    const answer = getAnswer(currentLevelData);
    const answerLetters = getAnswerLetters(answer);

    answerLetters.forEach((_, index) => {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "answer-slot";
      slot.setAttribute("aria-label", `خانة الإجابة ${index + 1}`);

      const selected = selectedLetters[index];

      if (selected) {
        slot.textContent = selected.letter;
        slot.classList.add("filled");
        slot.setAttribute("aria-label", `الحرف ${selected.letter}`);

        slot.addEventListener("click", () => {
          if (locked) return;
          removeSelectedLetter(index);
        });
      }

      elements.answerSlots.appendChild(slot);
    });

    updateProgressBar();
  }

  function renderLetterBank() {
    if (!elements.letterBank) return;

    elements.letterBank.replaceChildren();

    const usedIds = new Set(selectedLetters.map((item) => item.id));
    let remaining = 0;

    availableLetters.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "letter-button";
      button.textContent = item.letter;
      button.setAttribute("aria-label", `اختيار حرف ${item.letter}`);

      const isUsed = usedIds.has(item.id);
      const isRemoved = removedLetters.has(item.id);

      if (isUsed) {
        button.classList.add("used");
        button.disabled = true;
      } else if (isRemoved) {
        button.classList.add("removed");
        button.disabled = true;
      } else {
        remaining++;
        button.addEventListener("click", () => selectLetter(item));
      }

      elements.letterBank.appendChild(button);
    });

    if (elements.lettersRemaining) {
      elements.lettersRemaining.textContent =
        `${remaining.toLocaleString("ar")} حرف`;
    }
  }

  function selectLetter(item) {
    if (locked || removedLetters.has(item.id)) return;
    if (selectedLetters.some((selected) => selected.id === item.id)) return;

    const answerLength = getAnswerLetters(getAnswer(currentLevelData)).length;
    if (selectedLetters.length >= answerLength) return;

    selectedLetters.push(item);

    renderAnswerSlots();
    renderLetterBank();
    updateFeedback("");

    if (selectedLetters.length === answerLength) {
      checkAnswer();
    }
  }

  function removeSelectedLetter(index) {
    if (locked || index < 0 || index >= selectedLetters.length) return;

    selectedLetters.splice(index, 1);
    renderAnswerSlots();
    renderLetterBank();
    updateFeedback("");
  }

  function clearAnswer() {
    if (locked) return;

    selectedLetters = [];
    renderAnswerSlots();
    renderLetterBank();
    updateFeedback("");
  }

  function playSound(kind) {
    if (!save.soundEnabled) return;

    const soundMap = {
      tap: 420,
      correct: 720,
      wrong: 180
    };

    const frequency = soundMap[kind];
    if (!frequency) return;

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      const audio = new AudioContextClass();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.035;

      oscillator.connect(gain);
      gain.connect(audio.destination);

      oscillator.start();
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audio.currentTime + 0.12
      );

      oscillator.stop(audio.currentTime + 0.12);
      oscillator.onended = () => audio.close();
    } catch {
      // Audio is optional.
    }
  }

  function vibrate(pattern = 20) {
    if (!save.vibrationEnabled) return;

    try {
      if ("vibrate" in navigator) navigator.vibrate(pattern);
    } catch {
      // Vibration is optional.
    }
  }

  function loadPuzzleImage(level) {
    if (!elements.puzzleImage) return;

    const requestId = ++imageRequestId;
    const imagePath = String(level.image ?? "");

    elements.puzzleImage.hidden = false;
    elements.puzzleImage.alt = `صورة المرحلة ${level.id}`;
    elements.puzzleImage.removeAttribute("src");

    if (elements.imageFallback) {
      elements.imageFallback.hidden = true;
    }

    if (!imagePath) {
      elements.puzzleImage.hidden = true;
      if (elements.imageFallback) {
        elements.imageFallback.hidden = false;
      }
      return;
    }

    elements.puzzleImage.onload = () => {
      if (requestId !== imageRequestId) return;
      elements.puzzleImage.hidden = false;
      if (elements.imageFallback) {
        elements.imageFallback.hidden = true;
      }
    };

    elements.puzzleImage.onerror = () => {
      if (requestId !== imageRequestId) return;
      elements.puzzleImage.hidden = true;
      if (elements.imageFallback) {
        elements.imageFallback.hidden = false;
      }
    };

    elements.puzzleImage.src = imagePath;
  }

  function loadLevel(levelId, navigate = true) {
    const safeId = Math.min(TOTAL_LEVELS, Math.max(1, levelId));

    if (!isLevelUnlocked(safeId)) {
      showToast("حل المرحلة السابقة أولًا.");
      return false;
    }

    const level = getLevel(safeId);

    if (!level) {
      openDialog(
        "المرحلة غير جاهزة",
        `بيانات المرحلة ${safeId} غير موجودة في ملفات اللعبة حتى الآن.`,
        [
          { label: "العودة للرئيسية", primary: true, run: () => showScreen("home-screen") },
          { label: "خريطة المراحل", run: () => renderMap() }
        ]
      );
      return false;
    }

    const answer = getAnswer(level);
    if (!normalizeArabic(answer)) {
      showToast("بيانات إجابة هذه المرحلة غير صحيحة.");
      return false;
    }

    currentLevelData = level;
    selectedLetters = [];
    removedLetters = new Set();
    locked = false;

    availableLetters = getAvailableLetters(level, answer);

    if (elements.levelNumber) {
      elements.levelNumber.textContent = safeId.toLocaleString("ar");
    }

    if (elements.puzzleNumber) {
      elements.puzzleNumber.textContent =
        String(safeId).padStart(2, "0");
    }

    if (elements.puzzleInstruction) {
      elements.puzzleInstruction.textContent =
        level.instruction || "تأمل الصورة واكتشف الكلمة المطلوبة.";
    }

    if (elements.hintCost) {
      elements.hintCost.textContent = HINT_COSTS.reveal.toLocaleString("ar");
    }

    loadPuzzleImage(level);
    renderAnswerSlots();
    renderLetterBank();
    updateFeedback("");
    updateBalances();

    if (navigate) showScreen("game-screen");
    return true;
  }

  function checkAnswer() {
    if (locked || !currentLevelData) return;

    const answer = getAnswerLetters(getAnswer(currentLevelData)).join("");
    const guess = normalizeArabic(
      selectedLetters.map((item) => item.letter).join("")
    ).replace(/\s/g, "");

    if (guess.length !== answer.length) {
      updateFeedback("أكمل اختيار الحروف أولًا.", "error");
      return;
    }

    if (guess === answer) {
      handleCorrectAnswer();
      return;
    }

    locked = true;
    playSound("wrong");
    vibrate([20, 35, 20]);

    updateFeedback("الإجابة غير صحيحة، حاول مرة أخرى.", "error");

    elements.answerSlots?.querySelectorAll(".answer-slot").forEach((slot) => {
      slot.classList.add("wrong");
    });

    setTimeout(() => {
      locked = false;
      clearAnswer();
    }, 450);
  }

  function handleCorrectAnswer() {
    locked = true;

    const levelId = currentLevelData.id;
    const reward = Number.isFinite(currentLevelData.reward)
      ? Math.max(0, Math.floor(currentLevelData.reward))
      : 10;

    const alreadyCompleted = save.completedLevels.includes(levelId);
    const rewardClaimed = save.claimedRewards.includes(levelId);

    if (!alreadyCompleted) {
      save.completedLevels.push(levelId);
    }

    if (!rewardClaimed) {
      save.coins += reward;
      save.claimedRewards.push(levelId);
    }

    if (levelId < TOTAL_LEVELS) {
      save.currentLevel = Math.max(save.currentLevel, levelId + 1);
    }

    persist();
    updateBalances();
    updateFeedback("إجابة صحيحة! أحسنت.", "success");
    playSound("correct");
    vibrate([25, 35, 55]);

    elements.answerSlots?.querySelectorAll(".answer-slot").forEach((slot) => {
      slot.classList.remove("wrong");
      slot.classList.add("correct");
    });

    setTimeout(() => {
      openDialog(
        "إجابة صحيحة!",
        `أحسنت! ${rewardClaimed ? "لقد حللت هذه المرحلة من قبل." : `حصلت على ${reward} عملات.`}`,
        [
          {
            label: "المرحلة التالية",
            primary: true,
            run: () => {
              locked = false;
              loadLevel(Math.min(TOTAL_LEVELS, levelId + 1));
            }
          },
          {
            label: "خريطة المراحل",
            run: () => {
              locked = false;
              renderMap();
            }
          }
        ]
      );
    }, 250);
  }

  function spendCoins(cost) {
    if (save.coins < cost) {
      showToast("رصيدك من العملات غير كافٍ.");
      return false;
    }

    save.coins -= cost;
    persist();
    updateBalances();
    return true;
  }

  function revealHint() {
    if (!currentLevelData || locked) return;

    const cost = HINT_COSTS.reveal;
    if (!spendCoins(cost)) return;

    const answer = getAnswerLetters(getAnswer(currentLevelData));
    const index = answer.findIndex((letter, i) =>
      !selectedLetters[i] || selectedLetters[i].letter !== letter
    );

    if (index < 0) {
      save.coins += cost;
      persist();
      updateBalances();
      showToast("كل الحروف الصحيحة موجودة بالفعل.");
      return;
    }

    const requiredLetter = answer[index];

    const existingSelectedIndex = selectedLetters.findIndex(
      (item, i) => i !== index && item.letter === requiredLetter
    );

    if (existingSelectedIndex >= 0) {
      const existing = selectedLetters[existingSelectedIndex];
      selectedLetters.splice(existingSelectedIndex, 1);
      selectedLetters.splice(index, 0, existing);
    } else {
      const availableIndex = availableLetters.findIndex(
        (item) =>
          item.letter === requiredLetter &&
          !removedLetters.has(item.id) &&
          !selectedLetters.some((selected) => selected.id === item.id)
      );

      if (availableIndex < 0) {
        save.coins += cost;
        persist();
        updateBalances();
        showToast("تعذر العثور على الحرف المطلوب.");
        return;
      }

      const item = availableLetters[availableIndex];
      selectedLetters.splice(index, 0, item);
    }

    renderAnswerSlots();
    renderLetterBank();
    showToast("تم كشف حرف صحيح.");
  }

  function removeExtraLetters() {
    if (!currentLevelData || locked) return;

    const cost = HINT_COSTS.remove;
    if (!spendCoins(cost)) return;

    const answerLetters = getAnswerLetters(getAnswer(currentLevelData));
    const neededCounts = new Map();

    answerLetters.forEach((letter) => {
      neededCounts.set(letter, (neededCounts.get(letter) || 0) + 1);
    });

    selectedLetters.forEach((item) => {
      const count = neededCounts.get(item.letter) || 0;
      neededCounts.set(item.letter, Math.max(0, count - 1));
    });

    availableLetters.forEach((item) => {
      if (selectedLetters.some((selected) => selected.id === item.id)) return;
      if (removedLetters.has(item.id)) return;

      const count = neededCounts.get(item.letter) || 0;

      if (count > 0) {
        neededCounts.set(item.letter, count - 1);
      } else {
        removedLetters.add(item.id);
      }
    });

    renderLetterBank();
    showToast("تم حذف الحروف الزائدة.");
  }

  function showTextHint() {
    if (!currentLevelData || locked) return;

    const cost = HINT_COSTS.text;
    if (!spendCoins(cost)) return;

    const hint = currentLevelData.hint;

    if (!hint) {
      save.coins += cost;
      persist();
      updateBalances();
      showToast("لا يوجد تلميح نصي لهذه المرحلة.");
      return;
    }

    openDialog("تلميح", String(hint), [
      { label: "متابعة اللعب", primary: true }
    ]);
  }

  function renderMap() {
    showScreen("map-screen");

    if (!elements.levelMap) return;

    const totalPages = Math.ceil(TOTAL_LEVELS / LEVELS_PER_PAGE);
    save.levelMapPage = Math.min(
      Math.max(0, save.levelMapPage),
      totalPages - 1
    );

    const start = save.levelMapPage * LEVELS_PER_PAGE + 1;
    const end = Math.min(TOTAL_LEVELS, start + LEVELS_PER_PAGE - 1);

    elements.levelMap.replaceChildren();

    for (let id = start; id <= end; id++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "map-level";
      button.textContent = id.toLocaleString("ar");
      button.setAttribute("aria-label", `المرحلة ${id}`);

      const completed = save.completedLevels.includes(id);
      const current = id === save.currentLevel;
      const unlocked = isLevelUnlocked(id);

      if (completed) button.classList.add("completed");
      if (current) button.classList.add("current");
      if (!unlocked) {
        button.classList.add("locked");
        button.disabled = true;
        button.textContent = "🔒";
        button.setAttribute("aria-label", `المرحلة ${id} مقفولة`);
      }

      button.addEventListener("click", () => {
        if (!isLevelUnlocked(id)) {
          showToast("حل المرحلة السابقة أولًا.");
          return;
        }
        loadLevel(id);
      });

      elements.levelMap.appendChild(button);
    }

    if (elements.levelPageLabel) {
      elements.levelPageLabel.textContent =
        `المجموعة ${save.levelMapPage + 1} من ${totalPages}`;
    }

    const previousButton = $("#previous-level-page");
    const nextButton = $("#next-level-page");

    if (previousButton) previousButton.disabled = save.levelMapPage <= 0;
    if (nextButton) nextButton.disabled = save.levelMapPage >= totalPages - 1;

    updateBalances();
    persist();
  }

  function changeMapPage(direction) {
    const totalPages = Math.ceil(TOTAL_LEVELS / LEVELS_PER_PAGE);

    save.levelMapPage = Math.min(
      totalPages - 1,
      Math.max(0, save.levelMapPage + direction)
    );

    persist();
    renderMap();
  }

  function buyHint(type) {
    if (!currentLevelData) {
      showToast("ابدأ مرحلة أولًا لاستخدام المساعدات.");
      return;
    }

    if (type === "reveal") revealHint();
    else if (type === "remove") removeExtraLetters();
    else if (type === "text") showTextHint();

    showScreen("game-screen");
  }

  function resetProgress() {
    openDialog(
      "إعادة ضبط التقدم",
      "هل تريد حذف تقدمك ورصيدك المحفوظ؟ لا يمكن التراجع عن هذه العملية.",
      [
        { label: "إلغاء" },
        {
          label: "إعادة الضبط",
          primary: true,
          run: () => {
            save = defaultSave();
            persist();
            updateBalances();
            renderMap();
            showToast("تمت إعادة ضبط التقدم.");
          }
        }
      ]
    );
  }

  function bindEvents() {
    $("#play-button")?.addEventListener("click", () => {
      loadLevel(save.currentLevel);
    });

    $("#continue-button")?.addEventListener("click", () => {
      loadLevel(save.currentLevel);
    });

    $("#home-button")?.addEventListener("click", () => {
      showScreen("home-screen");
      updateBalances();
    });

    $("#map-back-button")?.addEventListener("click", () => {
      showScreen("home-screen");
    });

    $("#shop-back-button")?.addEventListener("click", () => {
      showScreen("home-screen");
    });

    $("#settings-back-button")?.addEventListener("click", () => {
      showScreen("home-screen");
    });

    $("#settings-button")?.addEventListener("click", () => {
      showScreen("settings-screen");
    });

    $("#shop-button")?.addEventListener("click", () => {
      showScreen("shop-screen");
    });

    $("#hint-button")?.addEventListener("click", revealHint);

    $("#clear-answer-button")?.addEventListener("click", clearAnswer);

    $("#check-answer-button")?.addEventListener("click", checkAnswer);

    $("#remove-letters-button")?.addEventListener("click", removeExtraLetters);

    $("#previous-level-page")?.addEventListener("click", () => {
      changeMapPage(-1);
    });

    $("#next-level-page")?.addEventListener("click", () => {
      changeMapPage(1);
    });

    $("#sound-toggle")?.addEventListener("change", (event) => {
      save.soundEnabled = event.target.checked;
      persist();
    });

    $("#vibration-toggle")?.addEventListener("change", (event) => {
      save.vibrationEnabled = event.target.checked;
      persist();
    });

    $("#reset-progress-button")?.addEventListener("click", resetProgress);

    document.querySelectorAll(".nav-button").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.screen;

        if (target === "map-screen") {
          renderMap();
          return;
        }

        if (target === "game-screen") {
          if (!currentLevelData) {
            loadLevel(save.currentLevel);
          } else {
            showScreen("game-screen");
          }
          return;
        }

        showScreen(target);
      });
    });

    document.querySelectorAll(".purchase-hint-button").forEach((button) => {
      button.addEventListener("click", () => {
        buyHint(button.dataset.hint);
      });
    });

    elements.dialogOverlay?.addEventListener("click", (event) => {
      if (event.target === elements.dialogOverlay) closeDialog();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDialog();

      if (
        event.key === "Enter" &&
        elements.gameScreen?.classList.contains("active")
      ) {
        checkAnswer();
      }
    });
  }

  function initializeSettings() {
    const soundToggle = $("#sound-toggle");
    const vibrationToggle = $("#vibration-toggle");

    if (soundToggle) soundToggle.checked = save.soundEnabled;
    if (vibrationToggle) vibrationToggle.checked = save.vibrationEnabled;
  }

  function initialize() {
    bindEvents();
    initializeSettings();
    updateBalances();
    showScreen("home-screen");

    const firstLevel = getLevel(save.currentLevel);
    if (firstLevel) {
      loadLevel(save.currentLevel, false);
      showScreen("home-screen");
    }
  }

  window.WordPuzzleGame = {
    loadLevel,
    renderMap,
    showScreen,
    getSave: () => structuredClone(save),
    totalLevels: TOTAL_LEVELS
  };

  initialize();
})();
