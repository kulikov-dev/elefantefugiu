# Вычитка новых текстов: Английский (en-US)

Отчёт проходов 0–6 по тому, что показывает `npm run lang:pending` (промпт 34). **Ничего не правилось**: таблицы и варианты ждут твоего «ок». После «ок» правки идут отдельным коммитом на язык, затем отметки `lang_review`.

## Что показывает lang:pending

```
38 unit(s) to read:
- event/a-portuguesa-1890: pt (not read), en (not read), ru (not read)
- event/batalha-da-salga-1581: pt (not read), en (not read), ru (not read)
- event/braguinha-ukulele-1879: pt (not read), en (not read), ru (not read)
- event/capela-sao-joao-baptista: pt (not read), en (not read), ru (not read)
- event/carros-de-cesto-monte: pt (not read), en (not read), ru (not read)
- event/catarina-cha-1662: pt (not read), en (not read), ru (not read)
- event/cha-gorreana: pt (not read), en (not read), ru (not read)
- event/elevador-bom-jesus: pt (not read), en (not read), ru (not read)
- event/elevador-santa-justa: pt (not read), en (not read), ru (not read)
- event/falsos-sebastiao: pt (not read), en (not read), ru (not read)
- event/galerias-romanas-rua-da-prata: pt (not read), en (not read), ru (not read)
- event/garum-lisboa: pt (not read), en (not read), ru (not read)
- event/livraria-lello: pt (not read), en (not read), ru (not read)
- event/mafra-sinos-1717: pt (not read), en (not read), ru (not read)
- event/morcegos-mafra-1771: ru (changed after reading)
- event/ouro-sao-francisco-porto: pt (not read), en (not read), ru (not read)
- event/palacio-da-pena: pt (not read), en (not read), ru (not read)
- event/pasteis-de-belem-1837: pt (not read), en (not read), ru (not read)
- event/ponte-maria-pia-1877: pt (not read), en (not read), ru (not read)
- event/ponte-trajano-chaves: pt (not read), en (not read), ru (not read)
- event/porca-de-murca: pt (not read), en (not read), ru (not read)
- event/prisao-joanina: pt (not read), en (not read), ru (not read)
- event/restauracao-1640: pt (not read), en (not read), ru (not read)
- event/templo-romano-evora: pt (not read), en (not read), ru (not read)
- event/termas-vipasca: pt (not read), en (not read), ru (not read)
- event/travessia-atlantico-sul-1922: pt (not read), en (not read), ru (not read)
- event/viriato-139-ac: pt (not read), en (not read), ru (not read)
- epoch/antes-de-portugal: pt (not read), en (not read), ru (not read)
- epoch/lusitania-e-roma: pt (changed after reading), en (changed after reading), ru (changed after reading)
- epoch/uniao-restauracao-e-ouro-do-brasil: pt (changed after reading), en (changed after reading), ru (changed after reading)
- epoch/monarquia-e-republica: pt (changed after reading), en (changed after reading), ru (changed after reading)
- static/about: ru (changed after reading)
- static/method: ru (changed after reading)
- ui/site: pt (changed after reading), en (changed after reading), ru (changed after reading)
- ui/home: pt (changed after reading), en (changed after reading), ru (changed after reading)
- ui/surprise: pt (changed after reading), en (changed after reading), ru (changed after reading)
- ui/map: pt (changed after reading), en (changed after reading), ru (changed after reading)
- ui/ui: ru (changed after reading)
```

Из списка выпадали и учтены вручную: нить `engenho` (помечена прочитанной в коммите `170ceb7`, когда создавалась, поэтому pending её не видит; прочитана заново), строки интерфейса из этого списка (скрипт видит их по разделам целиком; новые ключи отобраны сравнением с коммитом последних отметок `e8e76f9`). Находка по скрипту: `lang:pending` не показывает, **какие поля** изменились, только единицу целиком; для вычитки новых строк интерфейса пришлось сравнивать `src/i18n/*.json` по git. Предлагаю (после «ок») добавить в `lang:pending` вывод ключей, изменившихся с момента отметки.

## Сводка

- Находок после слияния проходов 1, 3 и 2: **52** (высокая уверенность 7, средняя 21, низкая 24). В применение по правилам прошлой вычитки идут «высокая» (и ошибки), «средняя» и «низкая» ждут твоего решения.
- По категориям: британизм — 13, калька — 11, неестественно — 8, непоследовательно — 6, метка/термин — 6, типографика — 3, смысл (степень уверенности) — 3, ошибка — 1, смысл (факт) — 1.
- Оценка «заметно ли, что перевод» (1 = нет, 5 = да), среднее по 31 разделам (27 историй и 4 эпохи): **до правок 1.77**; после правок оценку дам повторным слепым чтением применённого текста (до «ок» применять нечего).
- Крючки: слепое сравнение «было / вариант 1 / вариант 2»: заменить 15 из 26, оставить как было 11. Описания (первые предложения): заменить 19 из 26, оставить 7.
- check:ai-tells на этом языке: 20 предупреждений, оставить 12, править 8.

### Пять самых заметных мест

- `a-portuguesa-1890` [detail_image.alt]: «paper-coloured half» → «paper-colored half». Британское написание colour; в американском варианте colored. (британизм)
- `elevador-santa-justa` [image.alt]: «a moustached man» → «a mustached man». Британское написание. (британизм)
- `elevador-santa-justa` [detail_image.alt]: «neighbouring buildings» → «neighboring buildings». Британское написание. (британизм)
- `restauracao-1640` [bridge.note]: «prepared their last meeting» → «held their last meeting». Калька: встречу не готовят в доме, а проводят. (калька)
- `restauracao-1640` [more]: «They prepared their last meeting before the uprising» → «They held their last meeting before the uprising». Калька, то же. (калька)

## Таблица находок

