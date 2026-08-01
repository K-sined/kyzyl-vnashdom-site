// Cloudflare Worker: ИИ-менеджер для сайта «В наш дом» (Кызыл).
// Проксирует чат к Anthropic (держит ключ в секрете), отвечает на вопросы
// про товары/магазин, и умеет отправлять собранные заявки в Telegram.

const ALLOWED_ORIGINS = new Set([
  'https://k-sined.github.io',
  'https://kyzyl.vnashdom.ru',
]);

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TURNS = 20; // сообщений в истории от клиента
const MAX_MESSAGE_LEN = 2000;
const MAX_TOOL_LOOPS = 3;

const SYSTEM_PROMPT = `Ты — ИИ-консультант магазина строительных материалов «В наш дом» в Кызыле (Республика Тыва). Отвечаешь от лица магазина на сайте в чат-виджете.

## О магазине
- Адрес: г. Кызыл, ул. Оюна Курседи, 54.
- Телефон: +7 (993) 033-44-34.
- Часы работы: ежедневно, 9:00–19:00.
- Оплата: наличные, банковская карта, СБП, безналичный расчёт.
- Доставка по Кызылу и самовывоз со склада.
- Гарантия на товар.

## Ассортимент
- Двери: входные металлические (с утеплением под сибирский климат, современные замки) и межкомнатные (от классики до минимализма), более 20 моделей в наличии. Возможна установка.
- Напольные покрытия: линолеум бытовой и коммерческий, ламинат 32–33 класса, кварцвинил и плитка ПВХ (для влажных помещений), керамогранит под дерево и камень, плинтуса и фурнитура для монтажа.
- Керамическая плитка: для ванной, кухни, санузла, балкона — матовая и глянцевая, разных размеров. В наличии затирки, клей, крестики, уровни.
- Обои: бумажные, флизелиновые, виниловые, под покраску, фотообои на заказ. Клей под любой тип полотна.
- Панели МДФ и ПВХ: стеновые и потолочные, под дерево/камень/однотонные. Профили, планки, клей-пена.
- Краска: водоэмульсионная, акриловая, эмали для дерева и металла, грунтовки. Колеровка на месте по каталогу RAL.
- Клеи и герметики: плиточный клей, монтажная пена, силиконовые и акриловые герметики, жидкие гвозди.
- Гардины: карнизы (металл, дерево, пластик), круглые и струнные системы, крепёж и кольца.

## Твоя роль
- Отвечай кратко и по-человечески, на «вы», без канцелярита. 2-4 предложения обычно достаточно.
- Помогай определиться с выбором и прикидывать нужное количество материала (по площади/размерам, которые называет клиент), но точный расчёт и подбор — на месте в магазине, это тоже можно сказать.
- Если не знаешь точную цену или наличие конкретной позиции — не выдумывай цифры. Честно скажи, что за точной ценой и наличием лучше уточнить по телефону или в магазине, и предложи оставить заявку, чтобы менеджер посчитал и перезвонил.
- Если разговор идёт к тому, что клиенту нужна консультация, расчёт или он хочет заказать/забронировать — предложи оставить имя и телефон.
- Когда клиент явно даёт согласие и называет своё имя и телефон для связи — вызови инструмент submit_lead с этими данными и кратким комментарием сути запроса. Не вызывай его, если клиент не подтвердил желание оставить контакты, и не выдумывай имя/телефон.
- После вызова submit_lead — подтверди клиенту, что заявка принята и с ним свяжутся.
- Не обсуждай темы, не связанные с магазином и ремонтом/стройматериалами; вежливо возвращай разговор к делу.`;

const SUBMIT_LEAD_TOOL = {
  name: 'submit_lead',
  description:
    'Сохранить заявку клиента и отправить её менеджеру магазина. Вызывать только когда клиент сам согласился оставить контакты для связи/расчёта/заказа.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Имя клиента' },
      phone: { type: 'string', description: 'Телефон клиента' },
      comment: { type: 'string', description: 'Краткая суть запроса — что нужно клиенту' },
    },
    required: ['name', 'phone', 'comment'],
  },
};

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

async function sendTelegramLead(env, lead) {
  const text =
    `🔔 Заявка с сайта (ИИ-менеджер)\n\n` +
    `Имя: ${lead.name || '—'}\n` +
    `Телефон: ${lead.phone || '—'}\n` +
    `Запрос: ${lead.comment || '—'}`;
  const resp = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
  });
  if (!resp.ok) throw new Error(`telegram sendMessage failed: ${resp.status}`);
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_TURNS) return false;
  return messages.every(
    (m) =>
      m &&
      typeof m.content === 'string' &&
      m.content.length > 0 &&
      m.content.length <= MAX_MESSAGE_LEN &&
      (m.role === 'user' || m.role === 'assistant')
  );
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin);

    if (request.method === 'OPTIONS') return new Response(null, { headers });
    if (!ALLOWED_ORIGINS.has(origin)) return json({ error: 'forbidden origin' }, 403, headers);

    const url = new URL(request.url);
    if (url.pathname !== '/api/chat' || request.method !== 'POST') {
      return json({ error: 'not found' }, 404, headers);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid json' }, 400, headers);
    }

    if (!validateMessages(body.messages)) {
      return json({ error: 'invalid messages' }, 400, headers);
    }

    let claudeMessages = body.messages.map((m) => ({ role: m.role, content: m.content }));
    let finalText = '';
    let leadSaved = false;

    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 600,
          system: SYSTEM_PROMPT,
          tools: [SUBMIT_LEAD_TOOL],
          messages: claudeMessages,
        }),
      });

      if (!upstream.ok) {
        return json({ error: 'upstream error' }, 502, headers);
      }

      const data = await upstream.json();
      const content = data.content || [];
      const toolUse = content.find((b) => b.type === 'tool_use' && b.name === 'submit_lead');

      if (toolUse) {
        let toolResultText = 'Заявка сохранена и передана менеджеру.';
        try {
          await sendTelegramLead(env, toolUse.input || {});
          leadSaved = true;
        } catch {
          toolResultText = 'Не удалось сохранить заявку автоматически, попросите клиента позвонить в магазин.';
        }

        claudeMessages.push({ role: 'assistant', content });
        claudeMessages.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: toolResultText }],
        });
        continue;
      }

      finalText = content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      break;
    }

    if (!finalText) {
      finalText = 'Извините, не получилось сформировать ответ. Позвоните нам: +7 (993) 033-44-34.';
    }

    return json({ reply: finalText, leadSaved }, 200, headers);
  },
};
