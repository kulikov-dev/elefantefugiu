# Вычитка: Португальский (pt-PT, AO1990)

Отчёт проходов 0–6. Правки применены отдельным коммитом на язык (28.10.2026 по решениям владельца); столбец «статус» говорит, что применено. Источник правок: слепое чтение носителем (проход 1), правила (проход 2), сверка языков (проход 3), переписывание от смысла (проход 4), слепой выбор крючков и описаний (проход 5), сверка по словарям (проход 6).

## Сводка

- Находки слепого чтения: **71**; предложенные правки (проход 4): **66**, из них низкой уверенности (в применение не идут, см. ниже): **5**.
- Срабатывания стоп-листов `check:lang` (проход 2): **1**.
- По категориям правок: pouco natural — 42, decalque — 11, inconsistente — 10, erro — 2, brasileirismo — 1.
- Оценка «заметит ли носитель перевод» (1 = нет, 5 = да), среднее по 18 историям: **до правок 2.00**; **после правок 2.56**.
- Крючки: заменить 9 из 18, оставить как было 9. Описания (первые предложения историй, страницы, эпохи): заменить 20 из 26.

### Пять самых заметных мест (до правок)

- `event/motim-companhia-1757` [story]: «Na quarta-feira de cinzas» — Названия церковных праздников в португальском пишут с заглавной: Quarta-feira de Cinzas. (erro)
- `ui/map` [map.legend_here]: «você» — «você» — бразильская форма и не согласуется с остальным интерфейсом (se escreve na 3.ª pessoa implícita). (brasileirismo)
- `static/about` [sections[como-ler].after[0]]: «por fios (o mar, comida e vinho, poder e revolta, gente como nós, natureza)» — «fios» — калька с «threads»; в журналистском португальском сказали бы «temas»; перечень без артикля неровный. (decalque)
- `event/corte-brasil-1807` [more]: «Hoje esses livros estão na base da Biblioteca Nacional do Brasil.» — «na base de» — калька (в основе); по-португальски «na origem de». (decalque)
- `event/casa-da-neve-1782` [story]: «servia bebidas geladas e «neves» com sabores» — «com sabores» — калька; по-португальски говорят «aromatizadas» или «de vários sabores». (decalque)

### Что остаётся заметным после правок (повторное слепое чтение)

- `event/hanno-1514` [story]: «Em 1514, D. Manuel I mandou uma embaixada a Roma, com presentes para o novo papa, Leão X. Manuel I enviou a Roma uma embaixada com presentes para o novo papa, Leão X.» — Дословное дублирование предложения — артефакт правки/машинного перевода, носитель не напишет так.
- `event/terramoto-1755` [story]: «D. José I ouviu missa de manhã e deixou Lisboa porque uma das filhas queria passar o feriado fora. José I ouviu missa logo de manhã e saiu de Lisboa» — Тот же повтор двух вариантов одной фразы подряд.
- `event/hanno-1514` [story]: «o elefante ajoelhou-se diante do papa e barriu» — «Barriu» — редкое слово, а «elefante branco da Índia» — калька; естественнее «bramiu/barritou».
- `event/elefantes-malaca-1511` [story]: «deu meia-volta aos berros ... abandonou a montada» — «Aos berros» и «abandonou a montada» звучат как перевод; по-португальски сказали бы «fugiu aos berros / caiu da montada».
- `event/douro-1756` [story]: «criou uma companhia com o monopólio do comércio com Inglaterra e o Brasil, e arrancaram-se os sabugueiros» — Внезапный безличный оборот без пояснения (почему сабугейрос) — логический и стилистический скачок, как в переводе хука.

## Таблица правок

Применены по правилам владельца: en — всё, кроме низкой уверенности; pt и ru — высокая уверенность и категории «ошибка», «непоследовательно», «калька» (pt: erro, inconsistente, decalque, brasileirismo) при средней. «Неестественно» со средней и низкая уверенность остаются как есть и вынесены в список для носителя. Исключения низкой уверенности, одобренные владельцем: «butcher shop», «Carmo Convent», «Национальный театр королевы Марии II», «Quarta-feira de Cinzas», названия улиц в `ruas-oficios` (ru).