| история | поле | сейчас | проблема | предложение | уверенность | источник |
|---|---|---|---|---|---|---|
| a-portuguesa-1890 | detail_image.alt | paper-coloured half | британизм: Британское написание colour; в американском варианте colored. | paper-colored half | высокая | Merriam-Webster / Grammarist: US «-ored» |
| a-portuguesa-1890 | story | pull out of the lands between Angola and Mozambique | неестественно: Неестественное сочетание: pull out of the lands; естественнее withdraw from the territory. | withdraw from the territory between Angola and Mozambique | низкая | слепое чтение |
| batalha-da-salga-1581 | story | the Spanish landed in Salga Bay | неестественно: Для конкретных людей в американской речи обычно Spaniards, а не the Spanish. | the Spaniards landed in Salga Bay | низкая | слепое чтение |
| batalha-da-salga-1581 | more | And people here still love their bulls | неестественно: Расплывчатое here (сайт не привязан к месту), звучит как перевод. | And Terceirans still love their bulls | низкая | слепое чтение |
| capela-sao-joao-baptista | bridge.note | The chapel is in a side altar of the church | калька: Неверная коллокация: часовня не находится внутри бокового алтаря. | The chapel is off the church's side aisle | средняя | слепое чтение |
| carros-de-cesto-monte | story | a wicker armchair-basket on wooden runners | калька: Нелепое составное слово armchair-basket, калька. | a wicker basket seat on wooden runners | средняя | слепое чтение |
| carros-de-cesto-monte | detail_image.caption | A wicker sled of Monte | неестественно: Неестественный of-генитив. | A Monte wicker sled | низкая | слепое чтение |
| elevador-santa-justa | hook | The iron elevator Eiffel didn't build. | непоследовательно: Непоследовательно: в заголовке и тексте lift, в hook elevator; для американца естественно elevator везде, кроме имени Santa Justa Lift. | The iron lift Eiffel didn't build. | средняя | слепое чтение |
| elevador-santa-justa | more | The lift has two wooden cars | британизм: Для американского читателя lift звучит по-британски; в обычном тексте elevator. | The elevator has two wooden cars | средняя | Merriam-Webster |
| elevador-santa-justa | more | Mesnier built other lifts and funiculars | британизм: Британское lifts в нарицательном значении. | Mesnier built other elevators and funiculars | средняя | слепое чтение |
| elevador-santa-justa | image.alt | a moustached man | британизм: Британское написание. | a mustached man | высокая | Merriam-Webster: US «mustache» (https://grammarist.com/spelling/mustache-moustache/ и Grammarly) |
| elevador-santa-justa | detail_image.alt | neighbouring buildings | британизм: Британское написание. | neighboring buildings | высокая | Merriam-Webster: US «neighbor» |
| mafra-sinos-1717 | image.alt | two founders | непоследовательно: В тексте bellmakers, в alt founders: непоследовательный термин. | two bell founders | низкая | слепое чтение |
| morcegos-mafra-1771 | more | fitted out the library | британизм: Британская/устаревшая лексика. | furnished the library | низкая | слепое чтение |
| palacio-da-pena | more | ochre for the new wing | британизм: Американский вариант ocher. | ocher for the new wing | средняя | Merriam-Webster: основная форма «ocher», «ochre» вариант (https://grammarist.com/spelling/ocher-ochre/) |
| palacio-da-pena | year_label | 1838 – the 1860s | типографика: Пробелы вокруг тире в диапазоне, нетипично. | 1838–1860s | низкая | Chicago Manual of Style |
| pasteis-de-belem-1837 | image.alt | a nineteenth-century crowd | непоследовательно: Везде в файле цифры (19th century); непоследовательно. | a 19th-century crowd | низкая | слепое чтение |
| ponte-maria-pia-1877 | image.alt | sailing boats | британизм: В американском английском обычно sailboats. | sailboats | низкая | слепое чтение |
| ponte-maria-pia-1877 | more | a landmark of world engineering | калька: Тяжеловатая калька. | a landmark in the history of engineering | низкая | слепое чтение |
| ponte-trajano-chaves | image.caption | around 104 AD | типографика: Американский стиль: A.D. перед годом (и B.C. по AP). | around A.D. 104 | низкая | Chicago Manual of Style |
| porca-de-murca | more | to “smarten him up.” | британизм: Smarten up звучит по-британски; для американца wise up или другое. | to “knock some sense into him.” | низкая | слепое чтение |
| restauracao-1640 | bridge.title | Independence Palace | непоследовательно: В тексте Palace of Independence: название непоследовательно. | Palace of Independence | средняя | слепое чтение |
| restauracao-1640 | bridge.note | prepared their last meeting | калька: Калька: встречу не готовят в доме, а проводят. | held their last meeting | высокая | слепое чтение |
| restauracao-1640 | more | They prepared their last meeting before the uprising | калька: Калька, то же. | They held their last meeting before the uprising | высокая | слепое чтение |
| termas-vipasca | story | Its life was laid down by law on bronze tablets. | калька: Калька, стилистически тяжело. | Its life was regulated by law on bronze tablets. | средняя | слепое чтение |
| termas-vipasca | story | the morning until the seventh hour belonged to women | неестественно: Тяжелая конструкция, читается как перевод. | women had the morning until the seventh hour | низкая | слепое чтение |
| travessia-atlantico-sul-1922 | story | there's nothing to fix your eyes on | калька: Буквальный оборот. | there's nothing to fix your gaze on | низкая | слепое чтение |
| viriato-139-ac | story | sign a peace | неестественно: Неполная коллокация. | sign a peace treaty | средняя | слепое чтение |
| epoch/lusitania-e-roma | fallback_image.caption | based on the age of Lusitania and Rome | калька: Калька: age в значении эпоха. | depicting the era of Lusitania and Rome | средняя | слепое чтение |
| epoch/uniao-restauracao-e-ouro-do-brasil | fallback_image.caption | based on the age of the Union, the Restoration, and Brazilian gold | калька: Калька, то же. | depicting the era of the Union, the Restoration, and Brazilian gold | средняя | слепое чтение |
| epoch/monarquia-e-republica | fallback_image.caption | based on the age of the Monarchy and the Republic | калька: Калька, то же. | depicting the era of the Monarchy and the Republic | средняя | слепое чтение |
| epoch/uniao-restauracao-e-ouro-do-brasil | name | Union, Restoration and Brazilian Gold | непоследовательно: Нет оксфордской запятой, а в остальном тексте она есть. | Union, Restoration, and Brazilian Gold | средняя | слепое чтение |
| epoch/uniao-restauracao-e-ouro-do-brasil | theme | Gold, baroque, and independence | непоследовательно: В историях Baroque с заглавной. | Gold, Baroque, and independence | средняя | слепое чтение |
| epoch/uniao-restauracao-e-ouro-do-brasil | then_now[2].text | 557 tons of Brazilian gold | неестественно: В США ton это короткая тонна; для массы золота нужна metric tons. | 557 metric tons of Brazilian gold | низкая | слепое чтение |
| epoch/uniao-restauracao-e-ouro-do-brasil | then_now[1].then_big | never drunk | неестественно: Как крупная подпись звучит странно, лучше never tasted. | never tried | низкая | слепое чтение |
| epoch/monarquia-e-republica | then_now[1].text | the base differs | калька: Калька: base в смысле выборки/порога. | the age cutoff differs | средняя | слепое чтение |
| epoch/monarquia-e-republica | then_now[2].text | baked to a secret recipe | ошибка: Нужен предлог from. | baked from a secret recipe | средняя | слепое чтение |
| epoch/monarquia-e-republica | intro | iron bridges, lifts, and funiculars | британизм: Британское lifts. | iron bridges, elevators, and funiculars | средняя | слепое чтение |
| epoch/monarquia-e-republica | fallback_image.alt | sailing boats | британизм: См. Story 19. | sailboats | низкая | слепое чтение |
| thread/engenho | description | Bridges, aqueducts, lifts and machines | британизм: Нет оксфордской запятой, lifts по-британски. | Bridges, aqueducts, elevators, and machines | низкая | слепое чтение |
| ui/surprise | surprise.all_read | Here's one you've already read | типографика: Нет завершающей пунктуации, фраза обрывается. | Here's one you've already read. | низкая | слепое чтение |
| cha-gorreana | story | But by 1864 a blight had nearly wiped out the orchards. | смысл (факт): pt «por volta de 1864» (около), en/ru «by 1864» / «к 1864 году» (к этому сроку): разная точность и разный смысл даты. | But around 1864 a blight nearly wiped out the orchards. | средняя | сверка трёх языков |
| livraria-lello | more | In a tweet on May 21, 2020, she added that it’s beautiful and she’d love to visit, but it has nothing to do with Hogwarts. | смысл (степень уверенности): pt и ru дают прямую цитату твита, en пересказывает косвенной речью; к тому же в начале story en цитирует Роулинг прямой речью. Сверить с первоисточником. | In a tweet on May 21, 2020, she added: “It’s beautiful, and I’d love to visit, but it has nothing to do with Hogwarts.” (сверить с оригиналом твита) | низкая | сверка трёх языков |
| batalha-da-salga-1581 | more | According to legend, Brianda Pereira, whose house the Spanish burned when they landed | смысл (степень уверенности): pt «tradição» (устное предание) vs en «legend» (легенда, степень недостоверности выше); ru «по преданию» ближе к pt. | According to tradition, Brianda Pereira… | низкая | сверка трёх языков |
| viriato-139-ac | more | According to legend, when the killers came for their reward, Caepio told them, “Rome doesn’t pay traitors.” | смысл (степень уверенности): pt «tradição» vs en «legend»: en слегка усиливает сомнение; ru совпадает с pt. | According to tradition, when the killers came for their reward… | низкая | сверка трёх языков |
| epoch/antes-de-portugal | years_label | 150 million years ago – 6th c. BC | метка/термин: В pt и ru нет «назад/atrás» (en «ago»), без него запись читается как длительность; в ru длинное тире «—» вместо «–» в pt/en; в en «6th c.» сокращено, а в Epoch 29 «5th century» полностью. | 150 million years ago – 6th century BC | высокая | сверка трёх языков |
| epoch/lusitania-e-roma | fallback_image.caption | AI-generated illustration (Gemini) based on the age of Lusitania and Rome. Not a historical image. | метка/термин: В en «age» вместо «era» (глоссарий: época = era; «Age» занято кнопкой Idade/Возраст). То же в Epoch 30 и 31. В ru «по эпохе» неуклюже (калька «a partir da»). | AI-generated illustration (Gemini) based on the era of Lusitania and Rome. Not a historical image. | высокая | сверка трёх языков |
| elevador-santa-justa | title / hook / story (en) | The Lift Eiffel Didn’t Build / The iron elevator Eiffel didn’t build | метка/термин: В en-US внутри одного текста «Lift» (заголовок, имя собственное «Santa Justa Lift») и «elevator» (hook, story); в Epoch 31 и Thread 32 «lifts» тоже британизм для en-US. Нужно единообразие: имя собственное оставить, нарицательное писать elevator. | title: The Elevator Eiffel Didn’t Build; ‘Santa Justa Lift’ only as the proper name | средняя | сверка трёх языков |
| braguinha-ukulele-1879 | title | The Guitar That Became the Ukulele | метка/термин: В pt заглавный предмет — «braguinha» (конкретный инструмент), в en/ru — общее «guitar/гитара»; теряется специфика, а в тексте en/ru braguinha вводится как отдельное слово. | The Little Guitar That Became the Ukulele | низкая | сверка трёх языков |
| thread/engenho | name | Engineering | метка/термин: Три названия не совпадают по смыслу: «engenho» = изобретательность/устройство, «Engineering» = инженерия, ru — «стройки и машины»; описание (мосты, акведуки, лифты, машины) ближе к «Engineering». | Engineering | средняя | сверка трёх языков |
| a-portuguesa-1890 | detail_image.alt (en) |  | метка/термин: Британское написание в en-US: «paper-coloured» (то же в Story 09 «neighbouring», «moustached»). | paper-colored; neighboring; mustached | средняя | сверка трёх языков |
| galerias-romanas-rua-da-prata | story | right under the pavement | британизм: в en-US «pavement» это дорожное покрытие; тротуар «sidewalk». По смыслу в pt, вероятно, «calçada/pavimento»: уточнить, что именно имелось в виду | right under the sidewalk (или «right under the street», если речь о мостовой) | низкая | Merriam-Webster, «pavement»: не сверял напрямую |

## Крючки и первые предложения (проход 4 и слепое сравнение, проход 5)

Крючки утверждал владелец, поэтому здесь только предложения; финальный выбор твой. Победитель определён новым субагентом вслепую (версии в случайном порядке); судья это модель, а не носитель, поэтому доверяй выбору с оглядкой и прочитай победителей вслух. Факты в вариантах писали агенты по тексту истории, я их ещё не сверял построчно: перед применением сверю каждый вариант с текстом и источниками. Если победило «было», правка не предлагается. «Повторяет название» значит, что крючок почти слово в слово повторяет заголовок.

| история | повторяет название | было | вариант 1 | вариант 2 | победитель слепого сравнения |
|---|---|---|---|---|---|
| a-portuguesa-1890 |  | The monarchy banned this song, and the republic made it the anthem. | A national insult in 1890 produced a march the monarchy banned. | One night’s march, banned by the king, became the republic’s anthem. | вариант 1 |
| batalha-da-salga-1581 |  | On Terceira, a herd of bulls drove off a Spanish landing. | Hundreds of charging bulls broke a Spanish landing in the Azores. | A friar’s idea sent hundreds of bulls against Spanish soldiers. | было (правку не предлагаю) |
| braguinha-ukulele-1879 |  | Hawaii’s ukulele sailed in from Madeira. | Three Madeiran cabinetmakers landed in Honolulu with a small guitar. | Hawaiians gave the Madeiran braguinha a new name: “ukulele.” | было (правку не предлагаю) |
| capela-sao-joao-baptista |  | The king ordered a chapel from Rome and shipped it in pieces. | Blessed by a pope, then dismantled into 174 pieces for Lisbon. | Rome-made chapel of lapis lazuli and amethyst now stands in Lisbon. | вариант 1 |
| carros-de-cesto-monte |  | On Madeira, wicker sleds race downhill with no snow at all. | Two men in white push a wicker basket down Madeira’s cobblestones. | Thick rubber boot soles are the only brakes on this downhill ride. | было (правку не предлагаю) |
| catarina-cha-1662 |  | A Portuguese princess brought England tea and, in her dowry, Bombay. | Catherine’s dowry brought England Bombay, Tangier, and a taste for tea. | A Portuguese queen moved tea from rare medicine to court fashion. | было (правку не предлагаю) |
| cha-gorreana |  | Europe’s oldest tea exists because of a disease that hit oranges. | Two tea masters from Macau taught Azoreans to grow tea. | Gorreana, founded in 1883, is still Europe’s oldest tea plantation. | было (правку не предлагаю) |
| elevador-bom-jesus |  | The funicular that’s run on water for 140 years. | Two cars, one cable, and almost 6,000 liters of water. | Since 1882 it has climbed Bom Jesus hill without any motor. | вариант 2 |
| elevador-santa-justa |  | The iron elevator Eiffel didn’t build. | Many credit Eiffel, but its designer was merely his student. | A Porto-born engineer built Lisbon’s iron tower; Eiffel gets the credit. | вариант 2 |
| falsos-sebastiao |  | The missing king kept being “found” for twenty years. | Four impostors claimed to be Portugal’s vanished king; all were exposed. | A hermit, a pastry cook, and a novice each claimed Sebastian’s identity. | вариант 1 |
| galerias-romanas-rua-da-prata |  | Lisbon’s flooded Roman galleries. | Nobody agrees what Lisbon’s Roman galleries were built for. | Cars drive over a hatch to flooded Roman galleries. | вариант 2 |
| garum-lisboa |  | Under a Lisbon bank, Romans once made fish sauce. | Workers renovating a bank in 1991 hit Roman salting vats. | A 1991 renovation uncovered Roman vats, and the bank kept them. | вариант 2 |
| livraria-lello | да | The bookstore J.K. Rowling never set foot in. | Lello’s staircase inspired Hogwarts, says the legend. Rowling says otherwise. | Tourists now outnumber customers in Porto’s Hogwarts-by-rumor bookshop. | вариант 1 |
| mafra-sinos-1717 |  | The bellmakers demanded payment up front. The king paid double. | Flemish founders doubted Portugal’s credit. The king doubled their price. | Almost a hundred bells ordered from Flanders for a single monastery. | было (правку не предлагаю) |
| ouro-sao-francisco-porto |  | Friars sworn to poverty covered their church in gold. | From the outside it is plain and gray; inside, Brazil’s gold. | Brazil’s gold ended up on the walls of a Franciscan church. | было (правку не предлагаю) |
| palacio-da-pena |  | The abandoned monastery that became a fairy tale. | An empty monastery on a Sintra hilltop got pink and yellow towers. | A queen’s German husband turned an empty monastery into Pena. | вариант 1 |
| pasteis-de-belem-1837 |  | A secret monastery recipe, or maybe the 19th century’s best marketing. | When Portugal’s monasteries closed in 1834, the tarts went on sale. | A historian calls the “convent pastry” legend largely a myth. | вариант 1 |
| ponte-maria-pia-1877 |  | Eiffel’s first record isn’t in Paris. It’s in Porto. | In 1877 its single iron arch was the longest in the world. | Twelve years before his tower, Eiffel’s firm set a record in Porto. | было (правку не предлагаю) |
| ponte-trajano-chaves |  | The Roman bridge the townspeople paid for themselves. | Two Roman columns on the bridge say the townspeople footed the bill. | Roman arches in Chaves outlasted Rome, the Moors, and floods. | вариант 2 |
| porca-de-murca |  | A pig more than two thousand years old. | A granite pig carved before Rome still stands in Murça’s square. | Over 400 granite beasts have been found, and no one knows why. | вариант 2 |
| prisao-joanina |  | Beneath Coimbra’s golden library was a jail for students. | Upstairs, a gold-and-lacquer library; downstairs, a jail for students and professors. | Until 1834, rule-breaking students were locked up below the books. | вариант 1 |
| restauracao-1640 |  | Sixty years of Spanish kings ended in a single morning. | Noble conspirators arrested Spain’s vicereine and proclaimed a Portuguese king. | Rising taxes and other people’s wars ended in a Lisbon palace takeover. | было (правку не предлагаю) |
| templo-romano-evora | да | The temple a butcher shop saved. | Meat sold between Roman columns kept stone-hungry builders away until 1836. | Walled into a tower, Évora’s Roman columns survived as a meat market. | вариант 2 |
| termas-vipasca |  | At the Roman baths, women paid twice as much as men. | Bronze tablets: women paid a whole coin, men half, children nothing. | Slag heaps hid bronze tablets with a Roman mining village’s laws. | было (правку не предлагаю) |
| travessia-atlantico-sul-1922 |  | The first flight across the South Atlantic took three planes. | Two planes failed them mid-ocean; a third landed them in Rio. | In 1922, Coutinho navigated the open ocean with his own invention. | вариант 1 |
| viriato-139-ac |  | Rome couldn’t defeat the shepherd. So it bought his friends. | Three companions killed Viriathus in his sleep, hoping for Rome’s reward. | Eight years of war ended when three companions took Rome’s offer. | было (правку не предлагаю) |

### Meta-описание (первое предложение истории; меняется как первое предложение текста)

| история | было | вариант 1 | вариант 2 | победитель |
|---|---|---|---|---|
| a-portuguesa-1890 | In January 1890, Britain demanded that Portugal pull out of the lands between Angola and Mozambique. | In January 1890, Britain demanded that Portugal withdraw from the lands between Angola and Mozambique, and the humiliation soon found its song. | After Britain demanded in January 1890 that Portugal pull out of the lands between Angola and Mozambique, the country felt humiliated. | вариант 1 |
| batalha-da-salga-1581 | In 1580 Portugal passed to the Spanish king Philip II, but the island of Terceira in the Azores refused to recognize him. | In 1580 Portugal passed to Philip II of Spain, but Terceira, in the Azores, held out and would not recognize him. | Terceira, in the Azores, refused to recognize Philip II of Spain as its king, and on July 25, 1581, the Spanish landed in Salga Bay. | вариант 1 |
| braguinha-ukulele-1879 | In 1879, the ship Ravenscrag carried hundreds of emigrants from Madeira to Hawaii to work on sugar plantations. | In 1879 the ship Ravenscrag sailed from Madeira to Hawaii with hundreds of emigrants bound for the sugar plantations. | Hundreds of Madeirans crossed to Hawaii on the Ravenscrag in 1879 to work the sugar plantations, bringing a small guitar along. | было (правку не предлагаю) |
| capela-sao-joao-baptista | John V wanted a chapel as fine as any in Rome. | King John V wanted a chapel as fine as any in Rome, so in 1742 he had one commissioned from Rome’s best craftsmen. | In 1742 John V commissioned a chapel from Rome’s best craftsmen, determined to have one as fine as any in the city. | вариант 1 |
| carros-de-cesto-monte | The village of Monte sits on a steep slope above Funchal. | Above Funchal, the village of Monte sits on such a steep slope that its residents came up with a fast way down to town. | Monte, a village on a steep slope above Funchal, gave Madeira its own way downhill: a wicker basket on wooden runners. | вариант 2 |
| catarina-cha-1662 | In 1662, Catherine of Braganza, daughter of John IV, married King Charles II of England. | In 1662 Catherine of Braganza, daughter of John IV, married Charles II of England and brought a dowry of two million cruzados, Tangier, and Bombay. | When Catherine of Braganza married King Charles II of England in 1662, she brought a huge dowry and the Portuguese habit of drinking tea. | вариант 2 |
| cha-gorreana | The island of São Miguel in the Azores lived on oranges, shipped by boat to England. | Oranges kept the island of São Miguel in the Azores alive, shipped by boat to England, until a blight struck the orchards by 1864. | The Azorean island of São Miguel earned its living from oranges shipped to England, until a blight nearly wiped out the orchards by 1864. | вариант 2 |
| elevador-bom-jesus | Above Braga stands the sanctuary of Bom Jesus do Monte, with a huge Baroque staircase. | Above Braga, pilgrims climbing to the sanctuary of Bom Jesus do Monte face a huge Baroque staircase. | The sanctuary of Bom Jesus do Monte rises above Braga, reached by a huge Baroque staircase and, since 1882, by a funicular. | вариант 2 |
| elevador-santa-justa | The Baixa lies down low, and the Chiado district sits on the hill above it. | To spare people the stairs between Lisbon’s low Baixa and the Chiado hill above it, builders began an iron tower with an elevator in 1900. | Lisbon’s Baixa lies low and the Chiado sits on the hill above, so in 1900 construction began on an iron tower with an elevator. | вариант 1 |
| falsos-sebastiao | In 1578, the young King Sebastian vanished in a battle in Morocco. | In 1578, young King Sebastian vanished in a battle in Morocco, and no one got a good look at his body. | In 1578 King Sebastian, still young, vanished in a battle in Morocco, leaving a country that expected him back. | вариант 2 |
| galerias-romanas-rua-da-prata | After the 1755 earthquake, the Baixa was rebuilt from scratch, and in 1771 builders came across Roman underground galleries beneath Rua da Prata. | Builders rebuilding Lisbon’s Baixa after the 1755 earthquake stumbled in 1771 on Roman underground galleries beneath Rua da Prata. | In 1771, while the Baixa was being rebuilt from scratch after the 1755 earthquake, builders came across Roman underground galleries under Rua da Prata. | вариант 1 |
| garum-lisboa | In 1991 a bank in Lisbon’s Baixa set out to renovate its headquarters. | In 1991, a bank in Lisbon’s Baixa began renovating its headquarters and found Roman fish-salting vats under the floor. | In 1991 a Lisbon bank in the Baixa began renovating its headquarters, and the floor hid something Roman. | вариант 1 |
| livraria-lello | Livraria Lello opened in Porto in 1906: a neo-Gothic facade, stained glass, and a red staircase that seems to pour down from the second floor. | Livraria Lello, which opened in Porto in 1906, has a neo-Gothic facade, stained glass, and a red staircase that seems to pour down from the second floor. | Porto’s Livraria Lello opened in 1906 with stained glass, a neo-Gothic facade, and a red staircase that seems to pour from the second floor. | было (правку не предлагаю) |
| mafra-sinos-1717 | King John V made a vow: if he had an heir, he would build a monastery. | King John V vowed to build a monastery if he had an heir, and when a daughter was born, the first stone was laid at Mafra in 1717. | King John V promised to build a monastery if he had an heir, and in 1717, after a daughter was born, Mafra’s first stone was laid. | вариант 1 |
| ouro-sao-francisco-porto | At the end of the 17th century gold was found in Brazil, and ships with precious cargo set sail for Portugal. | When gold was found in Brazil at the end of the 17th century, ships with precious cargo began sailing for Portugal, and some of it went to churches. | Gold discovered in Brazil at the end of the 17th century sent ships laden with treasure to Portugal, and churches got a share. | вариант 2 |
| palacio-da-pena | The German prince Ferdinand of Saxe-Coburg married Portugal’s Queen Maria II and became King Ferdinand II. | Ferdinand of Saxe-Coburg, a German prince who painted and collected art, married Queen Maria II of Portugal and became King Ferdinand II. | A German prince who loved romantic castles, Ferdinand of Saxe-Coburg married Portugal’s Queen Maria II and became King Ferdinand II. | было (правку не предлагаю) |
| pasteis-de-belem-1837 | In 1834, after the civil war, every monastery in Portugal was shut down and the monks sent home. | When the civil war ended in 1834, Portugal closed all its monasteries and sent the monks home. | In 1834, after the civil war, every monastery in Portugal was closed, and the monks had to find another way to make a living. | было (правку не предлагаю) |
| ponte-maria-pia-1877 | The railroad from Lisbon dead-ended at the Douro River: trains couldn’t get into Porto. | The railroad from Lisbon stopped at the Douro River, and trains could not get into Porto until a bridge was ordered from Eiffel’s Paris firm. | Trains from Lisbon stopped short of Porto, because the railroad ended at the Douro River. | было (правку не предлагаю) |
| ponte-trajano-chaves | The Romans covered Lusitania with roads, and on the road from Braga to Astorga they needed a bridge over the Tâmega River. | The Romans criss-crossed Lusitania with roads, and on the one from Braga to Astorga they had to bridge the Tâmega River. | Lusitania was covered in Roman roads, and the one from Braga to Astorga needed a bridge over the Tâmega River. | вариант 1 |
| porca-de-murca | Even before the Romans, tribes in northeastern Portugal and western Spain carved boars, pigs, and bulls out of granite. | Long before the Romans, tribes in northeastern Portugal and western Spain were carving boars, pigs, and bulls from granite. | Boars, pigs, and bulls of carved granite, left by tribes of northeastern Portugal and western Spain, predate the Romans. | вариант 1 |
| prisao-joanina | In 1717, John V gave the University of Coimbra money for a new library. | In 1717, King John V gave the University of Coimbra the money to build a new library. | The University of Coimbra got money from John V in 1717 to build a new library. | было (правку не предлагаю) |
| restauracao-1640 | From 1580, Portugal was ruled by the kings of Spain. | From 1580 the kings of Spain ruled Portugal, and the Portuguese paid for it in rising taxes and wars fought for someone else. | For decades after 1580, Portugal belonged to the kings of Spain, and its nobles were sent to fight for interests that weren’t theirs. | вариант 1 |
| templo-romano-evora | In the 1st century a temple was built in the center of Évora, probably in honor of Emperor Augustus. | In the 1st century Évora raised a temple in its center, probably in honor of Emperor Augustus. | At the heart of Évora stands a temple from the 1st century, probably dedicated to Emperor Augustus. | вариант 2 |
| termas-vipasca | By the Vipasca mine, today’s Aljustrel in the Alentejo, a Roman miners’ village grew up. | At the Vipasca mine, in today’s Aljustrel in the Alentejo, a Roman miners’ village grew up, and its laws were set down on bronze. | Roman miners settled by the Vipasca mine, in what is now Aljustrel in the Alentejo, and a village grew around them. | вариант 2 |
| travessia-atlantico-sul-1922 | In 1922, navy officers Gago Coutinho and Sacadura Cabral set out to fly from Lisbon to Brazil for its independence centennial. | Two Portuguese navy officers, Gago Coutinho and Sacadura Cabral, set out in 1922 to fly from Lisbon to Brazil for its independence centennial. | For Brazil’s independence centennial in 1922, navy officers Gago Coutinho and Sacadura Cabral set out to fly there from Lisbon. | было (правку не предлагаю) |
| viriato-139-ac | Viriathus was a Lusitanian shepherd who became the leader Rome fought for eight years. | Rome spent eight years fighting a Lusitanian shepherd named Viriathus. | Viriathus, a Lusitanian shepherd, became the leader against whom Rome fought for eight years. | вариант 1 |

## Крючок не должен повторять название: проверка всех 44 историй

Проверено 44 историй (26 новых и 18 прежних), крючок против названия: совпадение слово в слово, вхождение названия в крючок или общий отрезок не менее 60% слов названия.

| история | название | крючок | степень | два варианта крючка |
|---|---|---|---|---|
| elevador-santa-justa | The Lift Eiffel Didn’t Build | The iron elevator Eiffel didn’t build. | почти (60% слов названия подряд) | 1) Many credit Eiffel, but its designer was merely his student.<br>2) A Porto-born engineer built Lisbon’s iron tower; Eiffel gets the credit. |
| legiao-portuguesa-1812 | Portuguese in Napoleon’s Army | Of 9,000 Portuguese in Napoleon’s army, about a hundred remained. | название целиком внутри | 1) Nine thousand Portuguese marched with Napoleon. About a hundred remained.<br>2) Napoleon took 9,000 Portuguese east. About a hundred came back. (мои варианты, слепое сравнение не проходили; в оригинале крючок несёт факт, поэтому можно оставить) |
| livraria-lello | The Bookstore J.K. Rowling Never Visited | The bookstore J.K. Rowling never set foot in. | почти (83% слов названия подряд) | 1) Lello’s staircase inspired Hogwarts, says the legend. Rowling says otherwise.<br>2) Tourists now outnumber customers in Porto’s Hogwarts-by-rumor bookshop. |
| templo-romano-evora | The Temple a Butcher Shop Saved | The temple a butcher shop saved. | слово в слово | 1) Meat sold between Roman columns kept stone-hungry builders away until 1836.<br>2) Walled into a tower, Évora’s Roman columns survived as a meat market. |

