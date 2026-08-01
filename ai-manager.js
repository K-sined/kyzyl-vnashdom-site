// ИИ-менеджер — плавающий чат-виджет. Общается с Cloudflare Worker'ом,
// который держит ключ Anthropic и сам решает, когда собрать заявку и
// отправить её в Telegram (см. ai-manager-worker/src/index.js).
const AI_WORKER_URL = 'https://kyzyl-ai-manager.kyzyl.workers.dev/api/chat';

const AI_GREETING =
  'Здравствуйте! Я ИИ-консультант магазина «В наш дом». Отвечу на вопросы про товары, помогу подобрать материалы или оставить заявку на консультацию.';
const AI_MAX_HISTORY = 20;

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

  function appendMessage(role, text) {
    const bubble = document.createElement('div');
    bubble.className = `ai-chat__msg ai-chat__msg--${role}`;
    bubble.textContent = text;
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

  function openPanel() {
    isOpen = true;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('is-open'));
    if (!messagesEl.childElementCount) appendMessage('assistant', AI_GREETING);
    input.focus();
    if (typeof ym === 'function') ym(111045788, 'reachGoal', 'ai_manager_open');
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
})();