| файл | поле | сейчас | проблема | предложение | уверенность | источник | статус |
|---|---|---|---|---|---|---|---|
| src/content/events/aljubarrota-1385.yaml | story | O conselho de guerra não chegou a acordo sobre onde combater, por isso, a 6 de agosto, saiu do acampamento com uns 2000 homens e escolheu sozinho o campo de batalha. Segundo Froissart, mandou abrir valas e covas de lobo num planalto estreito. A 14, à hora das vésperas, os franceses que atacaram primeiro caíram lá dentro. | pouco natural: Подлежащее «saiu» после «o conselho» читалось двусмысленно — названо Nuno; «por isso» отделено точкой с запятой; «terreno» вместо повтора «campo de batalha»; «cavaleiros franceses» точнее. | O conselho de guerra não chegou a acordo sobre onde combater; por isso, a 6 de agosto, Nuno saiu do acampamento com uns 2000 homens e escolheu sozinho o terreno. Segundo Froissart, mandou abrir valas e covas de lobo num planalto estreito. A 14, à hora das vésperas, os cavaleiros franceses que atacaram primeiro caíram lá dentro. | média | — | не применено: показать носителю |
| src/content/events/aljubarrota-1385.yaml | more | deu a maior parte da fortuna aos seus veteranos | pouco natural: Притяжательное «aos seus» лишнее; «repartir pelos» естественнее для раздачи многим. | repartiu a maior parte da fortuna pelos veteranos | média | — | не применено: показать носителю |
| src/content/events/aljubarrota-1385.yaml | more | Foi canonizado em 2009. | pouco natural: После фраз про монастырь и числа армий подлежащее терялось; названо. | Nuno foi canonizado em 2009. | alta | — | применено |
| src/content/events/bojador-1434.yaml | story | Sara Ocidental | inconsistente: Единое написание с place.name («Saara Ocidental»); pt-PT: Saara. | Saara Ocidental | alta | — | применено |
| src/content/events/bojador-1434.yaml | more | O cabo verdadeiro não era tão terrível. | pouco natural: «verdadeiro» в значении «реальный» — калька. | Na realidade, o cabo não era assim tão terrível. | média | — | не применено: показать носителю |
| src/content/events/cantino-1502.yaml | story | o que deu nome à América | decalque: «o que» после запятой — калька, неясная отсылка; «aquele que» относится к карте. | aquele que batizou a América | média | — | применено |
| src/content/events/cantino-1502.yaml | more | é a mais antiga carta que se conserva a colocar partes de África, do Brasil e da Índia por latitude | pouco natural: Тяжёлая конструкция «colocar... por latitude» упрощена. | é a carta mais antiga conservada que situa partes de África, do Brasil e da Índia pela latitude | média | — | не применено: показать носителю |
| src/content/events/cantino-1502.yaml | more | e o próprio mapa de Cantino envelheceu depressa: os mapas de Caverio e de Waldseemüller depressa o ultrapassaram | pouco natural: Повтор «depressa» в одной фразе. | e o próprio mapa de Cantino envelheceu depressa: os de Caverio e de Waldseemüller não tardaram a ultrapassá-lo | alta | — | применено |
| src/content/events/casa-da-neve-1782.yaml | story | «neves» com sabores | decalque: «com sabores» — калька; «de vários sabores». | «neves» de vários sabores | média | — | применено |
| src/content/events/casa-da-neve-1782.yaml | more | chegou a andar à rixa com outro café histórico, o Marrare, que também reclamava uma parte do gelo que chegava a Lisboa | pouco natural: «andar à rixa» — разговорно и неточно для спора из-за льда; убран повтор «gelo». | chegou a disputar o gelo com outro café histórico, o Marrare, que também queria uma parte do que chegava a Lisboa | média | — | не применено: показать носителю |
| src/content/events/corte-brasil-1807.yaml | story | Partiram com eles, segundo diferentes estimativas, entre 10 e 15 mil pessoas. | pouco natural: Неясное «eles» и порядок слов; названа corte. | Seguiram com a corte, segundo as estimativas, entre 10 e 15 mil pessoas. | alta | — | применено |
| src/content/events/corte-brasil-1807.yaml | story | Faltava vento, e a frota ficou no rio até 29 de novembro. | pouco natural: «Faltava vento» — калька; естественнее «sem vento». | Sem vento, a frota ficou retida no rio até 29 de novembro. | média | — | не применено: показать носителю |
| src/content/events/corte-brasil-1807.yaml | more | reunida de novo depois do incêndio de 1755 | pouco natural: «reunida de novo» неточно для коллекции; «reconstituída». | reconstituída depois do incêndio de 1755 | média | — | не применено: показать носителю |
| src/content/events/corte-brasil-1807.yaml | more | estão na base da Biblioteca Nacional do Brasil | decalque: «na base de» — калька; по-португальски «na origem de». | estão na origem da Biblioteca Nacional do Brasil | alta | — | применено |
| src/content/events/douro-1756.yaml | story | vendida por comerciantes britânicos no Porto | pouco natural: Двусмысленность «no Porto» (место продажи или проживания); уточнено. | vendida por comerciantes britânicos estabelecidos no Porto | baixa | словарём не проверено, не применяется | не применено: показать носителю |
| src/content/events/douro-1756.yaml | more | Os marcos tinham gravado «Feitoria» e um ano, os primeiros de 1758, e cerca de cem | pouco natural: Активное «tinham gravado» с неодушевлённым подлежащим — калька. | Nos marcos estavam gravados «Feitoria» e um ano (nos primeiros, 1758), e cerca de cem | alta | — | применено |
| src/content/events/douro-1756.yaml | more | essa história tem cartão próprio | decalque: «cartão» — внутренний термин сайта, читателю непонятен. | essa história conta-se à parte | alta | — | применено |
| src/content/events/elefantes-malaca-1511.yaml | story | esmagaram os seus | pouco natural: «os seus» без существительного двусмысленно. | pisaram os próprios soldados | média | — | не применено: показать носителю |
| src/content/events/elefantes-malaca-1511.yaml | more | A Albuquerque dão-se entre 1000 e 1200 homens | pouco natural: Безличная книжная конструкция звучит как перевод. | Albuquerque contava entre 1000 e 1200 homens | alta | — | применено |
| src/content/events/guerra-laranjas-1801.yaml | story | e a guerra ficou a ser a Guerra das Laranjas | pouco natural: «ficou a ser» тяжеловесно; «ficou conhecida como». | e a guerra ficou conhecida como Guerra das Laranjas | média | — | не применено: показать носителю |
| src/content/events/guerra-laranjas-1801.yaml | more | Se deve voltar a Portugal continua em discussão. | pouco natural: Придаточное как подлежащее в начале — калька. | Continua em discussão se deve regressar a Portugal. | alta | — | применено |
| src/content/events/hanno-1514.yaml | story | O elefante chamava-se Hanno | pouco natural: Повтор «o elefante» в соседних предложениях. | Chamava-se Hanno | média | — | не применено: показать носителю |
| src/content/events/hanno-1514.yaml | more | O papa estava junto dele. | pouco natural: Слишком сухо; претерит естественнее. | O papa esteve a seu lado. | média | — | не применено: показать носителю |
| src/content/events/morcegos-mafra-1771.yaml | more | A biblioteca foi decorada pelo arquiteto Manuel Caetano de Sousa (1742–1802), já na segunda metade do século. | pouco natural: Годы жизни в скобках путались с датой работы; порядок изменён. | A biblioteca foi decorada já na segunda metade do século, pelo arquiteto Manuel Caetano de Sousa (1742–1802). | alta | — | применено |
| src/content/events/morcegos-mafra-1771.yaml | more | Lá, à noite, cobrem as mesas com couro | pouco natural: Безличное «cobrem» без субъекта неуклюже. | Lá, à noite, as mesas são cobertas com couro | baixa | словарём не проверено, не применяется | не применено: показать носителю |
| src/content/events/morcegos-mafra-1771.yaml | more | A etiqueta «discutível» está aqui | inconsistente: На сайте метка называется «Em debate». | A etiqueta «Em debate» está aqui | alta | — | применено |
| src/content/events/morcegos-mafra-1771.yaml | more | e quanto ajudam os livros, ninguém mediu | pouco natural: «quanto ajudam os livros» — калька. | e até que ponto ajudam a proteger os livros, ninguém mediu | média | — | не применено: показать носителю |
| src/content/events/motim-companhia-1757.yaml | story | Na quarta-feira de cinzas | erro: Церковный праздник пишется с заглавных букв. | Na Quarta-feira de Cinzas | alta | — | применено |
| src/content/events/motim-companhia-1757.yaml | more | Seguiram-se tropas e lei marcial. | pouco natural: Войска не «следуют»: буквальный перевод. | Seguiu-se a repressão, com tropas e lei marcial. | alta | — | применено |
| src/content/events/motim-companhia-1757.yaml | more | A Companhia sobreviveu muito a Pombal | decalque: «sobreviver muito a» — калька. | A Companhia durou muito para além de Pombal | média | — | применено |
| src/content/events/motim-companhia-1757.yaml | more | Como tudo começou, e os marcos que lhe delimitaram a região, contam-se noutro cartão. | decalque: Внутренний термин «cartão»; громоздкий период с неясным «lhe». | A origem da Companhia e os marcos que delimitaram a região contam-se noutra história. | alta | — | применено |
| src/content/events/motim-companhia-1757.yaml | detail_image.alt | O Marquês de Pombal | inconsistente: Единое написание «marquês» со строчной. | O marquês de Pombal | alta | — | применено |
| src/content/events/ponte-das-barcas-1809.yaml | more | diz-se missa pelas vítimas | pouco natural: «celebrar missa» — нормативное сочетание. | celebra-se missa pelas vítimas | média | — | не применено: показать носителю |
| src/content/events/ponte-das-barcas-1809.yaml | story | os moradores fugiram | pouco natural: «moradores» для жителей города звучит как перевод. | os habitantes fugiram | média | — | не применено: показать носителю |
| src/content/events/rinoceronte-1515.yaml | more | ao Papa Leão X um elefante, Hanão | inconsistente: Единое имя слона Hanno и «papa» со строчной (как в карточке про слона). | ao papa Leão X um elefante, Hanno | alta | — | применено |
| src/content/events/rinoceronte-1515.yaml | more | seguiu para o Papa | inconsistente: «papa» со строчной, как в остальных текстах. | seguiu para o papa | alta | — | применено |
| src/content/events/rinoceronte-1515.yaml | more | Não se conhece nenhum rinoceronte empalhado que exista hoje. | pouco natural: «que exista hoje» — избыточно и книжно. | Não se conhece nenhum rinoceronte empalhado dessa época que tenha chegado aos nossos dias. | média | — | не применено: показать носителю |
| src/content/events/rinoceronte-1515.yaml | story | Trouxeram um elefante novo perante a multidão. | pouco natural: «novo» вместо «jovem», «perante» — калька. | Trouxeram um elefante jovem, diante da multidão. | média | — | не применено: показать носителю |
| src/content/events/ruas-oficios-1760.yaml | more | as lojas que sobrassem ficavam para os relojoeiros | pouco natural: Разговорно-кальковый оборот «ficavam para». | as lojas que sobrassem destinavam-se aos relojoeiros | média | — | не применено: показать носителю |
| src/content/events/terramoto-1755.yaml | more | O historiador de economia | decalque: «historiador de economia» — калька. | O historiador económico | média | — | применено |
| src/content/events/terramoto-1755.yaml | more | Também as alturas das ondas são discutidas | pouco natural: Множественное «alturas» и пассив неестественны. | Discute-se também a altura das ondas | média | — | не применено: показать носителю |
| src/content/events/terramoto-1755.yaml | story | ficou com medo de paredes | pouco natural: Состояние, ставшее постоянным: «passou a ter». | passou a ter medo de paredes | média | — | не применено: показать носителю |
| src/content/events/torres-vedras-1810.yaml | story | por uma terra sem comida, que os próprios camponeses tinham destruído | pouco natural: «terra» размыто; «região», и ясно, что уничтожена еда. | por uma região onde os próprios camponeses tinham destruído a comida | média | — | не применено: показать носителю |
| src/content/events/tripeiros-1415.yaml | more | tripas à moda do Porto, tripas guisadas com feijão, enchidos e carnes de porco, frango e vitela | pouco natural: Повтор «tripas» и неудачное обобщение «carnes de porco, frango e vitela». | as tripas à moda do Porto, guisadas com feijão, enchidos, carne de porco, frango e vitela | média | — | не применено: показать носителю |
| src/content/epochs.yaml | theme | Descobertas: o mundo no mapa | inconsistente: В названии эпохи «Descobrimentos»; унификация (Descobertas тоже допустимо). | Descobrimentos: o mundo no mapa | baixa | словарём не проверено, не применяется | не применено: показать носителю |
| src/content/epochs.yaml | intro | Mil anos mais tarde, dele nasceria o português. | pouco natural: «dele» неясно (Roma? latim?) и ритм тяжёлый. | Do latim nasceria, mil anos depois, o português. | alta | — | применено |
| src/content/epochs.yaml | intro | As fronteiras traçadas então quase não mudaram até hoje. | pouco natural: «traçadas então» — калька. | As fronteiras de então quase não mudaram até hoje. | média | — | не применено: показать носителю |
| src/data/static-pages.ts | sections[quem-faz].heading | Quem faz | pouco natural: Заголовок обрывочный, не хватает объекта. | Quem faz o site | média | — | не применено: показать носителю |
| src/data/static-pages.ts | sections[para-quem].items[2] | escolhe a idade | inconsistente: Единый регистр обращения (você/imperativo). | escolha a idade | alta | — | применено |
| src/data/static-pages.ts | sections[ajudar].items[1] | que falta aqui | decalque: «que falta aqui» — калька. | que ainda não está aqui | média | — | применено |
| src/data/static-pages.ts | sections[idades].paragraphs[0] | escolhe a idade | inconsistente: Единый регистр обращения. | escolha a idade | alta | — | применено |
| src/data/static-pages.ts | sections[idades].paragraphs[0] | e morte aviso e pergunto | erro: Нужна запятая после обстоятельства. | e morte, aviso e pergunto | alta | — | применено |
| src/data/static-pages.ts | sections[datas-fontes].paragraphs[0] | Antes de mais, de documentos da época | pouco natural: Нет глагола; читается как калька. | Vêm, antes de mais, de documentos da época | alta | — | применено |
| src/data/static-pages.ts | sections[privacidade].paragraphs[0] | pede autorização para a localização | pouco natural: Нужен глагол. | pede autorização para aceder à localização | alta | — | применено |
| src/data/static-pages.ts | sections[contacto].paragraphs[0] | Questões sobre | decalque: «Questões» в значении «вопросы» — калька. | Dúvidas sobre | média | — | применено |
| src/data/static-pages.ts | sections[terceiros].heading | Quem mais participa quando lê o site | pouco natural: Заголовок звучит как калька; «intervém» естественнее. | Quem mais intervém quando lê o site | baixa | не проверено по словарю | не применено: показать носителю |
| src/i18n/pt.json | site.description | Pequenas histórias interativas da história de Portugal | pouco natural: Повтор «histórias... história». | Pequenas histórias interativas do passado de Portugal | alta | — | применено |
| src/i18n/pt.json | card.not_translated | É mostrado o texto em inglês. | pouco natural: Канцелярский пассив. | Mostra-se o texto em inglês. | média | — | не применено: показать носителю |
| src/i18n/pt.json | map.legend_here | você | brasileirismo: pt-PT избегает «você» (автоматический стоп-лист); подпись легенды. | a sua posição | alta | — | применено |
| src/i18n/pt.json | map.geo_unsupported | Este navegador não sabe indicar a localização. | decalque: Одушевление браузера («não sabe») — калька. | Este navegador não permite obter a localização. | média | — | применено |
| src/i18n/pt.json | map.world | O mundo todo | pouco natural: Параллельно с «Portugal inteiro»; в pt-PT «inteiro». | O mundo inteiro | média | — | не применено: показать носителю |
| src/i18n/pt.json | ui.view_grid | Cartões | decalque: Калька с «cards»; для вида сеткой — «Grelha». | Grelha | baixa | Priberam: «grelha», знач. 4 — «quadro que representa um conjunto de factos»; как название вида «сеткой» не подтверждено | не применено: показать носителю |
| src/i18n/pt.json | family.button_all | Idade: até 12 | inconsistente: Согласовано с «Menos de 12 anos». | Idade: menos de 12 | alta | — | применено |
| src/i18n/pt.json | family.status_all | Idade: até 12. | inconsistente: Согласовано с family.opt_all. | Idade: menos de 12. | alta | — | применено |
| src/i18n/pt.json | gate.age_12 | Esta história é para adolescentes 12+. | pouco natural: «12+» после существительного; «adolescentes» неточно; параллель с gate.age_16. | Esta história é para leitores a partir dos 12 anos. | média | — | не применено: показать носителю |
| src/i18n/pt.json | report.sent_text | escrevo-lhe quando tiver analisado | pouco natural: «analisado» без объекта. | escrevo-lhe depois de analisar o caso | média | — | не применено: показать носителю |

