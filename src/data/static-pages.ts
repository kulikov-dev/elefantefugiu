// Texts of the static pages: About, Method and sources, Legal information (docs/spec.md 5.6), in the three languages.
// The Portuguese and Russian wording is written for a native speaker to read through; the facts it states are those of the
// project as it is built (labels, age marks, sources, licences, what the browser stores). Items marked in docs/STATE.md
// ("Páginas estáticas: o que o dono do projeto deve confirmar") are statements only the owner can confirm.
//
// Inline markup: {{about}} {{method}} {{report}} {{legal}} {{map}} link to a page of the site (the link text is the
// title of that page); {{email}} is the contact address as a link. Everything else is plain text.
import type { Lang } from '../i18n/routes';

export const CONTACT_EMAIL = 'elefantefugiu@gmail.com';

export interface Section {
  /** Anchor of the section (the same in every language). */
  id: string;
  heading: string;
  paragraphs: string[];
  /** A list after the paragraphs. */
  items?: string[];
}

export interface StaticPage {
  /** The opening paragraph, shown larger. */
  lead: string;
  sections: Section[];
}

export type StaticKey = 'about' | 'method' | 'legal';

export const STATIC_PAGES: Record<StaticKey, Record<Lang, StaticPage>> = {
  about: {
    pt: {
      lead: 'O Elefante Fugiu conta a história de Portugal em pequenas histórias interativas, ligadas ao mapa e ao tempo. Cada uma cabe num minuto de leitura e diz-lhe onde pode ir ver o lugar hoje.',
      sections: [
        {
          id: 'o-que-e',
          heading: 'O que é',
          paragraphs: [
            'Escolhe uma época, segue um fio (o mar, a comida e o vinho, o poder e a revolta, a gente como nós, a natureza) ou abre o mapa. Cada história tem três camadas, e só abre as que quiser:',
          ],
          items: [
            'Gancho: uma frase para espicaçar a curiosidade.',
            'História: o essencial em poucas linhas, para ler num minuto.',
            'Mais: contexto, fontes e a ponte para hoje, o lugar que pode visitar.',
          ],
        },
        {
          id: 'para-quem',
          heading: 'Para quem é',
          paragraphs: [
            'Para quem gosta de história mas não tem tempo para um manual, para famílias que passeiam com crianças e para quem viaja por Portugal e quer saber o que aconteceu naquele sítio. O modo família esconde as histórias com idade mínima ou temas pesados; está no cabeçalho de todas as páginas.',
          ],
        },
        {
          id: 'foi-aqui',
          heading: '«Foi aqui»',
          paragraphs: [
            'Cada história aponta para um lugar real que pode visitar hoje: uma igreja, um miradouro, um museu, uma rua. É a «ponte para hoje». O mapa mostra esses lugares, e a ligação «Como chegar» abre-os num mapa aberto (OpenStreetMap), sem recorrer a serviços comerciais.',
          ],
        },
        {
          id: 'estado',
          heading: 'Em que ponto está',
          paragraphs: [
            'O projeto está em construção. Três épocas estão preparadas (Avis e os Descobrimentos, Pombal e o Terramoto, o Estado Novo e o 25 de Abril); as restantes aparecem como «Em breve». Os textos que ainda são de ensaio vêm marcados como «Texto de teste» e não são história verificada.',
          ],
        },
        {
          id: 'quem-faz',
          heading: 'Quem faz',
          paragraphs: [
            'É um projeto independente, gratuito e sem publicidade. Os textos são escritos pela equipa do projeto, e cada história regista quem a reviu e quando. Se tem formação em história, arqueologia ou património e quer rever uma época, escreva-nos.',
          ],
        },
        {
          id: 'ajudar',
          heading: 'Como ajudar',
          paragraphs: [
            'Encontrou um erro, uma data duvidosa ou um lugar que mudou? Diga-nos em {{report}}. Também pode partilhar uma história com quem lhe pareça interessar, ou sugerir uma que falte: escreva para {{email}}.',
          ],
        },
        {
          id: 'contacto',
          heading: 'Contacto',
          paragraphs: ['{{email}}. Mais sobre o método em {{method}} e sobre licenças e privacidade em {{legal}}.'],
        },
      ],
    },
    en: {
      lead: 'O Elefante Fugiu tells the history of Portugal in short interactive stories tied to the map and to time. Each takes about a minute to read and tells you where you can go and see the place today.',
      sections: [
        {
          id: 'o-que-e',
          heading: 'What it is',
          paragraphs: [
            'Pick an era, follow a thread (the sea, food and wine, power and revolt, people like us, nature) or open the map. Each story has three layers, and you open only the ones you want:',
          ],
          items: [
            'Hook: one line to catch your curiosity.',
            'Story: the essentials in a few lines, a one-minute read.',
            'More: context, sources and the bridge to today, a place you can visit.',
          ],
        },
        {
          id: 'para-quem',
          heading: 'Who it is for',
          paragraphs: [
            'For people who like history but have no time for a textbook, for families walking with children, and for anyone travelling in Portugal who wants to know what happened in that very spot. Family mode hides stories with a minimum age or a heavy topic; it sits in the header of every page.',
          ],
        },
        {
          id: 'foi-aqui',
          heading: '“Foi aqui” (it happened here)',
          paragraphs: [
            'Every story points to a real place you can visit today: a church, a viewpoint, a museum, a street. That is the “bridge to today”. The map shows these places, and the “Get directions” link opens them in an open map (OpenStreetMap), without commercial services.',
          ],
        },
        {
          id: 'estado',
          heading: 'Where the project stands',
          paragraphs: [
            'The project is under construction. Three eras are prepared (Avis and the Discoveries, Pombal and the Earthquake, the Estado Novo and 25 April); the others show as “Coming soon”. Texts that are still drafts are marked “Test text” and are not verified history.',
          ],
        },
        {
          id: 'quem-faz',
          heading: 'Who makes it',
          paragraphs: [
            'It is an independent project, free and without advertising. The texts are written by the project team, and each story records who reviewed it and when. If you have a background in history, archaeology or heritage and would like to review an era, write to us.',
          ],
        },
        {
          id: 'ajudar',
          heading: 'How to help',
          paragraphs: [
            'Found a mistake, a doubtful date or a place that has changed? Tell us at {{report}}. You can also share a story with someone who might like it, or suggest one that is missing: write to {{email}}.',
          ],
        },
        {
          id: 'contacto',
          heading: 'Contact',
          paragraphs: ['{{email}}. More about the method at {{method}} and about licences and privacy at {{legal}}.'],
        },
      ],
    },
    ru: {
      lead: 'O Elefante Fugiu рассказывает историю Португалии короткими интерактивными историями, привязанными к карте и ко времени. На каждую уходит около минуты, и в конце сказано, куда сходить и увидеть это место сегодня.',
      sections: [
        {
          id: 'o-que-e',
          heading: 'Что это',
          paragraphs: [
            'Выберите эпоху, пойдите по нити (море, еда и вино, власть и бунт, люди как мы, природа) или откройте карту. У каждой истории три слоя, раскрывайте только те, что нужны:',
          ],
          items: [
            'Крючок: одна фраза, чтобы разжечь любопытство.',
            'История: самое важное в нескольких строках, читать минуту.',
            'Подробнее: контекст, источники и мост в сегодня, место, которое можно посетить.',
          ],
        },
        {
          id: 'para-quem',
          heading: 'Для кого',
          paragraphs: [
            'Для тех, кто любит историю, но не хочет учебника; для семей, которые гуляют с детьми; для путешественников по Португалии, которым интересно, что происходило именно здесь. Семейный режим скрывает истории с возрастным ограничением и тяжёлыми темами; он в шапке каждой страницы.',
          ],
        },
        {
          id: 'foi-aqui',
          heading: '«Foi aqui» («это было здесь»)',
          paragraphs: [
            'Каждая история указывает на настоящее место, которое можно посетить сегодня: церковь, смотровую площадку, музей, улицу. Это «мост в сегодня». На карте видны эти места, а ссылка «Как добраться» открывает их в открытой карте (OpenStreetMap), без коммерческих сервисов.',
          ],
        },
        {
          id: 'estado',
          heading: 'На каком этапе проект',
          paragraphs: [
            'Проект в разработке. Готовы три эпохи (Авис и Великие открытия, Помбал и землетрясение, Эштаду Нову и 25 апреля), остальные пока помечены «Скоро». Тексты, которые ещё черновые, помечены «Тестовый текст» и не являются проверенной историей.',
          ],
        },
        {
          id: 'quem-faz',
          heading: 'Кто делает',
          paragraphs: [
            'Это независимый бесплатный проект без рекламы. Тексты пишет команда проекта, а у каждой истории указано, кто её проверил и когда. Если вы историк, археолог или специалист по наследию и готовы проверить эпоху, напишите нам.',
          ],
        },
        {
          id: 'ajudar',
          heading: 'Как помочь',
          paragraphs: [
            'Нашли ошибку, сомнительную дату или место, которое изменилось? Сообщите на странице «{{report}}». Можно также поделиться историей с тем, кому она может быть интересна, или предложить ту, которой не хватает: напишите на {{email}}.',
          ],
        },
        {
          id: 'contacto',
          heading: 'Контакты',
          paragraphs: ['{{email}}. О методе подробнее на странице «{{method}}», о лицензиях и приватности на странице «{{legal}}».'],
        },
      ],
    },
  },

  method: {
    pt: {
      lead: 'Esta página explica como as histórias são escolhidas, verificadas e etiquetadas, para que saiba o quanto confiar em cada uma.',
      sections: [
        {
          id: 'etiquetas',
          heading: 'Documentado, lenda ou discutido',
          paragraphs: ['Cada história traz uma etiqueta de credibilidade. A etiqueta tem sempre texto e símbolo, nunca apenas cor.'],
          items: [
            'Documentado: o facto assenta em fontes da época ou em estudos que os historiadores aceitam. As fontes estão listadas na história.',
            'Lenda: uma tradição contada há muito tempo, que pode não ter prova. Contamo-la como lenda, sem a apresentar como facto.',
            'Discutido: os historiadores discordam, ou as fontes são contraditórias. Dizemos o que se sabe e onde está a dúvida.',
          ],
        },
        {
          id: 'datas-fontes',
          heading: 'Datas e fontes',
          paragraphs: [
            'Cada acontecimento principal indica pelo menos duas fontes, e cada história pelo menos uma. Prefere-se fontes primárias, estudos académicos, arquivos e sítios oficiais de museus e monumentos. Quando as fontes divergem na data, indicamos o intervalo ou escrevemos «cerca de».',
            'Cada história mostra a data em que foi verificada pela última vez.',
          ],
        },
        {
          id: 'numeros',
          heading: 'Números e estimativas',
          paragraphs: [
            'Quando os números são estimativas (por exemplo, o tamanho de um exército), mostramos um intervalo e dizemo-lo, nunca um valor único com falsa precisão. Os números de ensaio estão marcados como inventados.',
          ],
        },
        {
          id: 'idades',
          heading: 'Idade mínima e temas pesados',
          paragraphs: [
            'As histórias para todas as idades não têm etiqueta de idade. As etiquetas 12+ e 16+ indicam a idade a partir da qual recomendamos a leitura. Uma história sobre um tema difícil (violência, perseguição, morte) leva o aviso «Tema pesado» e, antes de abrir, um ecrã que pergunta se quer continuar.',
            'O modo família, no cabeçalho, tem três posições: tudo; só histórias para todas as idades; histórias para todas as idades e 12+. Os temas pesados ficam fora das duas últimas. Sem JavaScript, o modo não existe e todas as histórias ficam visíveis.',
          ],
        },
        {
          id: 'revisao',
          heading: 'Revisão',
          paragraphs: [
            'Cada história publicada regista quem a reviu e em que data. Os textos têm limites de tamanho (o gancho até 12 palavras, a história entre 40 e 70, o contexto até 150) e são verificados automaticamente antes de cada publicação, tal como as ligações, as etiquetas e as imagens.',
          ],
        },
        {
          id: 'imagens',
          heading: 'Imagens',
          paragraphs: [
            'Cada imagem indica o autor e a licença. Se uma ilustração for criada com ajuda de inteligência artificial, a legenda di-lo.',
          ],
        },
        {
          id: 'correcoes',
          heading: 'Correções',
          paragraphs: [
            'Se encontrar um erro, use {{report}}. Corrigimos o texto e atualizamos a data de verificação. Os endereços das histórias não mudam.',
          ],
        },
        {
          id: 'idiomas',
          heading: 'Idiomas',
          paragraphs: [
            'O original é em português de Portugal; há versões em inglês e em russo. Uma história ainda não traduzida para russo aparece em inglês, com um aviso. Mais sobre licenças em {{legal}}.',
          ],
        },
      ],
    },
    en: {
      lead: 'This page explains how stories are chosen, checked and labelled, so that you know how far to trust each one.',
      sections: [
        {
          id: 'etiquetas',
          heading: 'Documented, legend or debated',
          paragraphs: ['Every story carries a credibility label. The label always has a word and a symbol, never colour alone.'],
          items: [
            'Documented: the fact rests on sources from the time or on studies that historians accept. The sources are listed in the story.',
            'Legend: a tradition told for a long time that may have no proof. We tell it as a legend and do not present it as fact.',
            'Debated: historians disagree, or the sources contradict each other. We say what is known and where the doubt lies.',
          ],
        },
        {
          id: 'datas-fontes',
          heading: 'Dates and sources',
          paragraphs: [
            'Every key event names at least two sources, and every story at least one. We prefer primary sources, academic studies, archives and the official sites of museums and monuments. When the sources disagree on a date we give the range or write “around”.',
            'Every story shows the date it was last checked.',
          ],
        },
        {
          id: 'numeros',
          heading: 'Numbers and estimates',
          paragraphs: [
            'When numbers are estimates (for example the size of an army) we show a range and say so, never a single value with false precision. Test numbers are marked as invented.',
          ],
        },
        {
          id: 'idades',
          heading: 'Minimum age and heavy topics',
          paragraphs: [
            'Stories for all ages carry no age label. The 12+ and 16+ labels give the age from which we recommend reading. A story about a difficult topic (violence, persecution, death) carries the “Heavy topic” notice and, before it opens, a screen asking whether you want to continue.',
            'Family mode, in the header, has three positions: everything; only stories for all ages; stories for all ages and 12+. Heavy topics stay out of the last two. Without JavaScript the mode does not exist and every story is visible.',
          ],
        },
        {
          id: 'revisao',
          heading: 'Review',
          paragraphs: [
            'Every published story records who reviewed it and on what date. Texts have size limits (the hook up to 12 words, the story 40 to 70, the context up to 150) and are checked automatically before each release, together with links, labels and images.',
          ],
        },
        {
          id: 'imagens',
          heading: 'Images',
          paragraphs: ['Every image names its author and licence. If an illustration is made with the help of artificial intelligence, the caption says so.'],
        },
        {
          id: 'correcoes',
          heading: 'Corrections',
          paragraphs: ['If you find a mistake, use {{report}}. We correct the text and update the check date. The addresses of stories do not change.'],
        },
        {
          id: 'idiomas',
          heading: 'Languages',
          paragraphs: [
            'The original is in European Portuguese; there are versions in English and Russian. A story not yet translated into Russian appears in English, with a notice. More about licences at {{legal}}.',
          ],
        },
      ],
    },
    ru: {
      lead: 'Здесь объяснено, как мы выбираем, проверяем и помечаем истории, чтобы вы понимали, насколько каждой можно доверять.',
      sections: [
        {
          id: 'etiquetas',
          heading: 'Документально, легенда или спорно',
          paragraphs: ['У каждой истории есть метка достоверности. Метка всегда состоит из слова и значка, а не только из цвета.'],
          items: [
            'Документально: факт опирается на источники эпохи или на исследования, которые признают историки. Источники перечислены в истории.',
            'Легенда: предание, которое рассказывают давно и которое может не иметь доказательств. Мы рассказываем его как легенду и не выдаём за факт.',
            'Спорно: историки расходятся во мнениях, или источники противоречат друг другу. Мы пишем, что известно и где сомнение.',
          ],
        },
        {
          id: 'datas-fontes',
          heading: 'Даты и источники',
          paragraphs: [
            'У каждого главного события не меньше двух источников, у каждой истории не меньше одного. Мы предпочитаем первоисточники, научные работы, архивы и официальные сайты музеев и памятников. Если источники расходятся в дате, мы пишем диапазон или «около».',
            'У каждой истории указана дата последней проверки.',
          ],
        },
        {
          id: 'numeros',
          heading: 'Числа и оценки',
          paragraphs: [
            'Если числа это оценки (например, численность армии), мы показываем диапазон и говорим об этом, а не одно число с ложной точностью. Тестовые числа помечены как выдуманные.',
          ],
        },
        {
          id: 'idades',
          heading: 'Возраст и тяжёлые темы',
          paragraphs: [
            'У историй для всех возрастов нет возрастной метки. Метки 12+ и 16+ показывают, с какого возраста мы рекомендуем читать. История на трудную тему (насилие, преследования, смерть) получает пометку «Тяжёлая тема» и, перед тем как открыться, экран с вопросом, хотите ли вы продолжить.',
            'Семейный режим в шапке имеет три положения: всё; только истории для всех возрастов; истории для всех возрастов и 12+. Тяжёлые темы не попадают в два последних. Без JavaScript режима нет, и все истории видны.',
          ],
        },
        {
          id: 'revisao',
          heading: 'Проверка',
          paragraphs: [
            'У каждой опубликованной истории записано, кто её проверил и когда. У текстов есть ограничения по длине (крючок до 12 слов, история 40-70 слов, контекст до 150), и перед каждой публикацией они проверяются автоматически, как и ссылки, метки и изображения.',
          ],
        },
        {
          id: 'imagens',
          heading: 'Изображения',
          paragraphs: ['У каждого изображения указаны автор и лицензия. Если иллюстрация создана с помощью искусственного интеллекта, в подписи об этом сказано.'],
        },
        {
          id: 'correcoes',
          heading: 'Исправления',
          paragraphs: ['Если вы нашли ошибку, воспользуйтесь страницей «{{report}}». Мы исправим текст и обновим дату проверки. Адреса историй не меняются.'],
        },
        {
          id: 'idiomas',
          heading: 'Языки',
          paragraphs: [
            'Оригинал написан на европейском португальском; есть версии на английском и русском. История, ещё не переведённая на русский, показывается по-английски с пометкой. О лицензиях подробнее на странице «{{legal}}».',
          ],
        },
      ],
    },
  },

  legal: {
    pt: {
      lead: 'Em resumo: o código e os textos são livres, não usamos cookies nem rastreadores, e só guardamos no seu navegador as suas preferências.',
      sections: [
        {
          id: 'licencas',
          heading: 'Licenças',
          paragraphs: ['Cada parte do projeto tem a sua licença:'],
          items: [
            'Código: licença MIT.',
            'Textos (histórias, descrições, textos da interface): Creative Commons Atribuição-CompartilhaIgual 4.0 (CC BY-SA 4.0). Pode copiar e adaptar, desde que indique «O Elefante Fugiu» com uma ligação e partilhe a obra derivada com a mesma licença.',
            'Imagens: cada imagem indica o autor e a licença junto a si. Mantêm a sua própria licença.',
            'O nome do projeto, o logótipo e a mascote (o elefante) não estão cobertos pela licença MIT nem pela CC BY-SA.',
          ],
        },
        {
          id: 'privacidade',
          heading: 'Privacidade',
          paragraphs: [
            'Não há contas, cookies, rastreadores nem publicidade. Não recolhemos dados pessoais ao ler o site.',
            'O que fica no seu navegador (armazenamento local, nunca enviado para lado nenhum): o idioma escolhido, o tema claro ou escuro, o modo família, a última época visitada e a última história de «Surpreende-me». Pode apagá-lo a qualquer momento nas definições do navegador. Sem eles, o site funciona na mesma.',
            'Quem aloja: as páginas são servidas pelo GitHub Pages (GitHub, Inc.), que pode registar o endereço IP dos pedidos, conforme a sua própria política de privacidade.',
            'Mapa: nas páginas com mapa, o seu navegador pede os mosaicos do mapa a um servidor de mapas (OpenStreetMap ou o fornecedor indicado na atribuição do mapa), que recebe o seu endereço IP. «Como chegar» abre openstreetmap.org só se clicar.',
            'Aviso de erro: se enviar o formulário de {{report}}, a sua mensagem e, se a indicar, a sua morada de e-mail seguem por e-mail para a equipa através do serviço FormSubmit (formsubmit.co), que a encaminha. Usamo-la só para corrigir o erro e responder-lhe. Se preferir, escreva diretamente para {{email}}.',
            'Ligações externas (sítios oficiais de museus e monumentos, fontes) abrem outros sítios, com as suas próprias políticas.',
          ],
        },
        {
          id: 'aviso',
          heading: 'Aviso',
          paragraphs: [
            'Fazemos o possível por verificar cada história, mas a história é um assunto em debate e pode haver erros. O conteúdo é informativo e não substitui a consulta de fontes e especialistas. Os textos marcados como «Texto de teste» são provisórios e não são história verificada. Informações práticas sobre locais (horários, acessos) podem mudar: confirme-as no sítio oficial antes de visitar.',
          ],
        },
        {
          id: 'contacto',
          heading: 'Contacto',
          paragraphs: ['Dúvidas sobre licenças, privacidade ou pedidos de remoção de conteúdo: {{email}}.'],
        },
      ],
    },
    en: {
      lead: 'In short: the code and the texts are free, we use no cookies or trackers, and the only thing stored in your browser is your preferences.',
      sections: [
        {
          id: 'licencas',
          heading: 'Licences',
          paragraphs: ['Each part of the project has its own licence:'],
          items: [
            'Code: MIT licence.',
            'Texts (stories, descriptions, interface texts): Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0). You may copy and adapt them, as long as you credit “O Elefante Fugiu” with a link and share the derived work under the same licence.',
            'Images: each image names its author and licence next to it. They keep their own licence.',
            'The project name, the logo and the mascot (the elephant) are not covered by the MIT licence or by CC BY-SA.',
          ],
        },
        {
          id: 'privacidade',
          heading: 'Privacy',
          paragraphs: [
            'There are no accounts, cookies, trackers or advertising. We collect no personal data when you read the site.',
            'What stays in your browser (local storage, never sent anywhere): the language you chose, the light or dark theme, family mode, the last era you visited and the last “Surprise me” story. You can delete it at any time in your browser settings. Without it the site works just the same.',
            'Hosting: the pages are served by GitHub Pages (GitHub, Inc.), which may log the IP address of requests under its own privacy policy.',
            'Map: on pages with a map your browser requests map tiles from a map server (OpenStreetMap or the provider named in the map attribution), which receives your IP address. “Get directions” opens openstreetmap.org only if you click it.',
            'Mistake reports: if you send the {{report}} form, your message and, if you give one, your email address travel by email to the team through the FormSubmit service (formsubmit.co), which forwards it. We use it only to correct the mistake and to reply to you. If you prefer, write directly to {{email}}.',
            'External links (official sites of museums and monuments, sources) open other sites, with their own policies.',
          ],
        },
        {
          id: 'aviso',
          heading: 'Disclaimer',
          paragraphs: [
            'We do our best to check each story, but history is a matter of debate and there may be mistakes. The content is informative and does not replace consulting sources and specialists. Texts marked “Test text” are provisional and are not verified history. Practical information about places (opening hours, access) can change: confirm it on the official site before you visit.',
          ],
        },
        {
          id: 'contacto',
          heading: 'Contact',
          paragraphs: ['Questions about licences or privacy, or requests to remove content: {{email}}.'],
        },
      ],
    },
    ru: {
      lead: 'Коротко: код и тексты свободные, мы не используем куки и трекеры, а в вашем браузере хранятся только ваши настройки.',
      sections: [
        {
          id: 'licencas',
          heading: 'Лицензии',
          paragraphs: ['У каждой части проекта своя лицензия:'],
          items: [
            'Код: лицензия MIT.',
            'Тексты (истории, описания, тексты интерфейса): Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0). Их можно копировать и изменять, если указать «O Elefante Fugiu» со ссылкой и распространять производную работу на тех же условиях.',
            'Изображения: рядом с каждым указаны автор и лицензия. У них своя лицензия.',
            'Название проекта, логотип и талисман (слон) не покрываются ни лицензией MIT, ни CC BY-SA.',
          ],
        },
        {
          id: 'privacidade',
          heading: 'Приватность',
          paragraphs: [
            'У нас нет аккаунтов, куки, трекеров и рекламы. Мы не собираем личные данные, когда вы читаете сайт.',
            'В вашем браузере (локальное хранилище, оно никуда не отправляется) остаются: выбранный язык, светлая или тёмная тема, семейный режим, последняя посещённая эпоха и последняя история из «Удиви меня». Это можно удалить в любой момент в настройках браузера. Без них сайт работает так же.',
            'Хостинг: страницы отдаёт GitHub Pages (GitHub, Inc.), который может записывать IP-адреса запросов согласно собственной политике приватности.',
            'Карта: на страницах с картой браузер запрашивает плитки карты у сервера карт (OpenStreetMap или поставщика, названного в подписи карты), и этот сервер получает ваш IP-адрес. Ссылка «Как добраться» открывает openstreetmap.org, только если вы по ней перейдёте.',
            'Сообщение об ошибке: если вы отправите форму на странице «{{report}}», ваше сообщение и, если вы его укажете, адрес вашей почты уйдут команде по электронной почте через сервис FormSubmit (formsubmit.co), который перешлёт их. Мы используем их только чтобы исправить ошибку и ответить вам. Если хотите, пишите прямо на {{email}}.',
            'Внешние ссылки (официальные сайты музеев и памятников, источники) открывают другие сайты с их собственными правилами.',
          ],
        },
        {
          id: 'aviso',
          heading: 'Предупреждение',
          paragraphs: [
            'Мы стараемся проверять каждую историю, но история это предмет споров, и ошибки возможны. Содержимое носит информационный характер и не заменяет источники и специалистов. Тексты с пометкой «Тестовый текст» временные и не являются проверенной историей. Практические сведения о местах (часы работы, проезд) могут меняться: перед визитом проверьте их на официальном сайте.',
          ],
        },
        {
          id: 'contacto',
          heading: 'Контакты',
          paragraphs: ['Вопросы о лицензиях и приватности, просьбы убрать материал: {{email}}.'],
        },
      ],
    },
  },
};
