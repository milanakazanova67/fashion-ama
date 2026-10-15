// POST /api/describe — смотрит на фото вещи и подсказывает название, тип, цвет и стиль.
const { askClaude, guard } = require('./_claude');

const MODEL = process.env.DESCRIBE_MODEL || 'claude-haiku-5-5';

module.exports = guard(async (b) => {
  const img = String(b.image || '');
  const m = img.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m || m[2].length > 2_000_000) { const e = new Error('bad'); e.code = 'bad_request'; throw e; }
  return askClaude({
    model: MODEL,
    maxTokens: 300,
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/' + m[1], data: m[2] } },
      { type: 'text', text: 'На фото одна вещь одежды, обувь, сумка или аксессуар. Ответь только JSON без пояснений: {"name":"короткое красивое название по-русски, 2-4 слова","cat":"одно из: top, bottom, dress, outer, shoes, bag, accessory","color":"основной цвет по-русски","style":"стиль, 1-2 слова по-русски","warmth":1|2|3}. warmth: 1 — лёгкая летняя, 2 — средняя, 3 — тёплая зимняя.' },
    ],
  });
});