Найдено совпадений: **4**. Новые крючки-кандидаты из таблицы выше (раздел «Крючки») подобраны так, чтобы не повторять название; финальный выбор твой.


## check:ai-tells на этом языке

Для каждого предупреждения: оставить (почему) или правка. Остальные 32 «старых» предупреждения по прошлым историям разобраны здесь же (поле «новая история» = нет).

| # | история | поле | тип | сейчас | решение | почему | правка |
|---|---|---|---|---|---|---|---|
| 6 | braguinha-ukulele-1879 | story | spread | 5 sentences of 11-18 words (spread 0.19) | оставить | Разброс 0.19, последовательные факты о плавании. |  |
| 9 | braguinha-ukulele-1879 | more | spread | 6 sentences of 13-23 words (spread 0.19) | оставить | Разброс 0.19, абзацы разной длины и короткий средний абзац. |  |
| 11 | capela-sao-joao-baptista | more | sentence-start | 3 sentences in a row start with «the» | оставить | Повторы «the» это параллельные факты о модели часовни, не механический ритм. |  |
| 13 | carros-de-cesto-monte | more | construction | old days they brought down not just people but cargo too, then hauled the | правка | «not just X but Y» без нужного контраста. | brought down people and cargo, then hauled the |
| 15 | casa-da-neve-1782 (старая) | more | question | Where did the ice come from? | правка | Риторический вопрос в начале поля. | At first snow |
| 23 | elefantes-malaca-1511 (старая) | story | sentence-start | 3 sentences in a row start with «the» | оставить | Повтор «The» в описании боя: параллельные действия сторон. |  |
| 27 | elevador-santa-justa | story | spread | 5 sentences of 12-18 words (spread 0.13) | оставить | Разброс 0.13, но фразы разного строения, читается естественно. |  |
| 34 | guerra-laranjas-1801 (старая) | story | spread | 5 sentences of 10-23 words (spread 0.25) | оставить | Разброс 0.25. |  |
| 36 | mafra-sinos-1717 | more | paragraph-start | 3 paragraphs start with «the» | правка | Три абзаца подряд на «The»; третий легко переименовать по предмету. | Mafra cost more than money |
| 38 | morcegos-mafra-1771 (старая) | more | evaluation | also live in another famous library, the Joanina in | правка | «famous» без причины. | another library, the Joanina |
| 41 | ouro-sao-francisco-porto | more | sentence-start | 3 sentences in a row start with «the» | оставить | Параллельные факты о золоте и налоге. |  |
| 46 | pasteis-de-belem-1837 | more | evaluation | backstory. Even the most famous version takes a hit: that | правка | «most famous» пустое. | Even the most widely told version takes a hit |
| 52 | ponte-trajano-chaves | more | sentence-start | 3 sentences in a row start with «the» | оставить | То же. |  |
| 56 | porca-de-murca | story | evaluation | or grave markers. The most famous, the Porca de Murça, is | оставить | То же. |  |
| 57 | porca-de-murca | more | sentence-start | 3 sentences in a row start with «in» | оставить | Повторы «In» это параллельные места (Испания, Браганса), факты. |  |
| 58 | ruas-oficios-1760 (старая) | story | triples | 2 lists of three, 2 in a row | оставить | Тройка ремёсел взята из указа, это факт. |  |
| 62 | ruas-oficios-1760 (старая) | more | construction | Pombal thus brought order not only to the street plan but to trade as well: a shopper | правка | «not only X but Y» без реального контраста. | Pombal thus brought order to the street plan and to trade |
| 63 | ruas-oficios-1760 (старая) | more | ending | result is a confusion that lives on: to everyone, Rua Áurea is | правка | «confusion that lives on» оценка; оставить факт. | That is why Rua Áurea is still Rua do Ouro to everyone. |
| 66 | torres-vedras-1810 (старая) | more | spread | 6 sentences of 19-25 words (spread 0.09) | правка | Разброс 0.09; то же разделение. | Portuguese farmers left their land and destroyed the food they could not carry. The French army went hungry. |
| 70 | avis-e-descobrimentos (старая) | intro | triples | 2 lists of three, 2 in a row | оставить | То же. |  |

