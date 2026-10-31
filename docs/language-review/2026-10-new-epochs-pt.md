# Вычитка новых текстов: Португальский (pt-PT, AO1990)

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

- Находок после слияния проходов 1, 3 и 2: **27** (высокая уверенность 5, средняя 8, низкая 14). В применение по правилам прошлой вычитки идут «высокая» (и ошибки), «средняя» и «низкая» ждут твоего решения.
- По категориям: неестественно — 10, метка/термин — 7, бразилизм — 3, калька — 2, типографика — 2, ошибка — 1, непоследовательно — 1, смысл (степень уверенности) — 1.
- Оценка «заметно ли, что перевод» (1 = нет, 5 = да), среднее по 31 разделам (27 историй и 4 эпохи): **до правок 1.94**; после правок оценку дам повторным слепым чтением применённого текста (до «ок» применять нечего).
- Крючки: слепое сравнение «было / вариант 1 / вариант 2»: заменить 17 из 26, оставить как было 9. Описания (первые предложения): заменить 21 из 26, оставить 5.
- check:ai-tells на этом языке: 25 предупреждений, оставить 16, править 9.

### Пять самых заметных мест

- `pasteis-de-belem-1837` [more]: «Nos conventos fazia-se doces» → «Nos conventos faziam-se doces». нет согласования: при множественном дополнении глагол во мн. числе (ошибка)
- `viriato-139-ac` [more]: «e em Viseu, onde se diz que ficava o seu acampamento, tem um monumento» → «e em Viseu, onde se diz que ficava o seu acampamento, há um monumento». смена подлежащего, «tem» вместо «há» (бразильский узус) (бразилизм)
- `capela-sao-joao-baptista` [bridge.note]: «A capela fica numa das capelas laterais da igreja, e a maqueta no Museu de São Roque, ao lado.» → «A capela é uma das capelas laterais da igreja, e a maqueta está no Museu de São Roque, ao lado.». В en «side altar» (боковой алтарь) вместо «side chapel» (pt capelas laterais, ru придел); в pt повтор «capela ... capelas» звучит тяжело. (метка/термин)
- `pasteis-de-belem-1837` [title]: «Os doces dos frades ou a melhor publicidade do século XIX» → «Os doces dos frades, ou talvez a melhor publicidade do século XIX». В pt заголовке нет оговорки «talvez» (en «Maybe», ru «а может быть», pt hook «ou talvez»): pt утверждает категорично то, что в остальных версиях гипотеза. (смысл (степень уверенности))
- `epoch/antes-de-portugal` [years_label]: «150 milhões de anos – séc. VI a.C.» → «há 150 milhões de anos – séc. VI a.C.». В pt и ru нет «назад/atrás» (en «ago»), без него запись читается как длительность; в ru длинное тире «—» вместо «–» в pt/en; в en «6th c.» сокращено, а в Epoch 29 «5th century» полностью. (метка/термин)

## Таблица находок