## Срабатывания стоп-листов (проход 2)

Механическая правка скриптом или в таблице выше. Всего 1.

- 1 × pt-PT omite «você»: «Encontrou um erro?»

## Расхождения между языками (проход 3)

Критичных расхождений (факты, даты, числа, имена, метки): **0**. Мелкие, касающиеся этого языка, указаны ниже; общий список — в сводном отчёте.

- `event/aljubarrota-1385` [detail_image.caption]: pt: f. 204r; en: f. 204r; ru: л. 204 (without r)
- `event/aljubarrota-1385` [image.caption / story]: pt: Nuno Álvares Pereira; en: Nuno Álvares Pereira; ru: Нуну Алвариш (story) vs Нуну Алвареш (caption): inconsistent spelling within ru
- `event/bojador-1434` [story]: pt: Infante sent ship after ship (no time span in story); en: same as pt; ru: adds 'годами' (for years) and the clause 'Людей на берегу не было' (there were no people on the shore) which is not in pt/en
- `event/cantino-1502` [bridge.title]: pt: Museu de Marinha (cópia do mapa de Cantino); en: Maritime Museum; ru: Морской музей
- `event/cantino-1502` [more]: pt: talho (butcher's), colado num biombo; en: pork butcher's shop, pasted on a screen; ru: в мясной лавке, наклеенной на ширму: grammar attaches 'наклеенной' to the shop instead of the map; 'pork' lost
- `event/casa-da-neve-1782` [story]: pt: Casa da Neve; en: Casa da Neve; ru: Каза-да-Нев (title says 'Дом снега', name transliterated in text); cafe name 'Мартиньо да Аркада' (bridge) vs 'Martinho da Arcada' (Latin, detail image)
- `event/elefantes-malaca-1511` [story]: pt: sultan 'abandonou a montada'; en: left his mount; ru: покинул спину слона (specifies elephant; pt/en 'mount' neutral)
- `event/elefantes-malaca-1511` [bridge.title]: pt: Monumento a Afonso de Albuquerque (Praça Afonso de Albuquerque, Belém); en: Monument to Afonso de Albuquerque; ru: Памятник Афонсу де Албукерки
- `event/guerra-laranjas-1801` [hook]: pt: ramo de laranjeira (orange-tree branch); en: a sprig of oranges; ru: апельсиновая ветка
- `event/guerra-laranjas-1801` [story/more]: pt: Elvas; en: Elvas; ru: Эльваш (place.name, bridge) vs Элваш (story): inconsistent transliteration
- `event/hanno-1514` [story / event/rinoceronte more]: pt: Hanno (this card) vs Hanão (rinoceronte card); en: Hanno; ru: Ганнон (this card) vs Ханно (rinoceronte card)
- `event/ponte-das-barcas-1809` [bridge.title / bridge.note]: pt: Alminhas da Ponte (shrine/memorial); en: Alminhas da Ponte shrine; ru: Часовня Алминьяш-да-Понте (chapel), while 'more' calls it 'мемориал'
- `event/ponte-das-barcas-1809` [story]: pt: Gaia; en: Gaia; ru: Гаи (in story) vs Гайа/Гайе (elsewhere): inconsistent transliteration
- `event/rinoceronte-1515` [more]: pt: Dürer baseou-se no esboço e na descrição de um mercador; en: a sketch and a description from Lisbon (merchant omitted); ru: по наброску и описанию купца
- `event/rinoceronte-1515` [more]: pt: Hanão; en: Hanno; ru: Ханно (differs from Ганнон on the Hanno card)
- `event/rinoceronte-1515` [bridge.title / story]: pt: Torre de Belém; en: Belém Tower; ru: Беленская башня (bridge) vs Белемская башня (more): inconsistent
- `event/torres-vedras-1810` [bridge.title]: pt: Centro de Interpretação das Linhas de Torres Vedras (Forte de São Vicente); en: Lines of Torres Vedras Interpretation Centre (São Vicente Fort); ru: Форт Сан-Висенте (interpretation centre dropped from title)
- `event/tripeiros-1415` [story]: pt: infante D. Henrique; en: Prince Henry; ru: Инфант Энрике (Генрих Мореплаватель): gloss added in parentheses, absent in pt/en

## Крючки

Вариант-победитель выбран слепым сравнением (новый читатель, варианты в случайном порядке без пометок). Где победило «было», правки нет.

| история | было | победитель | почему | другие варианты |
|---|---|---|---|---|
| aljubarrota-1385 | Aos 25 anos, deixou o conselho e escolheu o campo de batalha. | Os generais discutiam. Um jovem de 25 anos foi escolher o campo. | Контраст и интрига, звучит как журнальный зачин. | Aos 25 anos, Nuno Álvares Pereira escolheu sozinho onde Portugal ia lutar. |
| bojador-1434 | Doze anos a temer um cabo. Gil Eanes trouxe de lá flores. | Ninguém passava o Bojador. Gil Eanes voltou com uma planta como prova. | Короткие фразы, ясный образ и доказательство. | Do cabo de onde ninguém voltava, Gil Eanes trouxe uma planta. |
| cantino-1502 | Veio negociar cavalos. Levou o mundo. | (осталось как было) | Лаконично и эффектно. | Veio por cavalos, dizia. Levou o mapa do mundo por 12 ducados. / Um espião em Lisboa comprou o mapa do mundo por 12 ducados. |
| casa-da-neve-1782 | O café mais antigo de Lisboa foi aberto pelo neveiro do rei. | (осталось как было) | Неожиданный факт, естественная конструкция. | O neveiro do rei vendia gelo em Lisboa. Hoje é um café. / Em Lisboa, o gelo era um luxo, vendido sob as arcadas. |
| corte-brasil-1807 | A corte partiu para o Brasil e a biblioteca ficou no cais. | Uma corte inteira embarcou em dois dias. Os livros ficaram no cais. | Яркая деталь с книгами на причале. | Napoleão chegava. A corte fugiu para o Brasil, esqueceu os livros. |
| douro-1756 | Para salvar o vinho do Porto, Pombal mandou arrancar os sabugueiros. | (осталось как было) | Самая естественная и плавная фраза. | Pombal arrancou os sabugueiros para salvar o vinho do Porto. / Em crise, o vinho do Porto ganhou 335 marcos de granito. |
| elefantes-malaca-1511 | O sultão lançou elefantes de guerra. Viraram-se contra os seus. | (осталось как было) | Динамично и ясно. | Em Malaca, os elefantes do sultão recuaram e pisaram o próprio exército. / Um elefante ferido deu meia-volta e semeou o pânico entre os seus. |
| guerra-laranjas-1801 | A guerra batizada por um ramo de laranjeira enviado à rainha. | Um ramo de laranjas deu nome a uma guerra de dezoito dias. | Естественнее и интереснее, чем неполная фраза B. | Diz-se que Godoy, sem tomar Elvas, enviou laranjas à rainha. |
| hanno-1514 | Ofereceram um elefante ao papa, e o elefante ajoelhou-se diante dele. | Hanno, o elefante de D. Manuel, ajoelhou-se diante do papa Leão X. | Конкретные имена, живо. | Um elefante branco da Índia ajoelhou-se diante do papa, em Roma. |
| legiao-portuguesa-1812 | Depois da Rússia, restavam uns cem homens da Legião de Napoleão. | Nove mil portugueses marcharam com Napoleão. Restavam uns cem. | Сильный контраст чисел. | Dissolveram o exército português e levaram-no até Borodino. |
| morcegos-mafra-1771 | Em Mafra, os livros antigos são guardados à noite por morcegos. | (осталось как было) | Образно и читается легко. | Quando o palácio de Mafra fecha, os morcegos tomam conta dos livros. / Cerca de 36 mil livros, em Mafra, vigiados à noite por morcegos. |
| motim-companhia-1757 | O Porto revoltou-se contra o ministro do rei, a gritar «Viva el-Rei!» | (осталось как было) | Парадокс, хороший зачин. | Em 1757, o Porto gritou pelo rei e atacou a Companhia. / Os taberneiros viam um monopólio. Pombal respondeu com tropas e execuções. |
| ponte-das-barcas-1809 | Milhares fugiram por uma ponte de barcos. A ponte cedeu. | (осталось как было) | Ясно и драматично. | Fugiam dos franceses pela ponte de barcas do Porto. Ela não aguentou. / Uma ponte feita de barcos, uma multidão em pânico, e o rio. |
| rinoceronte-1515 | O rei pôs um rinoceronte contra um elefante. O elefante fugiu. | (осталось как было) | Образная сцена, естественный ритм. | Em Lisboa, em 1515, um elefante fugiu de um rinoceronte. / D. Manuel queria ver uma luta. O elefante não esperou. |
| ruas-oficios-1760 | Depois do terramoto, as ruas da Baixa foram repartidas pelos ofícios. | (осталось как было) | Ясно и естественно. | Ourives numa rua, correeiros noutra: Lisboa reconstruída por ofícios. / Algumas ruas da nova Baixa receberam um ofício por decreto. |
| terramoto-1755 | O rei saiu de Lisboa nessa manhã porque uma filha quis. | Na manhã do terramoto, o rei já tinha saído de Lisboa. | Прямо, с интригой. | Por vontade de uma das filhas, o rei estava fora de Lisboa. |
| torres-vedras-1810 | Um ano a construir fortes que os franceses mal sabiam que existiam. | Masséna avançou sobre Lisboa e deu com fortes que não esperava. | Естественная повествовательная фраза. | Wellington construiu em segredo as linhas que fizeram Masséna recuar. |
| tripeiros-1415 | O Porto deu a carne, ficou com as tripas, ganhou alcunha. | Diz a lenda: o Porto ficou com as tripas e uma alcunha. | Легенда плюс прозвище, звучит по-журнальному. | O Porto deu a carne às naus e ficou com as tripas. |

## Описания для поиска (meta description)

| где | было | победитель | почему |
|---|---|---|---|
| event/aljubarrota-1385 [story] | Em 1385, Nuno Álvares Pereira tinha 25 anos e era condestável de Portugal. | Aos 25 anos, o condestável Nuno Álvares Pereira tinha de decidir como travar a batalha de Aljubarrota, em 1385. | Есть дилемма и контекст. |
| event/bojador-1434 [story] | O cabo Bojador, na costa do Sara Ocidental, era tido como um lugar de onde não se voltava. | Durante anos, o cabo Bojador, na costa do Saara Ocidental, foi tido como um lugar de onde ninguém voltava. | Плавно, без неточностей. |
| event/cantino-1502 [story] | Em 1501, Alberto Cantino chegou a Lisboa a dizer que vinha tratar de cavalos. | Em 1501, Alberto Cantino chegou a Lisboa dizendo que vinha comprar cavalos. | Просто и естественно. |
| event/casa-da-neve-1782 [story] | Na segunda metade do século XVIII, sob as arcadas da atual Praça do Comércio, Lisboa ganhou uma loja que vendia um luxo: gelo (as fontes dizem 1778 ou 1782). | Sob as arcadas da atual Praça do Comércio, em Lisboa, abriu no século XVIII uma loja que vendia um luxo: gelo. | Чисто и без перегруза. |
| event/corte-brasil-1807 [story] | Em novembro de 1807, o exército de Napoleão marchava sobre Lisboa. | Em novembro de 1807, as tropas de Napoleão avançavam sobre Lisboa e a corte portuguesa decidiu partir. | Полная мысль, естественно. |
| event/douro-1756 [story] | Nos anos 1750, o comércio do vinho do Porto estava em crise: vinho a mais, falsificações a mais, e a maior parte vendida por comerciantes britânicos no Porto. | Nos anos 1750, o comércio do vinho do Porto estava em crise: excesso de vinho, falsificações e um negócio dominado por comerciantes britânicos. | Сжато и гладко. |
| event/elefantes-malaca-1511 [story] | «Quem for senhor de Malaca tem a mão na garganta de Veneza», escreveu o boticário Tomé Pires, porque Malaca controlava a rota das especiarias. | Quem fosse senhor de Malaca, escreveu Tomé Pires, tinha a mão na garganta de Veneza: Malaca controlava a rota das especiarias. | Цитата в косвенной речи, плавно. |
| event/guerra-laranjas-1801 [story] | Em maio de 1801, a Espanha, empurrada pela França de Napoleão, invadiu Portugal. | Em maio de 1801, a Espanha, pressionada por Napoleão, invadiu Portugal numa guerra que durou menos de três semanas. | Информативно, с длительностью войны. |
| event/hanno-1514 [story] | Em 1514, D. | Em 1514, D. Manuel I mandou uma embaixada a Roma, com presentes para o novo papa, Leão X. | Полная естественная фраза (A оборвана). |
| event/legiao-portuguesa-1812 [story] | Em 1808, os ocupantes franceses dissolveram o exército português e formaram uma legião com as suas unidades. | Em 1808, ocupado o país, os franceses dissolveram o exército português e criaram uma legião com as suas unidades. | Лучший порядок слов. |
| event/morcegos-mafra-1771 [story] | No Palácio-Convento de Mafra, a noroeste de Lisboa, há uma biblioteca enorme: cerca de 36 mil volumes em estantes de madeira até ao teto. | A biblioteca do Palácio de Mafra, a noroeste de Lisboa, tem cerca de 36 mil volumes em estantes de madeira até ao teto. | Точно и кратко. |
| event/motim-companhia-1757 [story] | Na quarta-feira de cinzas, 23 de fevereiro de 1757, a multidão encheu as ruas do Porto a gritar pelo rei e contra a nova Companhia do vinho. | A 23 de fevereiro de 1757, Quarta-feira de Cinzas, o Porto saiu à rua a gritar pelo rei e contra a nova Companhia do vinho. | Живо: «saiu à rua». |
| event/ponte-das-barcas-1809 [story] | Em março de 1809, as tropas francesas do marechal Soult tomaram o Porto. | (осталось как было) | Ясно и нейтрально. |
| event/rinoceronte-1515 [story] | Em maio de 1515 chegou a Lisboa um rinoceronte vindo da Índia, o primeiro vivo que a Europa via desde os romanos. | (осталось как было) | Плавная фраза. |
| event/ruas-oficios-1760 [story] | Depois de 1755, a Baixa de Lisboa foi reconstruída a régua e esquadro: ruas direitas, prédios iguais. | Depois do terramoto de 1755, a Baixa de Lisboa foi reconstruída a régua e esquadro, com ruas direitas e prédios iguais. | Полная и естественная. |
| event/terramoto-1755 [story] | A 1 de novembro de 1755, Dia de Todos os Santos, D. | A 1 de novembro de 1755, Dia de Todos os Santos, D. José I ouviu missa de manhã e deixou Lisboa porque uma das filhas queria passar o feriado fora. | Единственная полная и информативная. |
| event/torres-vedras-1810 [story] | Em outubro de 1809, Wellington mandou fortificar as colinas a norte de Lisboa. | (осталось как было) | Простое и естественное. |
| event/tripeiros-1415 [story] | Diz a lenda que, em 1415, os estaleiros do Porto construíam em segredo uma armada para Ceuta. | (осталось как было) | «Diz a lenda» звучит естественно. |
| epoch/avis-e-descobrimentos [description] | Uma nova dinastia salvou o país em Aljubarrota e virou-se para o mar: em século e meio, Portugal chegou a África, à Índia, ao Brasil e ao Japão. | (осталось как было) | Богаче по смыслу, хороший ритм. |
| epoch/pombal-e-terramoto [description] | Em 1755, um terramoto, um tsunami e um incêndio destruíram Lisboa. Pombal reconstruiu a cidade; meio século depois, a corte partiu para o Brasil. | Em 1755, um terramoto, um tsunami e um incêndio arrasaram Lisboa. Pombal reconstruiu-a e, meio século depois, a corte partiu para o Brasil. | Лучшая лексика: arrasaram, reconstruiu-a. |
| ui/pages [pages.about.description] | Quem faz O Elefante Fugiu, porquê e para quem: histórias curtas do passado de Portugal, cada uma ligada a um lugar que se pode visitar. | O Elefante Fugiu reúne histórias curtas do passado de Portugal, cada uma ligada a um lugar que se pode visitar. Conheça o projeto e quem o faz. | Приглашающий тон, ясное описание. |
| ui/pages [pages.method.description] | Como separo o que está provado da lenda: três etiquetas, fontes em cada história, datas e números, imagens e erros. | (осталось как было) | Естественнее: «separo o que está provado da lenda». |
| ui/pages [pages.report.description] | Encontrou uma data, um nome ou um lugar errado numa história? Diga-me e eu verifico. | Há uma data, um nome ou um lugar errado numa história? Escreva-me: verifico e corrijo. | Естественный призыв «Escreva-me». |
| ui/pages [pages.legal.description] | Licenças (CC BY-SA, MIT), o que o site guarda no seu navegador, contagem de visitas sem cookies e os serviços que veem o seu IP. | Licenças dos textos e do código, o que o site guarda no seu navegador, a contagem de visitas sem cookies e os serviços que veem o seu IP. | Более плавно, без скобок. |
| ui/pages [pages.map.description] | Todas as histórias no mapa de Portugal: filtre por época e por fio, abra uma história e veja como chegar ao lugar onde aconteceu. | Todas as histórias no mapa de Portugal: filtre por época ou por fio, abra uma história e veja como chegar ao sítio onde aconteceu. | «sítio» звучит по-португальски разговорно, «ou» точнее. |
| ui/pages [pages.surprise.description] | Uma história ao acaso do passado de Portugal, escolhida para si em poucos segundos. | Não sabe por onde começar? Uma história do passado de Portugal, escolhida ao acaso para si. | Вопрос вовлекает читателя. |

## Что лучше показать живому носителю

- `event/aljubarrota-1385` [story]: «O conselho de guerra não chegou a acordo sobre onde combater, por isso, a 6 de agosto, saiu do acampamento com uns 2000 homens e escolheu sozinho o campo de batalha. Segundo Froissart, mandou abrir valas e covas de lobo num planalto estreito. A 14, à hora das vésperas, os franceses que atacaram primeiro caíram lá dentro.» → «O conselho de guerra não chegou a acordo sobre onde combater; por isso, a 6 de agosto, Nuno saiu do acampamento com uns 2000 homens e escolheu sozinho o terreno. Segundo Froissart, mandou abrir valas e covas de lobo num planalto estreito. A 14, à hora das vésperas, os cavaleiros franceses que atacaram primeiro caíram lá dentro.» (Подлежащее «saiu» после «o conselho» читалось двусмысленно — названо Nuno; «por isso» отделено точкой с запятой; «terreno» вместо повтора «campo de batalha»; «cavaleiros franceses» точнее.)
- `event/aljubarrota-1385` [more]: «deu a maior parte da fortuna aos seus veteranos» → «repartiu a maior parte da fortuna pelos veteranos» (Притяжательное «aos seus» лишнее; «repartir pelos» естественнее для раздачи многим.)
- `event/bojador-1434` [more]: «O cabo verdadeiro não era tão terrível.» → «Na realidade, o cabo não era assim tão terrível.» («verdadeiro» в значении «реальный» — калька.)
- `event/cantino-1502` [more]: «é a mais antiga carta que se conserva a colocar partes de África, do Brasil e da Índia por latitude» → «é a carta mais antiga conservada que situa partes de África, do Brasil e da Índia pela latitude» (Тяжёлая конструкция «colocar... por latitude» упрощена.)
- `event/casa-da-neve-1782` [more]: «chegou a andar à rixa com outro café histórico, o Marrare, que também reclamava uma parte do gelo que chegava a Lisboa» → «chegou a disputar o gelo com outro café histórico, o Marrare, que também queria uma parte do que chegava a Lisboa» («andar à rixa» — разговорно и неточно для спора из-за льда; убран повтор «gelo».)
- `event/corte-brasil-1807` [story]: «Faltava vento, e a frota ficou no rio até 29 de novembro.» → «Sem vento, a frota ficou retida no rio até 29 de novembro.» («Faltava vento» — калька; естественнее «sem vento».)
- `event/corte-brasil-1807` [more]: «reunida de novo depois do incêndio de 1755» → «reconstituída depois do incêndio de 1755» («reunida de novo» неточно для коллекции; «reconstituída».)
- `event/douro-1756` [story]: «vendida por comerciantes britânicos no Porto» → «vendida por comerciantes britânicos estabelecidos no Porto» (Двусмысленность «no Porto» (место продажи или проживания); уточнено.)
- `event/elefantes-malaca-1511` [story]: «esmagaram os seus» → «pisaram os próprios soldados» («os seus» без существительного двусмысленно.)
- `event/guerra-laranjas-1801` [story]: «e a guerra ficou a ser a Guerra das Laranjas» → «e a guerra ficou conhecida como Guerra das Laranjas» («ficou a ser» тяжеловесно; «ficou conhecida como».)
- `event/hanno-1514` [story]: «O elefante chamava-se Hanno» → «Chamava-se Hanno» (Повтор «o elefante» в соседних предложениях.)
- `event/hanno-1514` [more]: «O papa estava junto dele.» → «O papa esteve a seu lado.» (Слишком сухо; претерит естественнее.)
- `event/morcegos-mafra-1771` [more]: «Lá, à noite, cobrem as mesas com couro» → «Lá, à noite, as mesas são cobertas com couro» (Безличное «cobrem» без субъекта неуклюже.)
- `event/morcegos-mafra-1771` [more]: «e quanto ajudam os livros, ninguém mediu» → «e até que ponto ajudam a proteger os livros, ninguém mediu» («quanto ajudam os livros» — калька.)