## Подпись дат эпох 0 и 1

Сейчас в `src/content/epochs.yaml`: эпоха 0 («Пролог») уже подписана диапазоном; **эпоха 1 всё ещё «until the 5th century»** (`years: -500…409`). Предложение: **«6th c. BC – 5th c.»**, чтобы подряд читалось «… – VI в. до н. э.», «VI в. до н. э. – V в.», «V–XII вв.». Плитка на главной и шапка эпохи с предложенной подписью (временная правка в dev-сборке, не в коде, возвращена): `scripts/.tmp/audit/shots/proposed-home-{pt,ru}-{1280,390}.png` и `proposed-epoch-{pt,ru}-{1280,390}.png`; подпись помещается в плитку без переноса лишнего.

Эпоха 0: «150 млн лет» остаётся круглой цифрой, но подпись «150 million years ago – 6th c. BC» не говорит, что это приблизительно, и не говорит «назад» (читается как длительность). Предложение: **«about 150 million years ago – 6th c. BC»**. 

## Сверка шкал: век, год до н. э., диапазон (проход 3)

| история | поле | pt | en | ru | замечание |
|---|---|---|---|---|---|
| batalha-da-salga-1581 | year_label | 25 de julho de 1581 | July 25, 1581 | 25 июля 1581 | В ru нет «года» (глоссарий: «27 октября 2026 года»); то же в Story 03, 08, 19, 26. Решить: в подписях шкалы допустимо без «года», тогда зафиксировать правило. |
| braguinha-ukulele-1879 | year_label | agosto de 1879 | August 1879 | август 1879 | ru без «года» (см. Story 02). |
| carros-de-cesto-monte | year_scale | c. 1850 | c. 1850 | ок. 1850 | pt: в label «c. de», в scale «c.» без «de» (допустимо); ru сокращено «ок.». |
| elevador-bom-jesus | year_label | 25 de março de 1882 | March 25, 1882 | 25 марта 1882 | ru без «года» (см. Story 02). |
| galerias-romanas-rua-da-prata | year_label | séc. I (descobertas em 1771) | 1st century (found in 1771) | I век, найдены в 1771 | Согласовано по смыслу; en в label «century» полностью (в scale «c.»), pt «séc.» сокращено. |
| galerias-romanas-rua-da-prata | year_scale | séc. I | 1st c. | I век | В ru для одного века в scale «I век» (также Story 24), а в Story 16 «XVIII в.» и Story 21 «IV в.»: нужно единообразие, предлагается «I в.». |
| morcegos-mafra-1771 | year_label | século XVIII | 18th century | XVIII век | pt написан полным «século XVIII», в остальных label/scale pt «séc.» (Story 11, 12, 16, 21, 24, 25). Также у Story 15 нет year_scale при вековом label (возможно, пропущен). |
| ouro-sao-francisco-porto | year_scale | séc. XVIII | 18th c. | XVIII в. | ru «в.» против «I век» в Story 11 и 24. |
| ponte-maria-pia-1877 | year_label | 4 de novembro de 1877 | November 4, 1877 | 4 ноября 1877 | ru без «года» (см. Story 02). |
| porca-de-murca | year_scale | séc. IV a.C. | 4th c. BC | IV в. до н. э. | Диапазон label IV–I свёрнут до одного IV века, а в Story 12 и 25 scale сохраняет диапазон; либо оставить как намеренное (начало), либо писать «séc. IV–I a.C.» / «4th–1st c. BC» / «IV–I вв. до н. э.». |
| templo-romano-evora | year_scale | séc. I | 1st c. | I век | ru «I век» вместо «I в.» (см. Story 11). |
| travessia-atlantico-sul-1922 | year_label | 30 de março – 17 de junho de 1922 | March 30 – June 17, 1922 | 30 марта – 17 июня 1922 | ru без «года» (см. Story 02). |
| epoch/antes-de-portugal | years_label | 150 milhões de anos – séc. VI a.C. | 150 million years ago – 6th c. BC | 150 млн лет — VI в. до н. э. | Нет «atrás/назад» в pt и ru; в ru длинное тире вместо «–»; en «6th c.» против «5th century» в Epoch 29. |
| epoch/lusitania-e-roma | years_label | até ao séc. V | until the 5th century | до V в. | en полностью «century», в Epoch 28 «c.»; pt/ru сокращены. |