| история | поле | сейчас | проблема | предложение | уверенность | источник |
|---|---|---|---|---|---|---|
| ouro-sao-francisco-porto | story | o interior corta a respiração | калька: калька с английского (takes your breath away); в pt-PT «tira o fôlego» | o interior tira o fôlego | средняя | слепое чтение |
| pasteis-de-belem-1837 | more | Nos conventos fazia-se doces | ошибка: нет согласования: при множественном дополнении глагол во мн. числе | Nos conventos faziam-se doces | высокая | норма согласования «se» с подлежащим во мн. ч. («alugam-se casas»); статью Ciberdúvidas на эту фразу не нашёл |
| viriato-139-ac | more | e em Viseu, onde se diz que ficava o seu acampamento, tem um monumento | бразилизм: смена подлежащего, «tem» вместо «há» (бразильский узус) | e em Viseu, onde se diz que ficava o seu acampamento, há um monumento | высокая | слепое чтение |
| carros-de-cesto-monte | story | O transporte há muito virou atração | бразилизм: «virou» — бразильски/разговорно; в pt-PT «tornou-se» | O transporte tornou-se há muito uma atração | средняя | Priberam, «virar», знач. 19: «[Brasil] Tornar-se» (https://dicionario.priberam.org/virar) |
| capela-sao-joao-baptista | bridge.title | Capela de São João Baptista | типографика: написание вне AO1990 (Baptista), хотя это собственное имя | Capela de São João Batista | средняя | Priberam |
| garum-lisboa | more | como o sal e o molho de soja juntos para nós | неестественно: неполная конструкция, звучит как буквальный перевод | como são para nós o sal e o molho de soja juntos | средняя | слепое чтение |
| ouro-sao-francisco-porto | more | correram milhares de garimpeiros | бразилизм: «garimpeiro» — бразилизм | correram milhares de mineiros | низкая | Priberam, «garimpeiro» помечено [Brasil] (https://dicionario.priberam.org/garimpeiro) |
| cha-gorreana | more | E assim o círculo fechou-se | неестественно: калька; естественнее «fechou-se o círculo» | E assim se fechou o círculo | низкая | слепое чтение |
| elevador-santa-justa | hook | que não foi Eiffel que construiu | неестественно: тяжёлое двойное «que» | que não foi Eiffel quem construiu | низкая | слепое чтение |
| elevador-santa-justa | title | O elevador que não foi Eiffel que fez | неестественно: то же | O elevador que não foi Eiffel quem fez | низкая | слепое чтение |
| pasteis-de-belem-1837 | more | as pastelarias gostavam de vender | неестественно: «gostavam» неуместно; лучше «queriam» | as pastelarias queriam vender | низкая | слепое чтение |
| livraria-lello | title | J.K. Rowling | типографика: в pt-PT инициалы пишутся с пробелами | J. K. Rowling | низкая | слепое чтение |
| ponte-trajano-chaves | story | trocou de guardas | неестественно: двусмысленно (guardas = парапеты или стража), звучит буквально | mudou de guardas de pedra para grades | низкая | слепое чтение |
| ponte-trajano-chaves | image.caption | cerca de 104 | непоследовательно: непоследовательно с year_label «c. de 104» | c. de 104 | низкая | слепое чтение |
| batalha-da-salga-1581 | more | fugiram ao som do próprio trocadilho | неестественно: шутка искусственная, «ao som de» не к месту | fugiram com o próprio trocadilho nos ouvidos | низкая | слепое чтение |
| termas-vipasca | story | A vida dela foi regulada por lei em placas de bronze. | неестественно: слегка канцелярски | A vida da aldeia era regulada por uma lei gravada em placas de bronze. | низкая | слепое чтение |
| epoch/monarquia-e-republica | intro | dois irmãos príncipes | неестественно: нетипичный порядок слов | dois príncipes irmãos | низкая | слепое чтение |
| epoch/lusitania-e-roma | fallback_image.caption | a partir da época da Lusitânia e Roma | неестественно: громоздко | a partir do tema da época Lusitânia e Roma | низкая | слепое чтение |
| carros-de-cesto-monte | story | dão direção | калька: калька; естественнее «guiam» | guiam o carro | низкая | слепое чтение |
| capela-sao-joao-baptista | bridge.note | A capela fica numa das capelas laterais da igreja, e a maqueta no Museu de São Roque, ao lado. | метка/термин: В en «side altar» (боковой алтарь) вместо «side chapel» (pt capelas laterais, ru придел); в pt повтор «capela ... capelas» звучит тяжело. | A capela é uma das capelas laterais da igreja, e a maqueta está no Museu de São Roque, ao lado. | высокая | сверка трёх языков |
| pasteis-de-belem-1837 | title | Os doces dos frades ou a melhor publicidade do século XIX | смысл (степень уверенности): В pt заголовке нет оговорки «talvez» (en «Maybe», ru «а может быть», pt hook «ou talvez»): pt утверждает категорично то, что в остальных версиях гипотеза. | Os doces dos frades, ou talvez a melhor publicidade do século XIX | высокая | сверка трёх языков |
| a-portuguesa-1890 | title | O hino que nasceu contra Inglaterra | метка/термин: Разный референт: pt/ru «Inglaterra/Англия» против en «Britain»; в самих текстах pt «Grã-Bretanha», ru «Британия», т.е. в pt и ru заголовок расходится с телом. | O hino que nasceu contra a Grã-Bretanha (или оставить разговорное «Inglaterra» осознанно) | низкая | сверка трёх языков |
| epoch/antes-de-portugal | years_label | 150 milhões de anos – séc. VI a.C. | метка/термин: В pt и ru нет «назад/atrás» (en «ago»), без него запись читается как длительность; в ru длинное тире «—» вместо «–» в pt/en; в en «6th c.» сокращено, а в Epoch 29 «5th century» полностью. | há 150 milhões de anos – séc. VI a.C. | высокая | сверка трёх языков |
| thread/engenho | name | Engenho | метка/термин: Три названия не совпадают по смыслу: «engenho» = изобретательность/устройство, «Engineering» = инженерия, ru — «стройки и машины»; описание (мосты, акведуки, лифты, машины) ближе к «Engineering». | Engenharia | средняя | сверка трёх языков |
| ui/map | map.skip_to_markers |  | метка/термин: Смысл расходится: pt «Ir para o mapa» (к карте), en «Skip to map markers» и ru «К маркерам карты» (к маркерам). У skip-ссылки назначение — маркеры, а не вся карта. В ru нет глагола, регистр у ru и en разный. | Ir para os marcadores do mapa | средняя | сверка трёх языков |
| ui/ui | ui.label_debated |  | метка/термин: pt «Em debate» не совпадает с глоссарием pt «debatido» (при том что en Debated и ru «в обсуждении» совпадают). Метка в ru с заглавной, в глоссарии со строчной, это нормально для UI. Привести глоссарий и метку к одному виду. | Em debate (внести в глоссарий вместо «debatido») | средняя | сверка трёх языков |
| ui/home | home.timeline_prev / home.timeline_next |  | метка/термин: Пара «anteriores / seguintes» не симметрична в pt (seguintes = ближайшие следующие); en «Earlier/Later» и ru «Более ранние/Более поздние» симметричны. Термин «эпоха» = era соблюдён. | Épocas anteriores / Épocas posteriores | средняя | сверка трёх языков |
| capela-sao-joao-baptista | bridge.title | Capela de São João Baptista | проверено, оставить: «Baptista» вне AO1990, но так написано официальное название (Diário da República, decreto 7/2026: «Capela de São João Baptista») | оставить как есть (собственное название) | — | Diário da República, decreto 7/2026 (по поисковой выдаче); Museu de São Roque |

## Крючки и первые предложения (проход 4 и слепое сравнение, проход 5)

Крючки утверждал владелец, поэтому здесь только предложения; финальный выбор твой. Победитель определён новым субагентом вслепую (версии в случайном порядке); судья это модель, а не носитель, поэтому доверяй выбору с оглядкой и прочитай победителей вслух. Факты в вариантах писали агенты по тексту истории, я их ещё не сверял построчно: перед применением сверю каждый вариант с текстом и источниками. Если победило «было», правка не предлагается. «Повторяет название» значит, что крючок почти слово в слово повторяет заголовок.

| история | повторяет название | было | вариант 1 | вариант 2 | победитель слепого сравнения |
|---|---|---|---|---|---|
| a-portuguesa-1890 |  | A monarquia proibiu esta canção, e a República fez dela o hino. | Escrita numa só noite, após uma humilhação nacional, foi logo proibida. | Proibida pela monarquia, a marcha acabou por ser o hino da República. | было (правку не предлагаю) |
| batalha-da-salga-1581 |  | Na Terceira, um desembarque espanhol foi travado por uma manada de touros. | Centenas de touros desfizeram as fileiras espanholas na baía da Salga. | Os ilhéus recuavam, até frei Pedro propor lançar touros contra o inimigo. | вариант 2 |
| braguinha-ukulele-1879 |  | O ukulele havaiano chegou de barco da Madeira. | Entre os emigrantes da Madeira para o Havai iam três marceneiros. | Três marceneiros madeirenses levaram para Honolulu uma viola de quatro cordas. | вариант 2 |
| capela-sao-joao-baptista |  | O rei encomendou uma capela em Roma e trouxe-a às peças. | Mármore, lápis-lazúli e bronze dourado viajaram de Roma em três navios. | Benzida pelo papa em Roma, foi desmontada em 174 peças para Lisboa. | вариант 2 |
| carros-de-cesto-monte |  | Na Madeira desce-se a montanha em trenós de vime, sem neve. | Do Monte ao Funchal num cesto de vime que desliza pela calçada. | O travão deste carro são as botas de borracha de dois homens. | вариант 1 |
| catarina-cha-1662 |  | Uma princesa portuguesa levou para Inglaterra o chá e, no dote, Bombaim. | Dois milhões de cruzados, Tânger, Bombaim e o hábito de beber chá. | Em Inglaterra o chá era remédio raro; com ela, virou moda. | вариант 1 |
| cha-gorreana |  | O chá mais antigo da Europa nasceu de uma doença das laranjas. | Os pomares adoeceram e São Miguel passou a plantar chá. | Dois mestres chineses vindos de Macau ensinaram os açorianos a cultivar chá. | было (правку не предлагаю) |
| elevador-bom-jesus | да | O funicular que anda a água há 140 anos. | Um cabo, duas cabines e quase seis mil litros de água. | Para subir ao Bom Jesus, uma cabine desce cheia de água. | вариант 1 |
| elevador-santa-justa |  | O elevador de ferro que não foi Eiffel que construiu. | Quarenta e cinco metros de ferro ligam a Baixa ao Chiado. | Lembra tanto a Torre Eiffel que muitos o atribuem ao próprio Eiffel. | вариант 2 |
| falsos-sebastiao |  | Durante vinte anos, o rei desaparecido foi «encontrado». | Noviço, ermitão, pasteleiro e calabrês: todos se disseram D. Sebastião. | Ninguém viu bem o corpo do rei, e logo surgiram impostores. | вариант 1 |
| galerias-romanas-rua-da-prata |  | As galerias romanas inundadas de Lisboa. | Uma tampa no meio da rua dá acesso a galerias romanas. | Em 1771, ao reconstruir a Baixa, os construtores toparam com galerias romanas. | вариант 1 |
| garum-lisboa |  | Debaixo de um banco de Lisboa, os romanos faziam molho de peixe. | Os operários de um banco encontraram tanques onde os romanos salgavam peixe. | Sal, ervas e peixe: o sabor de Olisipo que o império apreciava. | было (правку не предлагаю) |
| livraria-lello | да | A livraria onde J.K. Rowling nunca entrou. | A escada vermelha da Lello não inspirou Hogwarts, garante a própria autora. | Uma lenda encheu a Lello de turistas, mas Rowling nunca lá esteve. | вариант 1 |
| mafra-sinos-1717 |  | Os mestres exigiram pagamento adiantado. O rei pagou o dobro. | Encomendaram-se quase cem sinos na Flandres, e os mestres desconfiaram de Portugal. | Duvidaram de que Portugal pagasse; D. João V mandou o dobro. | было (правку не предлагаю) |
| ouro-sao-francisco-porto |  | Frades com voto de pobreza cobriram a sua igreja de ouro. | Por fora é simples e cinzenta; por dentro, tudo reluz a ouro. | Colunas, abóbadas, anjos e videiras: tudo dourado numa igreja de franciscanos. | было (правку не предлагаю) |
| palacio-da-pena |  | O convento abandonado que se tornou um conto de fadas. | Um convento vazio no alto de Sintra ganhou torres cor-de-rosa e amarelas. | Um príncipe alemão apaixonado por castelos casou com a rainha de Portugal. | вариант 1 |
| pasteis-de-belem-1837 |  | Receita secreta dos frades, ou talvez a melhor publicidade do século XIX. | Fecharam os conventos e alguém dos Jerónimos começou a vender pastéis. | A receita é secreta há quase duzentos anos, e a fila continua. | вариант 2 |
| ponte-maria-pia-1877 |  | O primeiro recorde de Eiffel não está em Paris, mas no Porto. | Um só arco de ferro, 160 metros, o mais longo do mundo. | Doze anos antes da torre de Paris, Eiffel já cruzava o Douro. | вариант 2 |
| ponte-trajano-chaves |  | A ponte romana que os habitantes pagaram do seu bolso. | Uma inscrição em latim diz quem pagou a ponte: os habitantes. | Sobreviveu a Roma, aos mouros e às cheias, e ainda se atravessa. | вариант 1 |
| porca-de-murca |  | A porca com mais de dois mil anos. | Mais de quatrocentos animais de granito, e ninguém sabe para que serviam. | Quase dois metros de granito: a porca que simboliza Murça. | вариант 1 |
| prisao-joanina |  | Debaixo da biblioteca dourada de Coimbra havia uma prisão para estudantes. | Três salas de ouro e laca por cima, celas por baixo. | Até 1834, estudantes castigados, e até professores, ficavam presos sob os livros. | было (правку не предлагаю) |
| restauracao-1640 |  | Sessenta anos de reis espanhóis acabaram numa só manhã. | Prenderam a vice-rainha e aclamaram o duque de Bragança como rei. | Impostos a subir, guerras alheias: no outono de 1640, os nobres conjuraram. | было (правку не предлагаю) |
| templo-romano-evora | да | O templo que um talho salvou. | As colunas romanas de Évora passaram séculos dentro de paredes medievais. | Do século XIV a 1836, vendeu-se carne entre colunas romanas de Évora. | вариант 2 |
| termas-vipasca |  | Nos banhos romanos, as mulheres pagavam o dobro dos homens. | Em Vipasca, a lei marcava as horas de banho de cada sexo. | Achadas em escórias de mina, duas placas de bronze regulam os banhos. | было (правку не предлагаю) |
| travessia-atlantico-sul-1922 |  | Os primeiros a atravessar o Atlântico Sul pelo ar gastaram três aviões. | Sobre o oceano, o guia era um sextante inventado por Coutinho. | Dois hidroaviões perdidos e um terceiro: 79 dias de Lisboa ao Rio. | вариант 2 |
| viriato-139-ac |  | Roma não conseguiu vencer o pastor. Então comprou os amigos dele. | Viriato obrigou Roma à paz; três companheiros seus venderam-no por uma recompensa. | Morreu a dormir, às mãos de três companheiros, pela promessa de Cepião. | было (правку не предлагаю) |

### Meta-описание (первое предложение истории; меняется как первое предложение текста)

| история | было | вариант 1 | вариант 2 | победитель |
|---|---|---|---|---|
| a-portuguesa-1890 | Em janeiro de 1890, a Grã-Bretanha exigiu que Portugal saísse das terras entre Angola e Moçambique. | Em janeiro de 1890, a Grã-Bretanha exigiu que Portugal abandonasse as terras entre Angola e Moçambique, e o rei cedeu. | O rei cedeu em janeiro de 1890, quando a Grã-Bretanha exigiu a saída de Portugal das terras entre Angola e Moçambique. | было (правку не предлагаю) |
| batalha-da-salga-1581 | Em 1580, Portugal passou para o rei espanhol Filipe II, mas a ilha Terceira, nos Açores, não o reconheceu. | Em 1580, Portugal passou para Filipe II de Espanha, mas a Terceira, nos Açores, não o reconheceu, e um ano depois chegaram os espanhóis. | Em 1581, a ilha Terceira, nos Açores, ainda não reconhecia Filipe II de Espanha, que governava Portugal desde 1580, e os espanhóis desembarcaram. | было (правку не предлагаю) |
| braguinha-ukulele-1879 | Em 1879, o navio «Ravenscrag» levou da Madeira para o Havai centenas de emigrantes que iam trabalhar nas plantações de açúcar. | Em 1879, o navio «Ravenscrag» levou da Madeira para as plantações de açúcar do Havai centenas de emigrantes, e entre eles três marceneiros. | Em 1879, centenas de emigrantes madeirenses embarcaram no «Ravenscrag» rumo às plantações de açúcar do Havai. | вариант 2 |
| capela-sao-joao-baptista | D. João V queria uma capela que não ficasse atrás das de Roma. | D. João V queria uma capela à altura das de Roma, e em 1742 encomendou-a aos melhores mestres romanos. | D. João V não queria uma capela menos rica do que as de Roma, e em 1742 pediu-a aos melhores mestres romanos. | было (правку не предлагаю) |
| carros-de-cesto-monte | A freguesia do Monte fica numa encosta íngreme sobre o Funchal. | No século XIX, os habitantes do Monte, numa encosta íngreme sobre o Funchal, inventaram uma maneira rápida de descer à cidade. | Na encosta íngreme do Monte, sobre o Funchal, inventou-se no século XIX uma maneira rápida de descer à cidade. | вариант 2 |
| catarina-cha-1662 | Em 1662, D. Catarina de Bragança, filha de D. João IV, casou com o rei Carlos II de Inglaterra. | Em 1662, D. Catarina de Bragança, filha de D. João IV, casou com Carlos II de Inglaterra e levou consigo um dote enorme. | A filha de D. João IV, D. Catarina de Bragança, casou em 1662 com o rei Carlos II de Inglaterra, e o dote foi enorme. | вариант 1 |
| cha-gorreana | A ilha de São Miguel, nos Açores, vivia das laranjas: seguiam de barco para Inglaterra. | Por volta de 1864, uma doença quase acabou com os pomares de laranjas de São Miguel, nos Açores, que seguiam de barco para Inglaterra. | A ilha de São Miguel, nos Açores, vivia das laranjas que seguiam de barco para Inglaterra, até que por volta de 1864 uma doença atacou os pomares. | вариант 1 |
| elevador-bom-jesus | Sobre Braga ergue-se o santuário do Bom Jesus do Monte, com uma enorme escadaria barroca. | Para ajudar os peregrinos a subir ao santuário do Bom Jesus do Monte, sobre Braga, abriu em 1882 um funicular sem motor. | Em Braga, a enorme escadaria barroca do Bom Jesus do Monte ganhou em 1882 um auxiliar para os peregrinos: um funicular. | вариант 1 |
| elevador-santa-justa | A Baixa fica em baixo, e o Chiado no alto da colina. | Para os lisboetas não subirem escadas da Baixa ao Chiado, no alto da colina, começou a construir-se em 1900 uma torre de ferro com elevador. | Entre a Baixa e o Chiado, no alto da colina, começou a erguer-se em 1900 uma torre de ferro com elevador, para poupar escadas aos lisboetas. | вариант 2 |
| falsos-sebastiao | Em 1578, o jovem rei D. Sebastião desapareceu numa batalha em Marrocos. | Em 1578, o jovem rei D. Sebastião desapareceu numa batalha em Marrocos, e os portugueses ficaram à espera de que voltasse. | O jovem rei D. Sebastião desapareceu em 1578 numa batalha em Marrocos, e Portugal nunca deixou de o esperar. | вариант 2 |
| galerias-romanas-rua-da-prata | Depois do terramoto de 1755 a Baixa foi reconstruída de raiz, e em 1771 os construtores deram com galerias romanas subterrâneas debaixo da Rua da Prata. | Em 1771, durante a reconstrução da Baixa depois do terramoto de 1755, os construtores deram com galerias romanas debaixo da Rua da Prata. | A Baixa, reconstruída de raiz após o terramoto de 1755, escondia sob a Rua da Prata galerias romanas, que os construtores acharam em 1771. | вариант 1 |
| garum-lisboa | Em 1991, um banco da Baixa decidiu remodelar a sua sede. | Em 1991, ao remodelar a sua sede na Baixa de Lisboa, um banco foi dar com uma fábrica romana de peixe. | Foi numa remodelação da sede de um banco da Baixa, em 1991, que Lisboa voltou a encontrar os romanos. | вариант 1 |
| livraria-lello | A Livraria Lello abriu no Porto em 1906: fachada neogótica, vitrais e uma escada vermelha que parece escorrer do primeiro andar. | Aberta no Porto em 1906, a Livraria Lello tem fachada neogótica, vitrais e uma escada vermelha que parece escorrer do primeiro andar. | A Livraria Lello abriu no Porto em 1906, com fachada neogótica e vitrais e uma escada vermelha que parece escorrer do primeiro andar. | вариант 1 |
| mafra-sinos-1717 | O rei D. João V fez uma promessa: se lhe nascesse um herdeiro, construiria um convento. | D. João V prometeu um convento se lhe nascesse um herdeiro; nasceu uma filha, e em 1717 lançou-se em Mafra a primeira pedra. | Em troca de um herdeiro, D. João V prometeu construir um convento; nasceu-lhe uma filha, e em 1717 começou a obra em Mafra. | вариант 1 |
| ouro-sao-francisco-porto | No final do século XVII encontrou-se ouro no Brasil, e para Portugal partiram navios com uma carga preciosa. | Quando se achou ouro no Brasil, no final do século XVII, partiram para Portugal navios carregados dele, e parte foi para as igrejas. | No final do século XVII descobriu-se ouro no Brasil, e os navios que partiram para Portugal traziam uma carga preciosa. | вариант 2 |
| palacio-da-pena | O príncipe alemão Fernando de Saxe-Coburgo casou com a rainha D. Maria II e tornou-se o rei D. Fernando II. | Pintor e colecionador, o príncipe alemão Fernando de Saxe-Coburgo casou com a rainha D. Maria II e tornou-se o rei D. Fernando II. | O príncipe alemão Fernando de Saxe-Coburgo, que pintava e adorava castelos românticos, casou com D. Maria II e tornou-se o rei D. Fernando II. | вариант 1 |
| pasteis-de-belem-1837 | Em 1834, depois da guerra civil, todos os conventos de Portugal foram extintos e os frades mandados para casa. | Em 1834, no fim da guerra civil, extinguiram-se todos os conventos de Portugal e os frades foram mandados para casa. | Quando os conventos de Portugal foram extintos em 1834, depois da guerra civil, os frades foram mandados para casa e era preciso sobreviver. | вариант 1 |
| ponte-maria-pia-1877 | A linha de comboio de Lisboa parava no rio Douro: os comboios não conseguiam chegar ao Porto. | A linha de comboio de Lisboa terminava no Douro, e sem ponte os comboios não chegavam ao Porto. | Sem uma ponte sobre o Douro, os comboios vindos de Lisboa não conseguiam chegar ao Porto: a linha parava na margem do rio. | вариант 1 |
| ponte-trajano-chaves | Os romanos cobriram a Lusitânia de estradas, e na estrada de Braga para Astorga precisaram de uma ponte sobre o rio Tâmega. | Quando os romanos cobriram a Lusitânia de estradas, a de Braga para Astorga pedia uma ponte sobre o rio Tâmega. | A estrada romana de Braga para Astorga tinha de atravessar o rio Tâmega, e os romanos, que cobriram a Lusitânia de estradas, fizeram uma ponte. | вариант 1 |
| porca-de-murca | Ainda antes dos romanos, os povos do nordeste de Portugal e do oeste de Espanha esculpiam em granito javalis, porcos e touros. | Antes dos romanos, os povos do nordeste de Portugal e do oeste de Espanha esculpiam em granito javalis, porcos e touros, os «berrões». | Antes de os romanos chegarem, povos do nordeste de Portugal e do oeste de Espanha já esculpiam em granito javalis, porcos e touros. | было (правку не предлагаю) |
| prisao-joanina | Em 1717, D. João V deu à Universidade de Coimbra dinheiro para uma nova biblioteca. | Em 1717, D. João V deu à Universidade de Coimbra dinheiro para uma biblioteca, que ficaria a chamar-se Joanina em honra do rei. | A Biblioteca Joanina nasceu em 1717, quando D. João V deu à Universidade de Coimbra dinheiro para uma nova biblioteca. | было (правку не предлагаю) |
| restauracao-1640 | Desde 1580, Portugal era governado pelos reis de Espanha. | Desde 1580, Portugal era governado pelos reis de Espanha, com impostos a subir e fidalgos mandados combater por interesses alheios. | Em 1640 já fazia sessenta anos que Portugal era governado pelos reis de Espanha, desde 1580. | вариант 2 |
| templo-romano-evora | No século I construiu-se no centro de Évora um templo, provavelmente em honra do imperador Augusto. | No centro de Évora ergueu-se no século I um templo romano, provavelmente em honra do imperador Augusto. | Évora tem no centro um templo romano do século I, provavelmente erguido em honra do imperador Augusto. | вариант 2 |
| termas-vipasca | Junto à mina de Vipasca, hoje Aljustrel, no Alentejo, cresceu no tempo dos romanos uma aldeia de mineiros. | Junto à mina de Vipasca, hoje Aljustrel, no Alentejo, cresceu no tempo dos romanos uma aldeia de mineiros com leis próprias. | No Alentejo romano, junto à mina de Vipasca, a atual Aljustrel, uma aldeia de mineiros viveu regulada por leis em placas de bronze. | вариант 2 |
| travessia-atlantico-sul-1922 | Em 1922, dois oficiais da Marinha, Gago Coutinho e Sacadura Cabral, decidiram voar de Lisboa ao Brasil no centenário da sua independência. | Em 1922, no centenário da independência do Brasil, os oficiais da Marinha Gago Coutinho e Sacadura Cabral decidiram voar de Lisboa ao Brasil. | Dois oficiais da Marinha, Gago Coutinho e Sacadura Cabral, quiseram voar de Lisboa ao Brasil em 1922, no centenário da independência brasileira. | вариант 1 |
| viriato-139-ac | Viriato era um pastor lusitano e tornou-se o chefe contra quem Roma lutou oito anos. | Pastor lusitano, Viriato tornou-se o chefe contra quem Roma lutou durante oito anos. | Durante oito anos, o pastor lusitano Viriato foi o chefe contra quem Roma teve de lutar. | вариант 2 |

## Крючок не должен повторять название: проверка всех 44 историй

Проверено 44 историй (26 новых и 18 прежних), крючок против названия: совпадение слово в слово, вхождение названия в крючок или общий отрезок не менее 60% слов названия.

| история | название | крючок | степень | два варианта крючка |
|---|---|---|---|---|
| carros-de-cesto-monte | Trenós sem neve | Na Madeira desce-se a montanha em trenós de vime, sem neve. | почти (67% слов названия подряд) | 1) Do Monte ao Funchal num cesto de vime que desliza pela calçada.<br>2) O travão deste carro são as botas de borracha de dois homens. |
| cha-gorreana | O chá que nasceu de uma doença das laranjas | O chá mais antigo da Europa nasceu de uma doença das laranjas. | почти (67% слов названия подряд) | 1) Os pomares adoeceram e São Miguel passou a plantar chá.<br>2) Dois mestres chineses vindos de Macau ensinaram os açorianos a cultivar chá. |
| elevador-bom-jesus | O funicular que anda a água | O funicular que anda a água há 140 anos. | название целиком внутри | 1) Um cabo, duas cabines e quase seis mil litros de água.<br>2) Para subir ao Bom Jesus, uma cabine desce cheia de água. |
| elevador-santa-justa | O elevador que não foi Eiffel que fez | O elevador de ferro que não foi Eiffel que construiu. | почти (63% слов названия подряд) | 1) Quarenta e cinco metros de ferro ligam a Baixa ao Chiado.<br>2) Lembra tanto a Torre Eiffel que muitos o atribuem ao próprio Eiffel. |
| livraria-lello | A livraria onde J.K. Rowling nunca entrou | A livraria onde J.K. Rowling nunca entrou. | слово в слово | 1) A escada vermelha da Lello não inspirou Hogwarts, garante a própria autora.<br>2) Uma lenda encheu a Lello de turistas, mas Rowling nunca lá esteve. |
| prisao-joanina | A prisão debaixo da biblioteca | Debaixo da biblioteca dourada de Coimbra havia uma prisão para estudantes. | почти (60% слов названия подряд) | 1) Três salas de ouro e laca por cima, celas por baixo.<br>2) Até 1834, estudantes castigados, e até professores, ficavam presos sob os livros. |
| templo-romano-evora | O templo que um talho salvou | O templo que um talho salvou. | слово в слово | 1) As colunas romanas de Évora passaram séculos dentro de paredes medievais.<br>2) Do século XIV a 1836, vendeu-se carne entre colunas romanas de Évora. |
| termas-vipasca | Os banhos onde as mulheres pagavam o dobro | Nos banhos romanos, as mulheres pagavam o dobro dos homens. | почти (63% слов названия подряд) | 1) Em Vipasca, a lei marcava as horas de banho de cada sexo.<br>2) Achadas em escórias de mina, duas placas de bronze regulam os banhos. |

