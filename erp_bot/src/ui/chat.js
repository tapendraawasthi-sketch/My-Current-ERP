if (window.__erpBotLoaded) return;
window.__erpBotLoaded = true;

(function () {
  const API_BASE = "http://localhost:8765";

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `${API_BASE}/static/erp_bot/chat.css`;
  document.head.appendChild(link);

  if (!window.__erpBotMarkedLoading) {
    window.__erpBotMarkedLoading = true;
    const markedScript = document.createElement("script");
    markedScript.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
    markedScript.async = true;
    document.head.appendChild(markedScript);
  }

  let sessionId = localStorage.getItem("erp_bot_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("erp_bot_session_id", sessionId);
  }

  const root = document.createElement("div");
  root.id = "erp-bot-root";
  root.innerHTML = `
    <button class="erp-bot-toggle" id="erp-bot-toggle" title="ERP Assistant">💬</button>
    <div class="erp-bot-panel" id="erp-bot-panel">
      <div class="erp-bot-header">
        <div class="erp-bot-header-title">
          <span class="erp-bot-status-dot dot-offline" id="erp-bot-dot"></span>
          ERP Assistant
        </div>
        <div class="erp-bot-header-subtitle" id="erp-bot-subtitle">Connecting...</div>
      </div>
      <div class="erp-bot-messages" id="erp-bot-messages"></div>
      <div class="erp-bot-input-row">
        <input class="erp-bot-input" id="erp-bot-input" type="text" placeholder="Ask about the codebase..." />
        <button class="erp-bot-send" id="erp-bot-send">Send</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const toggle = document.getElementById("erp-bot-toggle");
  const panel = document.getElementById("erp-bot-panel");
  const messages = document.getElementById("erp-bot-messages");
  const input = document.getElementById("erp-bot-input");
  const sendBtn = document.getElementById("erp-bot-send");
  const dot = document.getElementById("erp-bot-dot");
  const subtitle = document.getElementById("erp-bot-subtitle");

  toggle.addEventListener("click", () => {
    panel.classList.toggle("open");
  });

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function addBubble(text, type, sources) {
    const bubble = document.createElement("div");
    bubble.className = `erp-bot-bubble ${type}`;

    if (type === "assistant" && window.marked) {
      bubble.innerHTML = window.marked.parse(text);
    } else {
      bubble.textContent = text;
    }

    if (sources && sources.length > 0) {
      const srcDiv = document.createElement("div");
      srcDiv.className = "erp-bot-sources";
      sources.forEach((s) => {
        const pill = document.createElement("span");
        pill.className = "erp-bot-source-pill";
        pill.textContent = s;
        srcDiv.appendChild(pill);
      });
      bubble.appendChild(srcDiv);
    }

    messages.appendChild(bubble);
    scrollToBottom();
  }

  let typingEl = null;

  function showTyping() {
    typingEl = document.createElement("div");
    typingEl.className = "erp-bot-typing";
    typingEl.innerHTML = "<span></span><span></span><span></span>";
    messages.appendChild(typingEl);
    scrollToBottom();
  }

  function hideTyping() {
    if (typingEl) {
      typingEl.remove();
      typingEl = null;
    }
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    addBubble(text, "user");
    showTyping();

    try {
      const resp = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });
      hideTyping();

      if (!resp.ok) {
        addBubble(`Server error (${resp.status})`, "error");
        return;
      }

      const data = await resp.json();
      addBubble(data.answer, "assistant", data.sources);
    } catch (err) {
      hideTyping();
      addBubble(`Network error: ${err.message}`, "error");
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  fetch(`${API_BASE}/status`)
    .then((r) => r.json())
    .then((json) => {
      dot.className = "erp-bot-status-dot dot-online";
      subtitle.textContent = `${json.indexed_files} files indexed`;
    })
    .catch(() => {
      dot.className = "erp-bot-status-dot dot-offline";
      subtitle.textContent = "Bot server not reachable";
    });
})();
