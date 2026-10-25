// Texts of the static pages: About, Method and sources, Legal information (docs/spec.md 5.6), in the three languages.
// Source: docs/texts-ru.md, docs/texts-pt.md, docs/texts-en.md (sections 2, 3 and 4). Names of things on the site (labels, eras,
// threads, buttons) are written as the site itself names them; the differences from the files are listed in docs/STATE.md.
// The "Who makes this" section and the data controller line in Legal information are the owner's own wording (not from the files).
//
// Inline markup: {{about}} {{method}} {{report}} {{legal}} {{map}} link to a page of the site (the link text is the title of that
// page; {{method|text}} gives the link another text, for a case ending); {{email}} is the contact address as a link; {{stories}} is
// the number of published stories with its noun ("13 stories"), counted from the data; {{ready}} and {{soon}} are the sentences about the ready epochs (their number and names) and about those to come (src/lib/ready-epochs.ts); **text** is bold. Everything else is plain text.
import type { Lang } from '../i18n/routes';

export const CONTACT_EMAIL = 'elefantefugiu@gmail.com';
/** The address of the form on FormSubmit: a random id the service gives instead of the e-mail, so the form works without JavaScript and the e-mail is not in the page. */
export const FORM_ID = '72b2e1f6b2547e714da237559c8e643f';

export interface Section {
  /** Anchor of the section (the same in every language). */
  id: string;
  heading: string;
  paragraphs: string[];
  /** A list after the paragraphs. */
  items?: string[];
  /** Paragraphs after the list. */
  after?: string[];
}

export interface StaticPage {
  /** The opening paragraph, shown larger (a page may start straight with its first section). */
  lead?: string;
  /** More opening paragraphs, in ordinary size. */
  more?: string[];
  sections: Section[];
}

export type StaticKey = 'about' | 'method' | 'legal';