Найдено совпадений: **8**. Новые крючки-кандидаты из таблицы выше (раздел «Крючки») подобраны так, чтобы не повторять название; финальный выбор твой.


## check:ai-tells на этом языке

Для каждого предупреждения: оставить (почему) или правка. Остальные 32 «старых» предупреждения по прошлым историям разобраны здесь же (поле «новая история» = нет).

| # | история | поле | тип | сейчас | решение | почему | правка |
|---|---|---|---|---|---|---|---|
| 1 | aljubarrota-1385 (старая) | more | evaluation | uns 10 000 combateram. O famoso QUOTE português é hoje tido | правка | «famoso» без причины; в той же фразе сказано, что это миф. | O «quadrado» português |
| 2 | batalha-da-salga-1581 | story | spread | 5 sentences of 13-19 words (spread 0.15) | оставить | Разброс 0.15 на пять предложений, но это последовательные факты и читается естественно. |  |
| 7 | braguinha-ukulele-1879 | more | spread | 6 sentences of 13-27 words (spread 0.23) | оставить | Разброс 0.23, абзацы разной длины, текст естественный. |  |
| 8 | braguinha-ukulele-1879 | more | sentence-start | 3 sentences in a row start with «o» | оставить | Три «O» подряд: параллельные факты (корабль, инструмент, король). |  |
| 12 | carros-de-cesto-monte | more | construction | levavam à cidade não só pessoas mas também cargas, e arrastavam | правка | «não só X mas também Y» без нужного контраста. | levavam à cidade pessoas e cargas |
| 14 | casa-da-neve-1782 (старая) | more | question | De onde vinha o gelo? | правка | Риторический вопрос в начале поля; факт можно сказать прямо. | Primeiro |
| 19 | corte-brasil-1807 (старая) | story | triples | 2 lists of three, 2 in a row | оставить | Список (королева, министры, архивы, кареты) это конкретные вещи, а не наполнитель. |  |
| 20 | corte-brasil-1807 (старая) | story | spread | 6 sentences of 9-18 words (spread 0.22) | оставить | Разброс 0.22, цепочка дат и фактов. |  |
| 22 | corte-brasil-1807 (старая) | more | cliche | do Império Português: o único caso de uma monarquia | оставить | «Единственный случай» европейской монархии, управляемой из колонии, документированный факт (в allow). |  |
| 26 | elevador-santa-justa | story | spread | 5 sentences of 12-20 words (spread 0.18) | оставить | Разброс 0.18, цепочка дат и фактов. |  |
| 30 | falsos-sebastiao | more | ending | QUOTE ainda hoje quer dizer, em português, | правка | Идиома сама по себе факт, но «ainda hoje» и «que não vai acontecer» звучат моралью; достаточно убрать «ainda hoje». | «Esperar por D. Sebastião» quer dizer, em português, esperar por um milagre que não vai acontecer. |
| 32 | garum-lisboa | more | sentence-start | 3 sentences in a row start with «o» | оставить | Начала «O» идут не подряд, а в параллельных фактах о гаруме. |  |
| 33 | guerra-laranjas-1801 (старая) | story | spread | 5 sentences of 14-22 words (spread 0.18) | оставить | Разброс 0.18, фактическая цепочка. |  |
| 37 | morcegos-mafra-1771 (старая) | more | evaluation | morcegos noutra biblioteca famosa, a Joanina, em Coimbra. Lá, | правка | «famosa» без причины; библиотека названа по имени. | noutra biblioteca, a Joanina |
| 42 | palacio-da-pena | more | spread | 5 sentences of 14-24 words (spread 0.20) | оставить | Разброс 0.20, абзацы разной длины, читается естественно. |  |
| 45 | pasteis-de-belem-1837 | more | evaluation | QUOTE. Nem a versão mais famosa escapa: a de que as freiras | правка | «mais famosa» пустое; смысл «самая распространённая». | Nem a versão mais difundida escapa |
| 48 | ponte-maria-pia-1877 | story | cliche | de Gustave Eiffel. O seu único arco de ferro, com 160 | оставить | Единственная арка длиной 160 м это факт конструкции (в allow). |  |
| 49 | ponte-trajano-chaves | story | ending | mas os arcos romanos ainda hoje levam a estrada sobre o | оставить | Мост по-прежнему несёт дорогу: проверяемый факт, концовка-деталь. |  |
| 51 | ponte-trajano-chaves | more | sentence-start | 3 sentences in a row start with «a» | оставить | Повторы «A ponte» вызваны параллельными фактами. |  |
| 55 | porca-de-murca | story | evaluation | ou sepulturas. O mais famoso, a Porca de Murça, tem | оставить | «Самый известный» сразу обосновано: размер и символ городка. |  |
| 60 | ruas-oficios-1760 (старая) | more | construction | Assim, Pombal pôs ordem não só no traçado, mas também no comércio: o | правка | «не только X, но и Y» без реального контраста. | Assim, Pombal pôs ordem no traçado e no comércio |
| 61 | ruas-oficios-1760 (старая) | more | ending | Daí uma confusão que dura até hoje: a Rua Áurea continua a | правка | «confusão que dura até hoje» оценка; оставить факт. | Por isso a Rua Áurea continua a ser, para toda a gente, a Rua do Ouro. |
| 65 | torres-vedras-1810 (старая) | more | spread | 6 sentences of 20-27 words (spread 0.10) | правка | Разброс 0.10, все предложения длинные; разделить одно, чтобы появилось короткое. | Os camponeses portugueses abandonaram as terras e destruíram a comida que não podiam levar. O exército francês passou fome. |
| 69 | avis-e-descobrimentos (старая) | intro | triples | 2 lists of three, 2 in a row | оставить | Перечисления из реальных мест и товаров, это вводка эпохи. |  |
| 72 | nascimento-do-reino-e-reconquista (старая) | intro | ending | então quase não mudaram até hoje. | оставить | Стабильность границ это проверяемый факт, а не оценка. |  |