Общее: в ru в подписях шкалы перемешаны «I век», «XVIII в.», «вв.»: предлагаю одну форму («I в.», «I–V вв.») для `year_scale`, а в `year_label` оставить полные слова. Подписи дат без «года» в ru («25 июля 1581») допустимы как подпись, но глоссарий требует «года» в тексте; решить правилом.

## Глоссарий: новые имена и места (docs/glossary.md)

Расхождения с уже существующим глоссарием и новые строки, которые я предлагаю внести после «ок». Показана строка для этого языка и две другие для сверки.

| понятие | pt | en | ru | статус | замечание |
|---|---|---|---|---|---|
| Viriathus | Viriato | Viriathus | Вириат | новое | Единообразно в трёх языках (S27, Epoch 29). В ru топоним «Кава-де-Вириату» (форма с -у) рядом с «Вириат» допустим как название места. |
| Caepio | Cepião | Caepio | Цепион | новое | Квинт Сервилий Цепион; ru традиционная форма, en классическая. |
| Appian / Diodorus | Apiano, Diodoro | Appian, Diodorus | Аппиан, Диодор | новое | Античные авторы, ru по традиции. |
| Cava de Viriato (Viseu) | Cava de Viriato | Cava de Viriato | Кава-де-Вириату | новое | Viseu: Визеу. |
| King John IV | D. João IV | King John IV | Жуан IV | новое | В глоссарии есть I, V, VI, нет IV. Формы в файлах соответствуют правилу. |
| King Afonso V | D. Afonso V | King Afonso V | Афонсу V | новое | S24. В en сохраняется Afonso (как Afonso Henriques в глоссарии). |
| King Luís I | D. Luís I | King Luís I | Луиш I | новое | S19: без порядкового номера во всех трёх; для единообразия с другими королями нужен номер I. В en оставляем Luís с диакритикой (как в Britannica/Wikipedia). |
| Queen Maria Pia | D. Maria Pia | Queen Maria Pia | Мария Пия | новое | ru в названии моста: «Мост Марии Пии». |
| Queen Maria II | D. Maria II | Queen Maria II | Мария II | новое | По образцу строки Maria I в глоссарии. |
| King Ferdinand II (Pena) | D. Fernando II | King Ferdinand II | Фернанду II (при первом упоминании: принц Фердинанд Саксен-Кобург-Готский) | новое | ru в файлах «Фердинанд» везде; по правилу глоссария (практическая транскрипция с португальского, как Жуан/Мануэл) для короля Португалии ожидается «Фернанду II»; принц до восшествия — «Фердинанд Саксен-Кобург-Готский». |
| Charles II of England | Carlos II de Inglaterra | King Charles II of England | Карл II | новое |  |
| Philip II of Spain | Filipe II | Philip II | Филипп II | новое | S02. Для испанского короля ru даёт традиционную форму, не «Фелипе». |
| Pope Benedict XIV | papa Bento XIV | Pope Benedict XIV | папа Бенедикт XIV | новое | По образцу «Лев X» в глоссарии. |
| Charles I of Austria | o imperador Carlos I da Áustria | Emperor Charles I of Austria | император Австрии Карл I | новое | S05. |
| Emperor Trajan | imperador Trajano | Emperor Trajan | император Траян | новое | S20, Epoch 29. |
| Emperor Augustus | imperador Augusto | Emperor Augustus | император Август | новое | S24. |
| Pliny the Elder | Plínio, o Velho | Pliny the Elder | Плиний Старший | новое |  |
| Mesnier du Ponsard | Raoul Mesnier du Ponsard | Raoul Mesnier du Ponsard | Рауль Мениер дю Понсар | новое | Внутри ru два написания имени: Раул и Рауль. Это француз по семье, поэтому «Рауль». Фамилия во французской транскрипции звучит ближе к «Мение», но файлы везде пишут «Мениер», главное — единообразие. |
| Niklaus Riggenbach | Niklaus Riggenbach | Niklaus Riggenbach | Никлаус Риггенбах | новое |  |
| Gustave Eiffel | Gustave Eiffel | Gustave Eiffel | Гюстав Эйфель | новое |  |
| Augusto Dias | Augusto Dias | Augusto Dias | Аугушту Диаш | новое | Тут же Мануэл Нуниш (Manuel Nunes), Жозе ду Эшпириту Санту (José do Espírito Santo). Внутри ru согласовано (Аугушту Диаша). |
| Manuel Nunes / José do Espírito Santo | Manuel Nunes / José do Espírito Santo | Manuel Nunes / José do Espírito Santo | Мануэл Нуниш / Жозе ду Эшпириту Санту | новое | Мануэл согласовано с глоссарием (Мануэл I). |
| Kalakaua / Liliʻuokalani | Kalakaua / Liliʻuokalani | Kalakaua / Liliʻuokalani | Калакауа / Лилиуокалани | новое | В ru знак окина опущен, допустимо. |
| Alfredo Keil | Alfredo Keil | Alfredo Keil | Алфреду Кейл | новое | Согласовано. |
| Henrique Lopes de Mendonça | Henrique Lopes de Mendonça | Henrique Lopes de Mendonça | Энрике Лопеш де Мендонса | новое | Энрике согласовано с глоссарием (инфант Энрике). |
| A Portuguesa (anthem) | «A Portuguesa» | “A Portuguesa” | «A Portuguesa» (везде латиницей) | новое | Внутри ru два написания: латиница и кириллица. Выбрать одно: для гимна принято сохранять оригинальное название латиницей. |
| Brianda Pereira | Brianda Pereira | Brianda Pereira | Брианда Перейра | новое | Перейра согласовано с глоссарием (Нуну Алвареш Перейра). |
| Agostino Masucci | Agostino Masucci | Agostino Masucci | Агостино Мазуччи | новое |  |
| Manuel Caetano de Sousa | Manuel Caetano de Sousa | Manuel Caetano de Sousa | Мануэл Каэтану де Соуза | новое | Согласовано, склоняется верно (Соузы). |
| Baron von Eschwege | barão de Eschwege | Baron von Eschwege | барон фон Эшвеге | новое | Фамилия немецкая: в pt «de», в en «von». |
| Giuseppe Cinatti | Giuseppe Cinatti | Giuseppe Cinatti | Джузеппе Чинатти | новое | Итальянское имя по итальянскому произношению. |
| Manuel Fialho (jesuíta) | Manuel Fialho | Manuel Fialho | Мануэл Фиалью | новое | В ru source note: «Мануэла Фиалью». |
| João Cutileiro | João Cutileiro | João Cutileiro | Жуан Кутилейру | новое | Жуан согласовано с глоссарием. |
| João Pedro Gomes | João Pedro Gomes | João Pedro Gomes | Жуан Педру Гомеш | новое |  |
| José Saramago + Memorial do Convento | José Saramago, «Memorial do Convento» | “Baltasar and Blimunda” (original: Memorial do Convento) | Жозе Сарамаго | новое | Названия книги даны по изданным переводам, все верно; в en титул не совпадает с pt по форме, это норма. |
| Mateus Álvares / Gabriel de Espinosa / Marco Tullio Catizone | Mateus Álvares / Gabriel de Espinosa / Marco Tullio Catizone | Mateus Álvares / Gabriel de Espinosa / Marco Tullio Catizone | Матеуш Алвареш / Габриэль де Эспиноса / Марко Туллио Катицоне | новое | Испанец Эспиноса с «-эль» по правилу испанских имён (как Мануэль Годой) — верно. |
| Antão de Almada | D. Antão de Almada | Antão de Almada | Антан де Алмада | новое |  |
| J. K. Rowling | J.K. Rowling / Joanne Rowling | J.K. Rowling / Joanne Rowling | Дж. Роулинг / Джоан Роулинг | новое | Допустимо (Дж. в hook и заголовке, Джоан в тексте). |
| Café Majestic | Café Majestic | Café Majestic | кафе Majestic | новое | В en порядок слов отличается от pt (официально Café Majestic); в ru название латиницей, как и Lello. |
| Livraria Lello | Livraria Lello | Livraria Lello | Книжный магазин Lello | новое | В ru название латиницей, в остальных именах кириллица; допустимо для бренда, но стоит зафиксировать правило. |
| Belém / Pastéis de Belém | Pastéis de Belém | Pastéis de Belém | «Пастейш де Белен» | расходится | Белен согласовано. Название кондитерской в ru пишется тремя способами; глоссарий: «Пастейш де Белен» (без дефисов, в кавычках). |
| Rossio | Rossio | Rossio | Россио | расходится | Глоссарий: ru «Россио»; в S23 написано «Росиу». |
| Terramoto 1755 | o terramoto de 1755 | the 1755 earthquake | землетрясение 1755 года | расходится | Глоссарий: the 1755 Lisbon earthquake / лиссабонское землетрясение 1755 года; в файлах «Lisbon/лиссабонское» опускается (допустимо по контексту), но в en три разных формы. |
| Debated label | em debate (обновить глоссарий) | debated | в обсуждении | расходится | Глоссарий pt: «debatido», в файлах «Em debate» (и в S15, и в UI). Либо менять глоссарий на «em debate», либо метку. |
| Era (época) | época | era | эпоха | расходится | Глоссарий: época = era = эпоха. В en fallback_image.caption «age». |
| Funchal | Funchal | Funchal | Фуншал | новое | Madeira: Мадейра; Monte: Монте; Nossa Senhora do Monte: Носса-Сеньора-ду-Монте. |
| Terceira / Salga | Terceira / Baía da Salga | Terceira / Salga Bay | Терсейра / бухта Салга | новое |  |
| São Miguel / Gorreana / Porto Formoso / Maia | São Miguel / Gorreana / Porto Formoso / Maia | São Miguel / Gorreana / Porto Formoso / Maia | Сан-Мигел / Горреана / Порту-Формозу / Майя | новое | Азоры: pt «Açores», en «Azores», ru «Азоры» и «Азорские острова» (оба в тексте). |
| Lau-a-Pan / Lau-a-Teng | Lau-a-Pan / Lau-a-Teng | Lau-a-Pan / Lau-a-Teng | Лау-а-Пан / Лау-а-Тенг | новое |  |
| José do Canto / Ermelinda Gago da Câmara | José do Canto / Ermelinda Gago da Câmara | José do Canto / Ermelinda Gago da Câmara | Жозе ду Канту / Эрмелинда Гаго да Камара | новое | Жозе согласовано с глоссарием. |
| Bom Jesus do Monte | Bom Jesus do Monte | Bom Jesus do Monte | Бон-Жезуш-ду-Монте | новое | Braga: Брага. |
| Santa Justa Lift | Elevador de Santa Justa | Santa Justa Lift | лифт Санта-Жушта | новое | Carmo: Карму. |
| São Roque | Capela de São João Batista | Chapel of St. John the Baptist | часовня Иоанна Крестителя | новое | В pt «Baptista» — старая орфография, при AO1990 норма «Batista» (если не сохраняется как официальное название капеллы). Согласовано: Сан-Роке и Сан-Франсишку. |
| Church of São Francisco / Palácio da Bolsa | Igreja de São Francisco / Palácio da Bolsa | Church of São Francisco / Stock Exchange Palace | церковь Сан-Франсишку / Биржевой дворец | новое | Ribeira: Рибейра. |
| Vila Viçosa / Paço Ducal | Paço Ducal de Vila Viçosa | Ducal Palace of Vila Viçosa | Герцогский дворец, Вила-Висоса | новое | В ru добавлено «герцогов Браганса», в pt/en нет (допустимое пояснение). Bragança: Браганса (город и герцог), Брагансская (прил.). |
| Aquae Flaviae / Chaves | Aquae Flaviae | Aquae Flaviae | Аквы Флавиевы | новое | Тамега: Тамега (в ru Тамегу — винительный). Padrão dos Povos: Падрау-душ-Повуш. |
| Murça | Porca de Murça | Porca de Murça (the Murça pig) | Свинья из Мурсы; берроинш; пелоуриньу | новое | Берроинш/berrões: ru «берройнш», проверить транслитерацию (по нормам было бы «берроинш»); pelourinho: ru «пелоуриню», ожидается «пелоуриньу» (nh=нь). В en S21 оба названия: «Porca de Murça» и «Murça pig». |
| Évora | Évora | Évora | Эвора | новое |  |
| Vipasca / Aljustrel | Vipasca / Aljustrel | Vipasca / Aljustrel | Випаска / Алжуштрел / Алентежу | новое | Alentejo: ru «Алентежу» (в глоссарии только Алту-Алентежу). |
| Tróia | Tróia | Tróia | Тройя | новое | Пишется как просторечная форма Troy; в ru «Троя» (Трои) — другой город. Лучше «Трою»: для полуострова Tróia принято «Тройя»/«Троя» с пояснением, внести в глоссарий. |
| Coimbra / Joanina | Coimbra / Biblioteca Joanina | Coimbra / Joanina Library | Коимбра / Жуанина | новое | Жуанина от Жуан — согласовано. Conimbriga в этих файлах не встречается. |
| Sintra / Pena | Palácio Nacional da Pena | Pena National Palace | Синтра / Пена | новое |  |
| Restauração / Praça dos Restauradores | Restauração da Independência / Praça dos Restauradores | Restoration of Independence (Restauração) / Praça dos Restauradores | Праса-душ-Рештаурадореш | новое | Паттерн «Праса-ду-Комерсиу» соблюдён. |
| Penedos de São Pedro e São Paulo | Penedos de São Pedro e São Paulo | Saint Peter and Saint Paul Rocks | скалы Святых Петра и Павла | новое | Самолёты: Lusitânia, Pátria, Santa Cruz → «Лузитания», «Патрия», «Санта-Круш». Pavilhão das Galeotas: павильон королевских галер (galeota = королевская барка). |
| Museu de Marinha | Museu de Marinha | Navy Museum | Морской музей (Музей флота) | новое | Официальный английский: Navy Museum. |
| Great Britain / England | Grã-Bretanha | Britain | Британия | новое | Внутри pt и ru заголовок S01 расходится с телом. |
| tourada à corda | tourada à corda | tourada à corda | «тоурада а корда» | новое | Практическая транскрипция «tourada» даёт «тоурада». |
| carreiros | carreiros | carreiros | каррейруш | новое | Внутри ru согласованно; в тексте «возчики». |
| Ravenscrag | «Ravenscrag» | Ravenscrag | «Равенскраг» | новое | В en без кавычек, в pt/ru в кавычках — по нормам языков. |

