import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiRules, analyze, sentencesOf, withoutQuotations, type AiKind, type AiLang } from '../scripts/lib/ai-tells';

// Each pair: a phrase the rules must catch ("bad", with the kind of warning) and a phrase with the same content that they must leave alone
// ("good": a name, a number, a thing). The same table is printed by `npx tsx tests/ai-tells.test.ts` for the owner.
interface Case {
  lang: AiLang;
  kind: AiKind;
  bad: string;
  good: string;
}
export const CASES: Case[] = [
  { lang: 'en', kind: 'cliche', bad: 'Lisbon is a vibrant city with a rich history.', good: 'In 1755 Lisbon lost about a third of its houses in one morning.' },
  { lang: 'en', kind: 'cliche', bad: 'The tower stands as a testament to the age of discovery.', good: 'The tower was finished in 1519 and its guardhouse carries a rhinoceros.' },
  { lang: 'en', kind: 'cliche', bad: 'Nestled in the heart of the old town, the square boasts a timeless charm.', good: 'The square lies at the foot of the Rua Áurea, between two churches.' },
  { lang: 'en', kind: 'construction', bad: 'It was not just a bridge, but a symbol of the city.', good: 'The bridge of boats carried 3,000 people on the morning of March 29, 1809.' },
  { lang: 'en', kind: 'construction', bad: 'Interestingly, the elephant refused to move.', good: 'The elephant refused to move; the keeper brought a bucket of water.' },
  { lang: 'en', kind: 'ending', bad: 'The king sent the animal to Rome. Today the museum lets visitors see the model.', good: 'The king sent the animal to Rome. The ship sank off Italy and the rhinoceros drowned.' },
  { lang: 'en', kind: 'evaluation', bad: 'It was a legendary, famous battle of great importance.', good: 'About 6,500 men fought at Aljubarrota on 14 August 1385.' },
  { lang: 'en', kind: 'question', bad: 'What happened next? The court sailed in two days. The books stayed on the quay. Nobody noticed.', good: 'The court sailed in two days. The books stayed on the quay. Nobody noticed.' },
  { lang: 'ru', kind: 'cliche', bad: 'Лиссабон — город с богатой историей и яркой культурой.', good: 'В 1755 году Лиссабон за одно утро лишился трети домов.' },
  { lang: 'ru', kind: 'cliche', bad: 'Стоит отметить, что башня сыграла ключевую роль в истории.', good: 'Башню закончили в 1519 году; на её караульной будке стоит носорог.' },
  { lang: 'ru', kind: 'cliche', bad: 'Это уникальное место, неотъемлемая часть города.', good: 'Это единственный мост на лодках в городе: его разобрали зимой 1809 года.' },
  { lang: 'ru', kind: 'construction', bad: 'Это был не просто мост, а символ города.', good: 'По мосту из лодок 29 марта 1809 года шли около трёх тысяч человек.' },
  { lang: 'ru', kind: 'construction', bad: 'Интересно, что слон отказался идти.', good: 'Слон отказался идти; сторож принёс ведро воды.' },
  { lang: 'ru', kind: 'ending', bad: 'Король отправил зверя в Рим. Сегодня в музее можно увидеть макет.', good: 'Король отправил зверя в Рим. Корабль затонул у берегов Италии, носорог утонул.' },
  { lang: 'ru', kind: 'ending', bad: 'Король отправил зверя в Рим. Это наследие живёт до сих пор.', good: 'Король отправил зверя в Рим. Папа получил только слух.' },
  { lang: 'ru', kind: 'evaluation', bad: 'Это было легендарное и знаменитое сражение огромного значения.', good: 'При Алжубарроте 14 августа 1385 года сражались около 6500 человек.' },
  { lang: 'pt', kind: 'cliche', bad: 'Lisboa é uma cidade com uma rica história e um verdadeiro tesouro.', good: 'Em 1755 Lisboa perdeu um terço das casas numa só manhã.' },
  { lang: 'pt', kind: 'cliche', bad: 'A torre é um testemunho de uma época e desempenhou um papel fundamental.', good: 'A torre ficou pronta em 1519 e na guarita há um rinoceronte.' },
  { lang: 'pt', kind: 'cliche', bad: 'Mergulhe no coração de uma cidade fascinante.', good: 'A praça fica ao fundo da Rua Áurea, entre duas igrejas.' },
  { lang: 'pt', kind: 'construction', bad: 'Não era apenas uma ponte, mas um símbolo da cidade.', good: 'Na ponte de barcas passaram cerca de três mil pessoas a 29 de março de 1809.' },
  { lang: 'pt', kind: 'construction', bad: 'Curiosamente, o elefante recusou-se a andar.', good: 'O elefante recusou-se a andar; o tratador trouxe um balde de água.' },
  { lang: 'pt', kind: 'ending', bad: 'O rei enviou o animal a Roma. Hoje pode ver-se uma maqueta no museu.', good: 'O rei enviou o animal a Roma. O navio afundou-se ao largo de Itália e o rinoceronte afogou-se.' },
  { lang: 'pt', kind: 'evaluation', bad: 'Foi uma batalha lendária, famosa e de enorme importância.', good: 'Em Aljubarrota combateram cerca de 6500 homens, a 14 de agosto de 1385.' },
];

for (const c of CASES) {
  test(`ai-tells ${c.lang} ${c.kind}: the habit is caught, the fact is not`, () => {
    const kinds = analyze(c.lang, c.bad).map((w) => w.kind);
    assert.ok(kinds.includes(c.kind), `${c.bad} → ${kinds.join(',') || 'nothing'}`);
    assert.deepEqual(analyze(c.lang, c.good), [], c.good);
  });
}