## Подпись дат эпох 0 и 1

Сейчас в `src/content/epochs.yaml`: эпоха 0 («Пролог») уже подписана диапазоном; **эпоха 1 всё ещё «até ao séc. V»** (`years: -500…409`). Предложение: **«séc. VI a.C. – séc. V»**, чтобы подряд читалось «… – VI в. до н. э.», «VI в. до н. э. – V в.», «V–XII вв.». Плитка на главной и шапка эпохи с предложенной подписью (временная правка в dev-сборке, не в коде, возвращена): `scripts/.tmp/audit/shots/proposed-home-{pt,ru}-{1280,390}.png` и `proposed-epoch-{pt,ru}-{1280,390}.png`; подпись помещается в плитку без переноса лишнего.

Эпоха 0: «150 млн лет» остаётся круглой цифрой, но подпись «150 milhões de anos – séc. VI a.C.» не говорит, что это приблизительно, и не говорит «назад» (читается как длительность). Предложение: **«há cerca de 150 milhões de anos – séc. VI a.C.»**. 

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

- «tira o fôlego» вместо «corta a respiração» (ouro-sao-francisco-porto): калька с английского или нет?
- «tornou-se … uma atração» вместо «virou atração» (carros-de-cesto-monte): Priberam помечает «virar = tornar-se» как [Brasil].
- «mineiros» вместо «garimpeiros» (ouro-sao-francisco-porto): Priberam помечает «garimpeiro» как [Brasil]; а исторический контекст бразильский.
- «Nos conventos faziam-se doces» (pasteis-de-belem-1837): согласование, ждать подтверждения от носителя.
- «Ir para os marcadores do mapa» (map.skip_to_markers) как ссылка «перейти к маркерам».
- «Em debate» против глоссарного «debatido» (метка).
- Заголовок «Os doces dos frades, ou talvez a melhor publicidade do século XIX».
- Новые крючки там, где победил вариант (см. таблицу «Крючки»): прочитать вслух.

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