Список из запроса, проверен целиком: Viriato / Вириат / Viriathus; Cepião / Цепион / Caepio; D. João V / Жуан V / King John V (уже в глоссарии); Mesnier du Ponsard (в ru два написания внутри текста: «Раул» и «Рауль», предлагаю «Рауль Мениер дю Понсар»; передачу фамилии не проверял по французскому источнику, поэтому «не уверен»); Gago Coutinho и Sacadura Cabral (в глоссарии, сверено); Augusto Dias / Аугушту Диаш; Vipasca / Випаска; Aquae Flaviae / Аквы Флавиевы; Olisipo / Олисипо (в глоссарии).

## Факты в крючках, которых нет в тексте историй (замечено при сверке)

Крючки утверждал владелец, поэтому только пометка, без правки:

- `falsos-sebastiao`: «двадцать лет» (pt «vinte anos»): в тексте названы 1584 и 1585 год, кондитер из Мадригаля и калабриец; общего срока в двадцать лет там нет. Либо поправить на «около двадцати лет», либо добавить годы в текст.
- `ponte-maria-pia-1877`: «первый рекорд Эйфеля» (pt «o primeiro recorde de Eiffel»): в тексте сказано, что арка в 160 м была самой длинной в мире, но не что это первый рекорд Эйфеля. Источник в YAML проверить.