test('ai-tells: quotations are somebody else’s words and are not checked', () => {
  assert.equal(withoutQuotations('Ele disse: «uma rica história» e foi embora.'), 'Ele disse: QUOTE e foi embora.');
  assert.deepEqual(analyze('pt', 'O cronista escreveu: «uma rica história de testemunhos de glória».'), []);
  assert.deepEqual(analyze('en', 'The chronicler wrote: “a vibrant city, nestled in the heart of the kingdom”.'), []);
  assert.deepEqual(analyze('ru', 'Хронист писал: «поистине уникальный город».'), []);
});

test('ai-tells: a question in the hook is a device, not a habit; in the story it is; «не только X, но и Y» is plain Russian', () => {
  const text = 'Why did the elephant run? The king wanted to see Pliny proved right. The animal bolted before the fight. Nobody laughed. Nobody asked.';
  assert.ok(analyze('en', text, { field: 'story' }).some((w) => w.kind === 'question'));
  assert.deepEqual(analyze('en', text, { field: 'hook' }).filter((w) => w.kind === 'question'), []);
  assert.deepEqual(analyze('ru', 'Это не только мост, но и пристань для барок.'), []);
});

test('ai-tells: the allow list needs a reason and silences exactly the named place', () => {
  assert.ok(aiRules.allow.every((a) => a.why.trim().length > 0));
  const rules = { ...aiRules, allow: [{ lang: 'pt' as const, unit: 'event/x', match: 'único sobrevivente', field: 'story', why: 'a fact: the only survivor' }] };
  const text = 'Ele foi o único sobrevivente do naufrágio.';
  assert.deepEqual(analyze('pt', text, { rules, unit: 'event/x', field: 'story' }), []);
  assert.ok(analyze('pt', text, { rules, unit: 'event/y', field: 'story' }).length > 0);
  assert.ok(analyze('pt', text, { rules, unit: 'event/x', field: 'more' }).length > 0);
});

test('ai-tells: the inflected forms of Russian and Portuguese are caught', () => {
  assert.ok(analyze('ru', 'Читатель погрузится в атмосферу.').some((w) => w.kind === 'cliche'));
  assert.ok(analyze('ru', 'Рассказ погрузил читателей в эпоху.').every((w) => w.kind !== 'cliche'), 'a ship was loaded, a reader was not: only the reflexive form is a habit');
  assert.ok(analyze('ru', 'Ярким примером служит мост.').some((w) => w.kind === 'cliche'));
  assert.ok(analyze('pt', 'Os testemunhos de uma rica história.').some((w) => w.kind === 'cliche'));
  assert.ok(analyze('en', 'The city boasted a rich history and delves deep.').filter((w) => w.kind === 'cliche').length >= 2);
});

test('ai-tells: sentences keep initials and abbreviations together', () => {
  assert.deepEqual(sentencesOf('D. Manuel I mandou o elefante a Roma. Em 1514 chegou. Foi a pé.'), ['D. Manuel I mandou o elefante a Roma.', 'Em 1514 chegou.', 'Foi a pé.']);
  assert.deepEqual(sentencesOf('В 218 г. до н. э. вышли они. Зима была тяжёлой.'), ['В 218 г. до н. э. вышли они.', 'Зима была тяжёлой.']);
});

test('ai-tells metrics: a run of lists of three, many dashes, equal sentences, the same start', () => {
  const lists = 'Chegaram barcos, naus e galés. Traziam pimenta, canela e cravo. Levavam ouro, prata e sal.';
  assert.ok(analyze('pt', lists).some((w) => w.kind === 'triples'));
  const dashes = 'O rei — dizem — chegou — e partiu — sem falar.';
  assert.ok(analyze('pt', dashes).some((w) => w.kind === 'dashes'));
  const equal = 'O rei chegou ao porto de manhã. A rainha ficou no paço sem dizer nada. O filho ouviu a ordem sem protestar. O conde levou a carta ao mar. Os barcos saíram do cais antes da noite.';
  assert.ok(analyze('pt', equal).some((w) => w.kind === 'spread'));
  const start = 'O rei chegou. O elefante parou. O guarda fugiu. Ninguém riu.';
  assert.ok(analyze('pt', start).some((w) => w.kind === 'sentence-start'));
  const paragraphs = 'O primeiro dia foi calmo.\n\nO segundo dia foi quente.\n\nO terceiro dia foi longo.';
  assert.ok(analyze('pt', paragraphs).some((w) => w.kind === 'paragraph-start'));
  const varied = 'O rei chegou. Trouxe o elefante, que não queria andar e parou duas vezes diante da ponte velha, até que o tratador lhe deu um balde de água. A multidão esperou. Depois, sem aviso, o bicho atravessou.';
  assert.deepEqual(analyze('pt', varied), []);
});

// `npx tsx tests/ai-tells.test.ts` prints what the rules say about the phrases (not a test run).
if (process.argv[1]?.endsWith('ai-tells.test.ts') && process.env.AI_TELLS_REPORT) {
  for (const c of CASES) {
    console.log(`\n[${c.lang} ${c.kind}]\n  bad:  ${c.bad}`);
    for (const w of analyze(c.lang, c.bad)) console.log(`        ${w.kind}: «${w.fragment}»: ${w.hint}`);
    const good = analyze(c.lang, c.good);
    console.log(`  good: ${c.good}\n        ${good.length === 0 ? '(no warnings)' : good.map((w) => `${w.kind} «${w.fragment}»`).join('; ')}`);
  }
}