export const STATIC_PAGES: Record<StaticKey, Record<Lang, StaticPage>> = {
  about: {
    pt: {
      lead: 'Em 1515, o rei D. Manuel I decidiu pôr à prova se o elefante e o rinoceronte eram mesmo inimigos mortais. Os animais foram soltos no pátio de um palácio de Lisboa, diante de uma multidão. O elefante olhou para o adversário e fugiu.',
      more: ['Daí o nosso nome: **O Elefante Fugiu**. Reunimos histórias assim do passado de Portugal: curtas, verificadas e ligadas a um lugar que se pode visitar hoje. Cada uma lê-se num minuto.'],
      sections: [
        {
          id: 'foi-aqui',
          heading: 'Foi aqui',
          paragraphs: ['Uma história fica melhor na memória quando estamos no sítio exato. Por isso, cada história tem um ponto no mapa e uma «ponte para hoje»: uma igreja, uma praça, um museu ou um monumento onde ficou um vestígio dela.'],
        },
        {
          id: 'como-ler',
          heading: 'Como ler',
          paragraphs: ['Cada história tem três camadas. Pare em qualquer uma.'],
          items: ['**Gancho.** Uma frase: «O rei pôs um rinoceronte contra um elefante. O elefante fugiu.»', '**História.** Como aconteceu, em poucas linhas.', '**Saber mais.** O contexto, como sabemos e onde ir.'],
          after: ['Pode ler por épocas, por fios (o mar, comida e vinho, poder e revolta, gente como nós, natureza) ou simplesmente no mapa.'],
        },
        {
          id: 'para-quem',
          heading: 'Para quem',
          paragraphs: [],
          items: ['Para quem gosta de história, mas não de manuais.', 'Para quem viaja e quer saber o que aconteceu exatamente onde está.', 'Para famílias. O botão «Idade» no topo esconde as histórias com batalhas e temas difíceis: escolhe a idade do leitor mais novo.'],
        },
        {
          id: 'confianca',
          heading: 'Pode confiar nisto?',
          paragraphs: ['Não fazemos passar lendas por factos. Cada história tem uma etiqueta: «Documentado», «Lenda» ou «Em debate», e no fim a lista de fontes. Explicamos como trabalhamos em {{method|Método e fontes}}.'],
        },
        {
          id: 'estado',
          heading: 'O que já existe',
          paragraphs: ['O projeto está a crescer. {{ready}}, com {{stories}} no total. {{soon}}'],
        },
        {
          id: 'quem-faz',
          heading: 'Quem faz',
          paragraphs: [
            'Vivo em Portugal, mas não nasci cá, e continuo a descobrir o país, história a história. O passado de Portugal é riquíssimo. O que encontro de mais interessante conto primeiro aos meus filhos, e agora também aqui.',
            'O Elefante Fugiu é feito por uma só pessoa, nos tempos livres: é gratuito, sem publicidade e sem cookies. Não sou historiador, por isso apoio-me em fontes e indico-as no fim de cada história.',
            'Se é historiador, arquivista ou guia e vê onde algo pode ser contado com mais rigor, escreva-me. Qualquer sugestão é bem-vinda, mesmo sobre uma só história.',
          ],
        },
        {
          id: 'ajudar',
          heading: 'Como ajudar',
          paragraphs: [],
          items: ['Encontrou uma imprecisão? Diga-nos em {{report}}.', 'Conhece uma história que falta aqui? Envie-a para {{email}}.', 'Gostou? Partilhe uma história com alguém que vai visitar Portugal. É a melhor ajuda.'],
          after: ['Escreva-nos: {{email}}'],
        },
      ],
    },
    en: {
      lead: 'In 1515 King Manuel I decided to test whether the elephant and the rhinoceros really were sworn enemies. The animals were let into the courtyard of a Lisbon palace in front of a crowd. The elephant took one look at its opponent and ran away.',
      more: ['Hence our name: **O Elefante Fugiu**, “The elephant ran away”. We collect stories like this from Portugal’s past: short, checked, and tied to a place you can visit today. Each one takes a minute to read.'],
      sections: [
        {
          id: 'foi-aqui',
          heading: 'Foi aqui. It happened here',
          paragraphs: ['A story sticks better when you’re standing on the very spot. That’s why every story has a point on the map and a “bridge to today”: a church, a square, a museum or a monument where it left a trace.'],
        },
        {
          id: 'como-ler',
          heading: 'How to read',
          paragraphs: ['Every story has three layers. Stop at any of them.'],
          items: ['**Hook.** One line: “The king set a rhino against an elephant. The elephant ran away.”', '**Story.** How it happened, in a few lines.', '**More.** What was going on around it, how we know, and where to go.'],
          after: ['You can read by era, by thread (the sea, food and wine, power and revolt, people like us, nature) or simply on the map.'],
        },
        {
          id: 'para-quem',
          heading: 'Who it’s for',
          paragraphs: [],
          items: ['For people who love history but not textbooks.', 'For travellers who want to know what happened right where they’re standing.', 'For families. The “Age” button in the header hides stories with battles and difficult topics: you choose the youngest reader’s age.'],
        },
        {
          id: 'confianca',
          heading: 'Can you trust it',
          paragraphs: ['We don’t pass legends off as facts. Every story carries a label: “Documented”, “Legend” or “Debated”, and a list of sources at the bottom. How we work is explained in {{method|Method and sources}}.'],
        },
        {
          id: 'estado',
          heading: 'What’s here so far',
          paragraphs: ['The project is growing. {{ready}}, {{stories}} in all. {{soon}}'],
        },
        {
          id: 'quem-faz',
          heading: 'Who makes this',
          paragraphs: [
            'I live in Portugal, though I wasn’t born here, and I’m still discovering the country one story at a time. Its past is remarkably rich. I tell the best bits to my children first, and now here too.',
            'O Elefante Fugiu is run by one person in their spare time: free, with no ads and no cookies. I’m not a historian, so I rely on sources and list them under every story.',
            'If you’re a historian, archivist or guide and see where something could be told more accurately, write to me. Any suggestion is welcome, even about a single story.',
          ],
        },
        {
          id: 'ajudar',
          heading: 'How to help',
          paragraphs: [],
          items: ['Spotted a mistake? Tell us via {{report}}.', 'Know a story that’s missing here? Send it to {{email}}.', 'Enjoyed it? Share a story with someone heading to Portugal. That’s the best help of all.'],
          after: ['Write to us: {{email}}'],
        },
      ],
    },
    ru: {
      lead: 'В 1515 году король Мануэл I решил проверить, правда ли слон и носорог заклятые враги. Зверей выпустили во двор лиссабонского дворца при толпе зрителей. Слон посмотрел на противника и сбежал.',
      more: ['Отсюда наше название: **O Elefante Fugiu**, «Слон сбежал». Мы собираем такие истории из прошлого Португалии: короткие, проверенные и привязанные к месту, куда можно прийти сегодня. Одна история читается за минуту.'],
      sections: [
        {
          id: 'foi-aqui',
          heading: 'Foi aqui. Это было здесь',
          paragraphs: ['История запоминается лучше, когда стоишь на том самом месте. Поэтому у каждой истории есть точка на карте и «мост в сегодня»: церковь, площадь, музей или памятник, где от неё остался след.'],
        },
        {
          id: 'como-ler',
          heading: 'Как читать',
          paragraphs: ['У каждой истории три слоя. Остановитесь на любом.'],
          items: ['**Крючок.** Одна фраза: «Король стравил носорога со слоном. Слон убежал».', '**История.** Как это было, в нескольких строках.', '**Подробнее.** Что вокруг, откуда мы это знаем и куда сходить.'],
          after: ['Истории можно читать по эпохам, по нитям (море, еда и вино, власть и бунт, люди как мы, природа) или просто на карте.'],
        },
        {
          id: 'para-quem',
          heading: 'Для кого',
          paragraphs: [],
          items: ['Для тех, кто любит историю, но не учебники.', 'Для путешественников, которым интересно, что случилось именно там, где они стоят.', 'Для семей. Кнопка «Возраст» в шапке скрывает истории со сценами сражений и на тяжёлые темы: вы выбираете возраст младшего читателя.'],
        },
        {
          id: 'confianca',
          heading: 'Можно ли этому верить',
          paragraphs: ['Мы не выдаём легенды за факты. У каждой истории есть метка: «Документально», «Легенда» или «Спорно», а внизу список источников. Как мы работаем, рассказано в {{method|«Методе и источниках»}}.'],
        },
        {
          id: 'estado',
          heading: 'Что уже есть',
          paragraphs: ['Проект растёт. {{ready}}, всего {{stories}}. {{soon}}'],
        },
        {
          id: 'quem-faz',
          heading: 'Кто это делает',
          paragraphs: [
            'Я живу в Португалии, но родился не здесь, и до сих пор открываю эту страну для себя, история за историей. Прошлое у неё удивительно богатое. Самое интересное я сначала рассказываю своим детям, а теперь и здесь.',
            'O Elefante Fugiu я веду один, в свободное время: бесплатно, без рекламы и без cookie. Я не историк, поэтому опираюсь на источники и указываю их под каждой историей.',
            'Если вы историк, архивист или гид и видите, где можно рассказать точнее, напишите мне. Буду рад любой подсказке, даже про одну историю.',
          ],
        },
        {
          id: 'ajudar',
          heading: 'Как помочь',
          paragraphs: [],
          items: ['Нашли неточность? Напишите нам через {{report}}.', 'Знаете историю, которой тут не хватает? Пришлите её на {{email}}.', 'Понравилось? Поделитесь историей с тем, кто собирается в Португалию. Это лучшая помощь.'],
          after: ['Пишите: {{email}}'],
        },
      ],
    },
  },
  method: {
    pt: {
      lead: 'A história está cheia de invenções bonitas, e nós também gostamos delas. Por isso dizemos sempre com clareza o que está provado e o que não está.',
      sections: [
        {
          id: 'etiquetas',
          heading: 'Três etiquetas',
          paragraphs: [],
          items: ['**Documentado.** O acontecimento é confirmado por documentos da época ou por trabalhos de historiadores.', '**Lenda.** A história conta-se há séculos, mas não há provas. Recontamo-la e explicamos o que nela é verdade.', '**Em debate.** Os historiadores não concordam ou as fontes contradizem-se. Dizemos exatamente onde está a divergência.'],
        },
        {
          id: 'datas-fontes',
          heading: 'De onde vêm os factos',
          paragraphs: ['Antes de mais, de documentos da época, trabalhos académicos, arquivos e sites oficiais de museus. Cada história tem pelo menos uma fonte; os grandes acontecimentos têm pelo menos duas. Estão todas no fim da história, junto à data da última verificação.'],
        },
        {
          id: 'numeros',
          heading: 'Datas e números',
          paragraphs: ['Quando as fontes divergem, damos as duas versões ou escrevemos «cerca de»: «1778 ou 1782». O tamanho dos exércitos e o número de vítimas são quase sempre estimativas, por isso damos um intervalo em vez de um número redondo.'],
        },
        {
          id: 'idades',
          heading: 'Crianças e temas difíceis',
          paragraphs: ['A maioria das histórias serve para todas as idades e não tem etiqueta. A etiqueta 12+ assinala batalhas ou crueldade. Antes das histórias sobre repressão, perseguição e morte avisamos e perguntamos se quer continuar. Nessas histórias não há piadas nem elefante. O botão «Idade» no topo esconde as histórias com batalhas e temas difíceis: escolhe a idade do leitor mais novo.'],
        },
        {
          id: 'imagens',
          heading: 'Imagens',
          paragraphs: ['Cada ilustração indica o autor e a licença. Se uma imagem foi criada com inteligência artificial, a legenda di-lo, para que ninguém a confunda com um documento da época.'],
        },
        {
          id: 'correcoes',
          heading: 'Erros',
          paragraphs: ['Acontecem. Se encontrar um, diga-nos em {{report}}. Corrigimos o texto e atualizamos a data da verificação. A ligação da história não muda, por isso pode continuar a partilhá-la.'],
        },
        {
          id: 'idiomas',
          heading: 'Línguas',
          paragraphs: ['As histórias são escritas em português e traduzidas para inglês e russo.'],
        },
      ],
    },
    en: {
      lead: 'History is full of beautiful inventions, and we love them too. That’s why we always say plainly what has been proven and what hasn’t.',
      sections: [
        {
          id: 'etiquetas',
          heading: 'Three labels',
          paragraphs: [],
          items: ['**Documented.** The event is confirmed by documents of the time or by historians’ work.', '**Legend.** The story has been told for centuries, but there’s no proof. We retell it and explain what’s true in it.', '**Debated.** Historians disagree or the sources contradict each other. We say exactly what the dispute is about.'],
        },
        {
          id: 'datas-fontes',
          heading: 'Where our facts come from',
          paragraphs: ['First of all from period documents, academic work, archives and the official websites of museums. Every story has at least one source, and major events have at least two. They are all listed at the bottom of the story, next to the date it was last checked.'],
        },
        {
          id: 'numeros',
          heading: 'Dates and numbers',
          paragraphs: ['When sources disagree, we give both versions or say “about”: “1778 or 1782”. Army sizes and death tolls are almost always estimates, so we give a range instead of one neat number.'],
        },
        {
          id: 'idades',
          heading: 'Children and difficult topics',
          paragraphs: ['Most stories are fine for any age and have no label. The 12+ label marks stories with battles or cruelty. Before stories about repression, persecution and death we give a warning and ask whether you want to continue. Those stories have no jokes and no elephant. The “Age” button in the header hides stories with battles and difficult topics: you choose the youngest reader’s age.'],
        },
        {
          id: 'imagens',
          heading: 'Images',
          paragraphs: ['Every illustration is credited with its author and licence. If an image was made with AI, the caption says so, so that nobody mistakes it for a period document.'],
        },
        {
          id: 'correcoes',
          heading: 'Mistakes',
          paragraphs: ['They happen. If you find one, tell us via {{report}}. We’ll fix the text and update the date it was checked. The story’s link doesn’t change, so you can keep sharing it.'],
        },
        {
          id: 'idiomas',
          heading: 'Languages',
          paragraphs: ['Stories are written in Portuguese and translated into English and Russian. If a translation isn’t ready yet, we show the English or Portuguese text and say so.'],
        },
      ],
    },
    ru: {
      lead: 'История полна красивых выдумок, и мы их тоже любим. Поэтому всегда говорим прямо, что из этого доказано, а что нет.',
      sections: [
        {
          id: 'etiquetas',
          heading: 'Три метки',
          paragraphs: [],
          items: ['**Документально.** Событие подтверждают документы того времени или работы историков.', '**Легенда.** Историю рассказывают веками, но доказательств нет. Мы пересказываем её и объясняем, что в ней правда.', '**Спорно.** Историки не сходятся или источники противоречат друг другу. Пишем, в чём именно спор.'],
        },
        {
          id: 'datas-fontes',
          heading: 'Откуда мы берём факты',
          paragraphs: ['В первую очередь из документов эпохи, научных работ, архивов и официальных сайтов музеев. У каждой истории есть хотя бы один источник, у крупных событий не меньше двух. Все они перечислены внизу истории, рядом дата последней проверки.'],
        },
        {
          id: 'numeros',
          heading: 'Даты и числа',
          paragraphs: ['Если источники расходятся, пишем оба варианта или «около»: «1778 или 1782». Численность армий и число жертв почти всегда оценка, поэтому даём диапазон вместо одной красивой цифры.'],
        },
        {
          id: 'idades',
          heading: 'Дети и тяжёлые темы',
          paragraphs: ['Большинство историй подходят для любого возраста и не имеют метки. Метка 12+ стоит там, где есть сражения или жестокость. Перед историями о репрессиях, преследованиях и смерти мы предупреждаем и спрашиваем, хотите ли вы продолжить. В таких историях нет шуток и слона. Кнопка «Возраст» в шапке скрывает истории со сценами сражений и на тяжёлые темы: вы выбираете возраст младшего читателя.'],
        },
        {
          id: 'imagens',
          heading: 'Картинки',
          paragraphs: ['У каждой иллюстрации подписаны автор и лицензия. Если картинка сделана нейросетью, мы пишем об этом в подписи, чтобы её не приняли за документ эпохи.'],
        },
        {
          id: 'correcoes',
          heading: 'Ошибки',
          paragraphs: ['Они случаются. Если вы нашли ошибку, напишите через {{report}}. Мы поправим текст и обновим дату проверки. Ссылка на историю при этом не меняется, так что ею можно спокойно делиться.'],
        },
        {
          id: 'idiomas',
          heading: 'Языки',
          paragraphs: ['Истории пишутся на португальском и переводятся на английский и русский. Если русского перевода ещё нет, покажем английский и предупредим об этом.'],
        },
      ],
    },
  },
  legal: {
    pt: {
      sections: [
        {
          id: 'resumo',
          heading: 'Em resumo',
          paragraphs: [],
          items: ['Pode usar os nossos textos livremente, com uma ligação para nós.', 'Não temos contas, cookies nem publicidade.', 'O seu navegador guarda apenas as suas preferências, e nós não as vemos.'],
        },
        {
          id: 'licencas',
          heading: 'O que pode fazer com os nossos materiais',
          paragraphs: [],
          items: [
            '**Textos** (histórias, descrições, textos da interface) estão sob a licença CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/deed.pt). Pode copiá-los, traduzi-los e adaptá-los, incluindo para visitas guiadas e aulas. Duas condições: indique «O Elefante Fugiu» com uma ligação e partilhe a sua versão nas mesmas condições.',
            '**O código do site** é aberto, sob a licença MIT.',
            '**As ilustrações** pertencem aos seus autores. O autor e a licença estão indicados por baixo de cada uma.',
            '**O nome «O Elefante Fugiu», o logótipo e a mascote (o elefante)** não estão abrangidos pelas licenças livres. Para os usar, escreva-nos.',
          ],
        },
        {
          id: 'privacidade',
          heading: 'O que fica guardado no seu navegador',
          paragraphs: [
            'Para que o site se lembre das suas escolhas, o navegador guarda: a língua, o tema, o modo família («Idade»), a última época aberta e a última história de «Surpreende-me». Estes dados ficam no armazenamento local e não são enviados para lado nenhum. Pode apagá-los nas definições do navegador, limpando os dados deste site. Se carregar em «Perto de mim», o navegador pede autorização para a localização. A sua posição é usada apenas nesta página e não é enviada para lado nenhum.',
          ],
        },
        {
          id: 'contagem',
          heading: 'Contagem de visitas',
          paragraphs: ['Contamos apenas as visitas às páginas, sem cookies e sem dados pessoais. Para isso usamos o serviço GoatCounter, que não regista o seu endereço IP (durante até 8 horas fica apenas em memória, para distinguir uma visita repetida) nem sabe quem é.'],
        },
        {
          id: 'terceiros',
          heading: 'Quem mais participa quando lê o site',
          paragraphs: ['O site não recolhe nada sobre si, mas não funciona no vácuo. Estes serviços veem o seu endereço IP:'],
          items: [
            '**GitHub Pages** (GitHub, Inc.) serve as páginas do site e pode registar endereços IP segundo as suas próprias regras.',
            '**Os mosaicos do mapa** vêm dos servidores da CARTO, que veem o seu endereço IP e o endereço da página, como em qualquer site com mapa.',
            '**GoatCounter** (goatcounter.com) conta as visitas às páginas; recebe o seu endereço IP, mas só o mantém em memória, até 8 horas.',
            '**FormSubmit** (formsubmit.co) reencaminha-nos a sua mensagem se enviar o formulário «Encontrou um erro?», juntamente com o email, se o indicar. Usamo-la apenas para corrigir o erro e responder-lhe. Prefere não usar o serviço? Escreva diretamente para {{email}}.',
          ],
          after: ['As ligações «Como chegar», as fontes e os sites dos museus levam a outros sites, com regras próprias.'],
        },
        {
          id: 'aviso',
          heading: 'Aviso',
          paragraphs: ['Verificamos cada história, mas a história é um campo de debate e os erros são possíveis. Este site não substitui as fontes académicas. Os horários e preços dos museus mudam: confirme-os no site oficial antes de ir.'],
        },
        {
          id: 'contacto',
          heading: 'Contactos',
          paragraphs: [
            'Questões sobre licenças e dados, pedidos de remoção de material: {{email}}.',
            'Responsável pelo tratamento dos dados: Artem K., Portugal, {{email}}',
          ],
        },
      ],
    },
    en: {
      sections: [
        {
          id: 'resumo',
          heading: 'In short',
          paragraphs: [],
          items: ['You’re free to use our texts with a link back to us.', 'We have no accounts, cookies or ads.', 'Your browser stores only your own settings, and we can’t see them.'],
        },
        {
          id: 'licencas',
          heading: 'What you can do with our material',
          paragraphs: [],
          items: [
            '**Texts** (stories, descriptions, interface text) are published under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). You may copy, translate and adapt them, including for tours and lessons. Two conditions: credit “O Elefante Fugiu” with a link, and share your version under the same terms.',
            '**The site’s code** is open under the MIT licence.',
            '**Illustrations** belong to their authors. The author and licence are given under each one.',
            '**The name “O Elefante Fugiu”, the logo and the elephant mascot** are not covered by the open licences. To use them, write to us.',
          ],
        },
        {
          id: 'privacidade',
          heading: 'What’s stored in your browser',
          paragraphs: [
            'So that the site remembers your choices, your browser saves: language, colour theme, family mode (“Age”), the last era you opened and the last story from “Surprise me”. This data stays in local storage and is never sent anywhere. You can delete it in your browser settings by clearing this site’s data. If you press “Near me”, your browser will ask for permission to use your location. Your position is used only on that page and is never sent anywhere.',
          ],
        },
        {
          id: 'contagem',
          heading: 'Counting visits',
          paragraphs: ['We only count page visits, without cookies or personal data. We use GoatCounter for this; it does not record your IP address (for up to 8 hours it is kept in memory only, to tell a repeat visit apart) and does not know who you are.'],
        },
        {
          id: 'terceiros',
          heading: 'Who else is involved when you read the site',
          paragraphs: ['The site itself collects nothing about you, but it doesn’t run in a vacuum. These services see your IP address:'],
          items: [
            '**GitHub Pages** (GitHub, Inc.) serves the site’s pages and may log IP addresses under its own policy.',
            '**The map tiles** are loaded from CARTO’s servers, which see your IP address and the address of the page, like any site with a map.',
            '**GoatCounter** (goatcounter.com) counts page visits; it receives your IP address but keeps it only in memory, for up to 8 hours.',
            '**FormSubmit** (formsubmit.co) forwards your message to us if you send the “Found a mistake?” form, together with your email if you gave it. We use it only to fix the mistake and reply to you. Prefer not to use the service? Write directly to {{email}}.',
          ],
          after: ['Links to “Get directions”, sources and museum websites lead to other sites with their own rules.'],
        },
        {
          id: 'aviso',
          heading: 'Disclaimer',
          paragraphs: ['We check every story, but history is a field of debate, and mistakes are possible. This site does not replace scholarly sources. Museum opening hours and prices change: check them on the official website before you go.'],
        },
        {
          id: 'contacto',
          heading: 'Contact',
          paragraphs: [
            'Questions about licences and data, requests to remove material: {{email}}.',
            'Data controller: Artem K., Portugal, {{email}}',
          ],
        },
      ],
    },
    ru: {
      sections: [
        {
          id: 'resumo',
          heading: 'Если коротко',
          paragraphs: [],
          items: ['Тексты можно свободно использовать со ссылкой на нас.', 'У нас нет аккаунтов, куки и рекламы.', 'В вашем браузере хранятся только ваши настройки, и мы их не видим.'],
        },
        {
          id: 'licencas',
          heading: 'Что можно делать с нашими материалами',
          paragraphs: [],
          items: [
            '**Тексты** (истории, описания, надписи на сайте) распространяются по лицензии CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/deed.ru). Их можно копировать, переводить и переделывать, в том числе для экскурсий и уроков. Условия два: укажите «O Elefante Fugiu» со ссылкой и распространяйте свою версию на тех же условиях.',
            '**Код сайта** открыт по лицензии MIT.',
            '**Иллюстрации** принадлежат своим авторам. Автор и лицензия указаны под каждой.',
            '**Название «O Elefante Fugiu», логотип и слон-талисман** в свободные лицензии не входят. Чтобы использовать их, напишите нам.',
          ],
        },
        {
          id: 'privacidade',
          heading: 'Что хранится у вас в браузере',
          paragraphs: [
            'Чтобы сайт помнил ваш выбор, браузер сохраняет: язык, тему оформления, семейный режим («Возраст»), последнюю открытую эпоху и последнюю историю из «Удиви меня». Эти данные лежат в локальном хранилище и никуда не отправляются. Удалить их можно в настройках браузера, очистив данные сайта. Если вы нажмёте «Рядом со мной», браузер спросит разрешение на геолокацию. Ваше местоположение используется только на этой странице и никуда не отправляется.',
          ],
        },
        {
          id: 'contagem',
          heading: 'Подсчёт посещений',
          paragraphs: ['Мы считаем только посещения страниц, без cookie и без личных данных. Для этого используется сервис GoatCounter: он не записывает ваш IP-адрес (на время до 8 часов тот остаётся только в памяти, чтобы отличить повторный заход) и не узнаёт, кто вы.'],
        },
        {
          id: 'terceiros',
          heading: 'Кто ещё участвует, когда вы читаете сайт',
          paragraphs: ['Сайт сам ничего о вас не собирает, но он работает не в вакууме. Вот сервисы, которые видят ваш IP-адрес:'],
          items: [
            '**GitHub Pages** (GitHub, Inc.) отдаёт страницы сайта и может записывать IP-адреса по своим правилам.',
            '**Плитки карты** загружаются с серверов CARTO, которые видят ваш IP-адрес и адрес страницы, как любой сайт с картой.',
            '**GoatCounter** (goatcounter.com) считает посещения страниц; получает ваш IP-адрес, но хранит его только в памяти, до 8 часов.',
            '**FormSubmit** (formsubmit.co) пересылает нам сообщение, если вы отправите форму «Нашли ошибку?», вместе с почтой, если вы её указали. Мы используем письмо только чтобы исправить ошибку и ответить вам. Не хотите через сервис? Пишите прямо на {{email}}.',
          ],
          after: ['Ссылки «Как добраться», на источники и сайты музеев ведут на чужие сайты со своими правилами.'],
        },
        {
          id: 'aviso',
          heading: 'Оговорка',
          paragraphs: ['Мы проверяем каждую историю, но история наука спорная, и ошибки возможны. Сайт не заменяет научные источники. Часы работы и цены музеев меняются: перед поездкой проверьте их на официальном сайте.'],
        },
        {
          id: 'contacto',
          heading: 'Контакты',
          paragraphs: [
            'Вопросы о лицензиях и данных, просьбы убрать материал: {{email}}.',
            'Ответственный за обработку данных: Artem K., Португалия, {{email}}',
          ],
        },
      ],
    },
  },
};