## Показать живому носителю

- «elevator» против «lift» в одном тексте (elevador-santa-justa): имя собственное «Santa Justa Lift» оставить, остальное «elevator»?
- «based on the age of …» → «depicting the era of …» в подписях трёх эпох.
- «prepared their last meeting» → «held their last meeting» (restauracao-1640).
- «ocher» (МW: основная форма) против «ochre».
- «the age cutoff differs» вместо «the base differs» (monarquia-e-republica, then_now).
- «sign a peace treaty» (viriato-139-ac).
- Заголовок «The Elephant Who Went to See the Pope» и новые крючки: прочитать вслух.
- Оксфордская запятая в названиях «Union, Restoration and Brazilian Gold» и в «Gold, baroque, and independence».

## Как проходил разбор и что не охвачено

- Слепое чтение: отдельный субагент на язык видел только файл своего языка без пометки «перевод» (в вопросе об оценке «заметно ли, что перевод» подсказка всё же есть). Средние оценки субагентов разных языков нельзя сравнивать между собой строго: у каждого своя шкала.
- Словари (проход 6): сверено вживую Priberam («virar», «garimpeiro»), Грамота.ру («ненадолго»), Grammarist/Merriam-Webster через поиск («ocher», «mustache»; страницы Merriam-Webster напрямую не открылись, 403), Diário da República / Museu São Roque («Baptista»). Для «fazia-se doces» нашёл только общее правило согласования, статьи Ciberdúvidas не нашёл. Остальное без сверки отмечено «не уверен» и в применение не пойдёт.
- Факты не менялись и не проверялись заново. При сверке трёх языков агент отметил два места на проверку тебе (я их не перепроверял): «cerca de 61 milhões» у эпохи 1 (агент насчитал для Испании и Португалии вместе около 58–59 млн; источник указан в YAML) и то, что Aquae Flaviae (Chaves) в римское время входила в провинцию Hispania Tarraconensis, а не Lusitania (в тексте эпохи этого не утверждается прямо).
- Неразрывные пробелы в «I в.», «до н. э.» по тексту выгрузки проверить нельзя; их ставит код (`src/lib/events.ts`).

