"use strict";

(() => {
  const Games = (() => {
    const state = {
      catalog: [],
      activeGame: null,
      activeSession: null,
      initialized: false
    };

    const categories = [
      { id: "all", name: "كل الألعاب" },
      { id: "action", name: "أكشن" },
      { id: "strategy", name: "استراتيجية" },
      { id: "puzzle", name: "ذكاء وألغاز" },
      { id: "board", name: "ألعاب الطاولة" },
      { id: "cards", name: "ورق وكروت" },
      { id: "arcade", name: "أركيد" },
      { id: "sports", name: "رياضة" },
      { id: "multiplayer", name: "جماعية" }
    ];

    const localGames = [
      {
        id: "memory",
        name: "تحدي الذاكرة",
        category: "puzzle",
        description: "اختبر ذاكرتك في تحديات مطابقة البطاقات.",
        players: "1",
        mode: "local",
        route: "memory",
        icon: "🧠",
        status: "ready"
      },
      {
        id: "reaction",
        name: "اختبار سرعة الاستجابة",
        category: "arcade",
        description: "اختبر سرعة رد فعلك وسجل نتيجتك.",
        players: "1",
        mode: "local",
        route: "reaction",
        icon: "⚡",
        status: "ready"
      },
      {
        id: "tic-tac-toe",
        name: "إكس أو",
        category: "board",
        description: "لعبة إكس أو محلية للاعبين على نفس الجهاز.",
        players: "2 محليًا",
        mode: "local",
        route: "tic-tac-toe",
        icon: "⭕",
        status: "ready"
      }
    ];

    function escapeHTML(value) {
      return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);
    }

    function normalize(value) {
      return String(value ?? "")
        .toLocaleLowerCase("ar")
        .replace(/[أإآ]/g, "ا")
        .replace(/ى/g, "ي")
        .trim();
    }

    function getJoker() {
      return window.JOKER || null;
    }

    function emit(name, detail = {}) {
      document.dispatchEvent(new CustomEvent(`joker:games:${name}`, {
        detail
      }));
    }

    function register(game) {
      if (!game || !game.id || !game.name) {
        throw new Error("كل لعبة لازم يكون لها id وname.");
      }

      const normalized = {
        id: String(game.id),
        name: String(game.name),
        category: String(game.category || "all"),
        description: String(game.description || ""),
        players: String(game.players || "غير محدد"),
        mode: game.mode === "online" ? "online" : "local",
        route: String(game.route || game.id),
        icon: String(game.icon || "🎮"),
        status: String(game.status || "planned"),
        cover: String(game.cover || ""),
        provider: String(game.provider || "")
      };

      const index = state.catalog.findIndex(item => item.id === normalized.id);

      if (index >= 0) {
        state.catalog[index] = normalized;
      } else {
        state.catalog.push(normalized);
      }

      emit("registered", { game: { ...normalized } });
      return { ...normalized };
    }

    function unregister(gameId) {
      const index = state.catalog.findIndex(game => game.id === gameId);

      if (index < 0) return false;

      const [removed] = state.catalog.splice(index, 1);
      emit("unregistered", { gameId: removed.id });

      return true;
    }

    function getAll() {
      return state.catalog.map(game => ({ ...game }));
    }

    function getById(gameId) {
      const game = state.catalog.find(item => item.id === String(gameId));
      return game ? { ...game } : null;
    }

    function getCategories() {
      return categories.map(category => ({ ...category }));
    }

    function search(options = {}) {
      const query = normalize(options.query || "");
      const category = normalize(options.category || "all");
      const mode = normalize(options.mode || "all");

      return state.catalog.filter(game => {
        const searchable = normalize(
          `${game.name} ${game.description} ${game.category}`
        );

        const matchesQuery = !query || searchable.includes(query);
        const matchesCategory =
          category === "all" || normalize(game.category) === category;
        const matchesMode = mode === "all" || game.mode === mode;

        return matchesQuery && matchesCategory && matchesMode;
      }).map(game => ({ ...game }));
    }

    function mountCatalog(container) {
      const target = typeof container === "string"
        ? document.querySelector(container)
        : container;

      if (!target) return false;

      const games = search({
        query: target.dataset.query || "",
        category: target.dataset.category || "all",
        mode: target.dataset.mode || "all"
      });

      if (!games.length) {
        target.innerHTML = `
          <div class="joker-games-empty" role="status">
            <h3>مفيش ألعاب مطابقة</h3>
            <p>جرّب تغيّر التصنيف أو كلمة البحث.</p>
          </div>
        `;
        return true;
      }

      target.innerHTML = games.map(game => `
        <article class="game-card" data-game data-game-id="${escapeHTML(game.id)}"
          data-game-name="${escapeHTML(game.name)}"
          data-category="${escapeHTML(game.category)}"
          data-description="${escapeHTML(game.description)}">

          <div class="game-card-cover">
            ${
              game.cover
                ? `<img src="${escapeHTML(game.cover)}"
                    alt="${escapeHTML(game.name)}" loading="lazy">`
                : `<span class="game-card-icon" aria-hidden="true">${escapeHTML(game.icon)}</span>`
            }
          </div>

          <div class="game-card-content">
            <span class="game-card-category">${escapeHTML(game.category)}</span>
            <h3 class="game-title">${escapeHTML(game.name)}</h3>
            <p class="game-description">${escapeHTML(game.description)}</p>
            <p class="game-players">${escapeHTML(game.players)} لاعب</p>

            <div class="game-card-actions">
              <button type="button" data-launch-game="${escapeHTML(game.id)}">
                ${game.status === "ready" ? "العب الآن" : "عرض اللعبة"}
              </button>

              <button type="button" data-favorite="${escapeHTML(game.id)}"
                aria-label="إضافة للمفضلة" aria-pressed="false">
                ♡
              </button>
            </div>
          </div>
        </article>
      `).join("");

      getJoker()?.applyGameFilters();
      emit("catalogmounted", { count: games.length, container: target });

      return true;
    }

    function open(gameId, options = {}) {
      const game = state.catalog.find(item => item.id === String(gameId));

      if (!game) {
        getJoker()?.announce("اللعبة المطلوبة مش موجودة في كتالوج الألعاب.", "error");
        return false;
      }

      if (game.status !== "ready") {
        getJoker()?.announce("اللعبة دي لسه محتاجة تجهيز أو ربط قبل التشغيل.");
        emit("unavailable", { game: { ...game } });
        return false;
      }

      state.activeGame = game.id;

      const detail = {
        game: { ...game },
        mode: options.mode || game.mode,
        container: options.container || null
      };

      emit("open", detail);

      const route = document.querySelector(
        `[data-game-view="${CSS.escape(game.route)}"]`
      );

      if (route) {
        document.querySelectorAll("[data-game-view]").forEach(view => {
          view.hidden = view !== route;
        });

        route.hidden = false;
        route.classList.add("active");
        route.scrollIntoView({ behavior: "smooth", block: "start" });
        return true;
      }

      if (game.id === "memory") return openMemoryGame(options.container);
      if (game.id === "reaction") return openReactionGame(options.container);
      if (game.id === "tic-tac-toe") return openTicTacToe(options.container);

      getJoker()?.announce("واجهة اللعبة غير موجودة في HTML لحد دلوقتي.");
      return false;
    }

    function resolveContainer(container, fallbackSelector = "[data-game-host]") {
      if (container instanceof HTMLElement) return container;
      if (typeof container === "string") {
        const found = document.querySelector(container);
        if (found) return found;
      }

      return document.querySelector(fallbackSelector);
    }

    function showGame(container, game, content) {
      if (!container) {
        getJoker()?.announce("أضف عنصرًا يحمل data-game-host داخل index.html لعرض الألعاب.");
        return false;
      }

      container.innerHTML = `
        <section class="joker-play-screen" data-running-game="${escapeHTML(game.id)}">
          <header class="joker-play-header">
            <button type="button" data-games-back>رجوع للألعاب</button>
            <div>
              <h2>${escapeHTML(game.name)}</h2>
              <p>${escapeHTML(game.description)}</p>
            </div>
          </header>
          <div class="joker-play-content">${content}</div>
        </section>
      `;

      container.querySelector("[data-games-back]")?.addEventListener("click", () => {
        stop();
        emit("back", { gameId: game.id });
      });

      container.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    }

    function openMemoryGame(container) {
      const game = state.catalog.find(item => item.id === "memory");
      const host = resolveContainer(container);

      if (!game || !host) {
        getJoker()?.announce("أضف عنصر data-game-host لعرض اللعبة.");
        return false;
      }

      const symbols = ["★", "◆", "●", "▲", "♥", "✦", "⬟", "■"];
      const deck = [...symbols, ...symbols]
        .map((symbol, index) => ({ symbol, key: `${symbol}-${index}`, matched: false }))
        .sort(() => Math.random() - 0.5);

      let first = null;
      let locked = false;
      let moves = 0;
      let matched = 0;
      const startedAt = Date.now();

      showGame(host, game, `
        <div class="memory-game" data-memory-board>
          <div class="memory-game-stats">
            <span>المحاولات: <b data-memory-moves>0</b></span>
            <span>المطابقات: <b data-memory-matched>0</b> / ${symbols.length}</span>
          </div>

          <div class="memory-grid" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px">
            ${deck.map((card, index) => `
              <button type="button" class="memory-card"
                data-memory-card="${index}" aria-label="بطاقة مخفية"
                style="min-height:70px;border:1px solid rgba(212,175,55,.35);border-radius:12px;background:#151a17;color:#f4d477;font-size:24px">
                ?
              </button>
            `).join("")}
          </div>

          <p data-memory-result aria-live="polite"></p>
          <button type="button" data-memory-restart>إعادة اللعب</button>
        </div>
      `);

      const board = host.querySelector("[data-memory-board]");
      if (!board) return false;

      const cards = [...board.querySelectorAll("[data-memory-card]")];

      function resetBoard() {
        first = null;
        locked = false;
        moves = 0;
        matched = 0;

        deck.forEach(card => {
          card.matched = false;
        });

        cards.forEach(button => {
          button.disabled = false;
          button.textContent = "?";
          button.dataset.open = "false";
          button.style.background = "#151a17";
        });

        board.querySelector("[data-memory-moves]").textContent = "0";
        board.querySelector("[data-memory-matched]").textContent = "0";
        board.querySelector("[data-memory-result]").textContent = "";
      }

      cards.forEach((button, index) => {
        button.addEventListener("click", () => {
          if (locked || button.dataset.open === "true" || deck[index].matched) return;

          button.textContent = deck[index].symbol;
          button.dataset.open = "true";
          button.style.background = "#29372d";

          if (!first) {
            first = index;
            return;
          }

          moves++;
          board.querySelector("[data-memory-moves]").textContent = String(moves);

          if (deck[first].symbol === deck[index].symbol) {
            deck[first].matched = true;
            deck[index].matched = true;
            matched++;
            first = null;

            board.querySelector("[data-memory-matched]").textContent = String(matched);

            if (matched === symbols.length) {
              const seconds = Math.floor((Date.now() - startedAt) / 1000);
              board.querySelector("[data-memory-result]").textContent =
                `مبروك! خلصت اللعبة في ${moves} محاولة.`;
              emit("completed", {
                gameId: game.id,
                moves,
                seconds
              });
            }
          } else {
            const previous = first;
            locked = true;

            setTimeout(() => {
              if (!board.isConnected) return;

              [previous, index].forEach(cardIndex => {
                cards[cardIndex].textContent = "?";
                cards[cardIndex].dataset.open = "false";
                cards[cardIndex].style.background = "#151a17";
              });

              first = null;
              locked = false;
            }, 700);
          }
        });
      });

      board.querySelector("[data-memory-restart]").addEventListener("click", () => {
        stop();
        openMemoryGame(host);
      });

      state.activeSession = {
        gameId: game.id,
        stop: () => {
          cards.forEach(button => {
            button.disabled = true;
          });
        }
      };

      return true;
    }

    function openReactionGame(container) {
      const game = state.catalog.find(item => item.id === "reaction");
      const host = resolveContainer(container);

      if (!game || !host) {
        getJoker()?.announce("أضف عنصر data-game-host لعرض اللعبة.");
        return false;
      }

      showGame(host, game, `
        <div class="reaction-game">
          <p>اضغط على الزر بمجرد ما يتحول للون الأخضر.</p>
          <button type="button" data-reaction-start>ابدأ التحدي</button>
          <button type="button" data-reaction-target disabled
            style="display:block;width:100%;min-height:180px;margin-top:16px;border-radius:16px;background:#343434;color:white;font-size:22px">
            استنى الإشارة
          </button>
          <p data-reaction-result aria-live="polite"></p>
        </div>
      `);

      const root = host.querySelector(".reaction-game");
      const startButton = root.querySelector("[data-reaction-start]");
      const target = root.querySelector("[data-reaction-target]");
      const result = root.querySelector("[data-reaction-result]");

      let timeout = null;
      let readyAt = 0;
      let phase = "idle";

      function clearRound() {
        clearTimeout(timeout);
        phase = "idle";
        target.disabled = true;
        target.style.background = "#343434";
        target.textContent = "استنى الإشارة";
      }

      startButton.addEventListener("click", () => {
        clearRound();
        result.textContent = "استعد...";
        startButton.disabled = true;
        phase = "waiting";

        timeout = setTimeout(() => {
          if (!root.isConnected) return;

          readyAt = performance.now();
          phase = "ready";
          target.disabled = false;
          target.style.background = "#15803d";
          target.textContent = "اضغط الآن!";
          result.textContent = "";
        }, 1200 + Math.random() * 2600);
      });

      target.addEventListener("click", () => {
        if (phase === "waiting") {
          clearRound();
          result.textContent = "ضغطت بدري! حاول مرة تانية.";
          startButton.disabled = false;
          return;
        }

        if (phase !== "ready") return;

        const reactionMs = Math.round(performance.now() - readyAt);

        clearRound();
        startButton.disabled = false;
        target.textContent = `${reactionMs} ms`;
        result.textContent = `زمن الاستجابة: ${reactionMs} مللي ثانية.`;

        emit("completed", {
          gameId: game.id,
          reactionMs
        });
      });

      state.activeSession = {
        gameId: game.id,
        stop: clearRound
      };

      return true;
    }

    function openTicTacToe(container) {
      const game = state.catalog.find(item => item.id === "tic-tac-toe");
      const host = resolveContainer(container);

      if (!game || !host) {
        getJoker()?.announce("أضف عنصر data-game-host لعرض اللعبة.");
        return false;
      }

      showGame(host, game, `
        <div class="tic-tac-toe">
          <p data-ttt-status aria-live="polite">دور اللاعب X</p>
          <div data-ttt-board style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-width:360px">
            ${Array.from({ length: 9 }, (_, index) => `
              <button type="button" data-ttt-cell="${index}"
                aria-label="مربع ${index + 1}"
                style="min-height:85px;border:1px solid rgba(212,175,55,.4);border-radius:12px;background:#151a17;color:#f4d477;font-size:32px">
              </button>
            `).join("")}
          </div>
          <button type="button" data-ttt-reset>لعبة جديدة</button>
          <p>اللعب هنا محلي على نفس الجهاز، مش أونلاين.</p>
        </div>
      `);

      const root = host.querySelector(".tic-tac-toe");
      const cells = [...root.querySelectorAll("[data-ttt-cell]")];
      const status = root.querySelector("[data-ttt-status]");

      let board = Array(9).fill("");
      let current = "X";
      let finished = false;

      const wins = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
      ];

      function reset() {
        board = Array(9).fill("");
        current = "X";
        finished = false;
        status.textContent = "دور اللاعب X";

        cells.forEach(cell => {
          cell.textContent = "";
          cell.disabled = false;
        });
      }

      function checkWinner() {
        return wins.find(line => line.every(index => board[index] === current));
      }

      cells.forEach((cell, index) => {
        cell.addEventListener("click", () => {
          if (finished || board[index]) return;

          board[index] = current;
          cell.textContent = current;
          cell.disabled = true;

          if (checkWinner()) {
            finished = true;
            status.textContent = `اللاعب ${current} كسب!`;
            cells.forEach(item => item.disabled = true);

            emit("completed", {
              gameId: game.id,
              winner: current
            });
            return;
          }

          if (board.every(Boolean)) {
            finished = true;
            status.textContent = "تعادل!";
            return;
          }

          current = current === "X" ? "O" : "X";
          status.textContent = `دور اللاعب ${current}`;
        });
      });

      root.querySelector("[data-ttt-reset]").addEventListener("click", reset);

      state.activeSession = {
        gameId: game.id,
        stop: reset
      };

      return true;
    }

    function stop() {
      if (state.activeSession?.stop) {
        try {
          state.activeSession.stop();
        } catch (error) {
          console.error("JOKER game cleanup error:", error);
        }
      }

      state.activeSession = null;
      state.activeGame = null;
      emit("stopped");
    }

    function requestOnlineMatch(gameId, options = {}) {
      const game = getById(gameId);

      if (!game) {
        getJoker()?.announce("اللعبة المطلوبة مش موجودة.");
        return false;
      }

      const apiBase = document.documentElement.dataset.apiBase;

      if (!apiBase) {
        getJoker()?.announce(
          "المطابقة أونلاين تحتاج API وسيرفر لإيجاد لاعبين حقيقيين.",
          "error"
        );
        return false;
      }

      if (!navigator.onLine) {
        getJoker()?.announce("اتصل بالإنترنت أولًا.", "error");
        return false;
      }

      emit("matchrequest", {
        gameId: game.id,
        mode: options.mode || "random",
        apiBase
      });

      return true;
    }

    function init() {
      if (state.initialized) return;

      localGames.forEach(register);
      state.initialized = true;

      document.addEventListener("joker:launchgame", event => {
        const gameId = event.detail?.gameId;
        if (gameId) open(gameId);
      });

      document.addEventListener("click", event => {
        const button = event.target.closest("[data-game-category]");
        if (!button) return;

        const category = button.dataset.gameCategory;

        document.querySelectorAll("[data-game-category]").forEach(item => {
          item.classList.toggle("active", item === button);
        });

        document.querySelectorAll("[data-games-catalog]").forEach(container => {
          container.dataset.category = category;
          mountCatalog(container);
        });
      });

      document.querySelectorAll("[data-games-catalog]").forEach(mountCatalog);

      emit("ready", {
        count: state.catalog.length,
        categories: getCategories()
      });
    }

    return Object.freeze({
      init,
      register,
      unregister,
      getAll,
      getById,
      getCategories,
      search,
      mountCatalog,
      open,
      stop,
      requestOnlineMatch
    });
  })();

  window.JOKERGames = Games;

  function initializeGames() {
    Games.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeGames, { once: true });
  } else {
    initializeGames();
  }
})();
