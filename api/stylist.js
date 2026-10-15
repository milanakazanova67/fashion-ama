// POST /api/stylist — собирает образ из гардероба посетителя.
const { askClaude, guard, clip } = require('./_claude');

const MODEL = process.env.STYLIST_MODEL || 'claude-sonnet-5-5';

module.exports = guard(async (b) => {
  const city = clip(b.city, 80), event = clip(b.event, 160);
  if (!city || !event) { const e = new Error('bad'); e.code = 'bad_request'; throw e; }
  const code = clip(b.code, 80), mood = clip(b.mood, 80);
  const budget = Math.max(0, Math.min(1_000_000, Math.round(Number(b.budget) || 0)));
  const today = clip(b.today, 40);
  const wardrobe = (Array.isArray(b.wardrobe) ? b.wardrobe : []).slice(0, 200).map(i => ({
    id: clip(i.id, 40), name: clip(i.name, 60), cat: clip(i.cat, 12),
    color: clip(i.color, 30), style: clip(i.style, 30), warmth: Number(i.warmth) || 2,
  }));
  if (!wardrobe.length) { const e = new Error('bad'); e.code = 'bad_request'; throw e; }
  const prev = (Array.isArray(b.prevIds) ? b.prevIds : []).slice(0, 20).map(x => clip(x, 40));

  const prompt = `Ты — модный парижский стилист для подростков. Сегодня ${today}.
Гардероб (JSON, warmth: 1 лёгкая, 2 средняя, 3 тёплая; cat: top верх, bottom низ, dress платье, outer верхняя одежда, shoes обувь, bag сумка, accessory аксессуар):
${JSON.stringify(wardrobe)}
Человек сейчас в городе: ${city}. Идёт: ${event}. Дресс-код: ${code || 'не указан'}. Настроение: ${mood || 'не указано'}. Бюджет на покупки: ${budget ? budget + ' рублей на все покупки вместе' : 'не указан, предлагай недорогие вещи'}.
${prev.length ? `Предыдущий вариант был из вещей ${JSON.stringify(prev)}. Сделай заметно другой образ.` : ''}
Собери ОДИН самый красивый и уместный образ ТОЛЬКО из вещей этого гардероба. Учитывай обычную погоду в этом городе в это время года, уместность для события, дресс-код и сочетание цветов.
Правила: либо платье, либо верх и низ; обувь, если есть подходящая; верхняя одежда, если будет прохладно; не больше одной сумки и двух аксессуаров. Не придумывай вещей, которых нет.
Кроме образа предложи от 1 до 3 вещей, которые стоит ДОКУПИТЬ, чтобы образ стал ещё лучше для этого события. Их суммарная примерная цена должна укладываться в бюджет. Для каждой дай поисковый запрос, по которому её легко найти на Wildberries, Ozon и Lamoda.
Ответь только JSON без пояснений: {"shop":[{"name":"что купить, 2-4 слова","query":"поисковый запрос для маркетплейса по-русски, 2-5 слов, с цветом","price":"примерная цена в рублях, например 1500–2500 ₽","why":"зачем, до 8 слов"}],"title":"короткое красивое название образа по-русски","itemIds":["id",...],"why":"2-3 предложения по-русски, почему этот образ подходит","weather":"какая погода скорее всего в этом городе сейчас и как образ к ней готов, одно предложение","tip":"один короткий совет по стилю"}`;

  return askClaude({ model: MODEL, content: prompt, maxTokens: 1200 });
});
