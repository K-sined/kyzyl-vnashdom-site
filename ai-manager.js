// Чат-виджет менеджера магазина. Общается с Cloudflare Worker'ом, который
// держит ключ Anthropic и сам решает, когда собрать заявку или предложить
// каталог и отправить их в Telegram (см. ai-manager-worker/src/index.js).
// Клиенту персона не раскрывается как ИИ — представляется просто менеджером.
const AI_WORKER_URL = 'https://kyzyl-ai-manager.kyzyl.workers.dev/api/chat';

const AI_GREETING =
  'Здравствуйте! Я менеджер магазина «В НАШ ДОМ». Отвечу на вопросы про товары, помогу подобрать материалы или пришлю каталог по интересующей группе товаров.';
const AI_MAX_HISTORY = 20;
const AI_AUTO_OPEN_DELAY_MS = 5000;
const AI_AUTO_OPEN_SESSION_KEY = 'aiManagerAutoOpened';

(function initAiManager() {
  const launcher = document.getElementById('aiManagerLauncher');
  const panel = document.getElementById('aiManagerPanel');
  if (!launcher || !panel) return;

  const closeBtn = document.getElementById('aiManagerClose');
  const messagesEl = document.getElementById('aiManagerMessages');
  const form = document.getElementById('aiManagerForm');
  const input = document.getElementById('aiManagerInput');
  const sendBtn = document.getElementById('aiManagerSend');

  let history = [];
  let isOpen = false;
  let isSending = false;

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Ссылки на каталоги (Google Drive и т.п.), которые менеджер присылает в
  // тексте ответа, должны быть кликабельными — экранируем текст целиком,
  // затем оборачиваем URL-подстроки в <a>, не давая модели вставить
  // произвольную разметку.
  function linkify(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(/https?:\/\/[^\s<]+/g, (url) => {
      const clean = url.replace(/[).,]+$/, '');
      return `<a href="${clean}" target="_blank" rel="noopener">${clean}</a>`;
    });
  }

  function appendMessage(role, text) {
    const bubble = document.createElement('div');
    bubble.className = `ai-chat__msg ai-chat__msg--${role}`;
    bubble.innerHTML = linkify(text);
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  function appendTyping() {
    const bubble = document.createElement('div');
    bubble.className = 'ai-chat__msg ai-chat__msg--assistant ai-chat__msg--typing';
    bubble.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  function openPanel(auto) {
    isOpen = true;
    sessionStorage.setItem(AI_AUTO_OPEN_SESSION_KEY, '1');
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('is-open'));
    if (!messagesEl.childElementCount) appendMessage('assistant', AI_GREETING);
    // Автооткрытие не должно красть фокус/скроллить страницу под клиентом —
    // фокус в поле ввода ставим только когда открывает сам клиент.
    if (!auto) input.focus();
    if (typeof ym === 'function') ym(111045788, 'reachGoal', auto ? 'ai_manager_auto_open' : 'ai_manager_open');
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('is-open');
    window.setTimeout(() => { if (!isOpen) panel.hidden = true; }, 250);
  }

  launcher.addEventListener('click', () => (isOpen ? closePanel() : openPanel()));
  closeBtn.addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || isSending) return;

    appendMessage('user', text);
    history.push({ role: 'user', content: text });
    if (history.length > AI_MAX_HISTORY) history = history.slice(-AI_MAX_HISTORY);

    input.value = '';
    isSending = true;
    sendBtn.disabled = true;
    const typingBubble = appendTyping();

    try {
      const resp = await fetch(AI_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      if (!resp.ok) throw new Error('bad response');
      const data = await resp.json();
      typingBubble.remove();
      appendMessage('assistant', data.reply || 'Извините, не получилось ответить. Позвоните нам: +7 (993) 033-44-34.');
      history.push({ role: 'assistant', content: data.reply || '' });
      if (data.leadSaved && typeof ym === 'function') ym(111045788, 'reachGoal', 'ai_manager_lead');
    } catch {
      typingBubble.remove();
      appendMessage('assistant', 'Не получилось связаться с сервером. Попробуйте ещё раз или позвоните: +7 (993) 033-44-34.');
    } finally {
      isSending = false;
      sendBtn.disabled = false;
      input.focus();
    }
  });

  // Автоматически открыть чат через 5 секунд нахождения на сайте — один раз
  // за вкладку (sessionStorage), чтобы не всплывал повторно при каждом
  // клике по странице/якорной ссылке, и не открывать, если клиент уже сам
  // открыл или закрыл чат раньше.
  window.setTimeout(() => {
    if (!isOpen && !sessionStorage.getItem(AI_AUTO_OPEN_SESSION_KEY)) openPanel(true);
  }, AI_AUTO_OPEN_DELAY_MS);
})();