## Что применено (решения владельца от 31.10.2026)

- Применены: все «ошибки», все находки высокой уверенности, из средней типографика, глоссарий и непоследовательности. Не применены: стилистические «средние» и все «низкие» (они остаются в таблице выше). Первые предложения историй (meta) не переписывались, правились только ошибки.
- Крючки: заменены только по списку владельца: `templo-romano-evora`, `elevador-santa-justa`, `pasteis-de-belem-1837`, `elevador-bom-jesus` (без числа литров), `livraria-lello` (только pt), `travessia-atlantico-sul-1922`, `falsos-sebastiao` («почти двадцать лет» на трёх языках). Остальные крючки остались как были, хотя слепое сравнение предлагало больше замен.
- ai-tells: 25 правок применены (по языкам: pt 9, en 8, ru 8); остальные 47 предупреждений оставлены, причина в таблице раздела ai-tells.
- Эпохи: подпись даты эпохи 0 «около 150 млн лет назад – VI в. до н. э.» (и pt, en), эпохи 1 «VI в. до н. э. – V в.» (и pt, en); тире короткое везде. В подписях запасных картинок пяти эпох нет названия модели («создана ИИ»), «era» вместо «age», в ru «по мотивам эпохи».
- Нить: pt «Engenharia»; en «Engineering» и ru «Стройки и машины» без изменений; слаги и URL прежние.
- «Рауль Мениер дю Понсар» (ru), «Raoul Mesnier du Ponsard» (pt, en) везде, добавлено в `docs/glossary.md`; в глоссарии новые имена, места и решения (elevator вместо lift, era вместо age, без названия модели, запятая в en перед «and»).
- Эпоха 1 «cerca de 61 milhões» оставлено: INE Испании даёт 49 687 120 (1 апреля 2026), INE Португалии 11 424 031 (31 декабря 2025), вместе 61,1 млн, значит «почти 60 млн» было бы неверно. Aquae Flaviae не менялась.
- Статья «Ponte Maria Pia»: во всех трёх языках в историю добавлено, что 160-метровая арка перекрыла прежний рекорд (мост Идса, 158,5 м; источник: Wikipedia «Maria Pia Bridge», уже в списке источников истории). Крючок «Первый рекорд Эйфеля» оставлен; то, что рекорд первый, источник не подтверждает.
- Позже по решению владельца: у `thread/engenho` в en описании «elevators»; крючок `ponte-maria-pia-1877` без слова «первый»; `Baroque` в теме эпохи 5 en и `author: Gemini (AI)` в данных картинок оставлены как есть.
- Отметки `lang_review` поставлены для всего, что прочитано (39 единиц), затем для остальных шести единиц (изменившиеся поля перечитаны): `lang:pending` пуст.
