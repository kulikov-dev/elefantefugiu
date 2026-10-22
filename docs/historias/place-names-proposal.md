# Предложение: локализованные названия мест (на подтверждение)

Данные историй **не менялись**. Код уже умеет читать два необязательных поля; пока их нет, сайт ведёт себя как раньше (с запасным вариантом для краткого названия города).

## Что добавляется в схему (уже в коде, необязательные)

- `place.short` — краткое название места (город или область) на трёх языках. Показывается на карточках в ленте, на витрине, в списках и на карте: «1515 · Лиссабон». Полное `place.name` остаётся только в заголовке страницы истории.
- `bridge.title` — название «моста в сегодня» на трёх языках. Показывается жирным; под ним мелко остаётся `bridge.name` (португальское, как на табличке). Если `title` совпадает с `name` (pt), мелкая строка не показывается.

Запасной вариант без `place.short`: часть `place.name` до первой запятой или скобки («Lisboa, Paço da Ribeira (hoje Praça do Comércio)» даёт «Lisboa»). В русском интерфейсе это «Lisboa», то есть без `short` по-русски город не появится.

Пример записи в YAML карточки:

```yaml
place:
  name: Lisboa, Paço da Ribeira (hoje Praça do Comércio)
  short: { pt: Lisboa, en: Lisbon, ru: Лиссабон }
  lat: 38.7075
  lon: -9.1364
bridge:
  name: Torre de Belém (guarita com o rinoceronte)
  title:
    pt: Torre de Belém (guarita com o rinoceronte)
    en: Belém Tower (the sentry box with the rhinoceros)
    ru: Беленская башня (башенка с носорогом)
```

Для карточки с `ru_ready: true` русский вариант обязателен (проверка данных потребует его).

## Предлагаемые значения для 13 карточек

| Карточка | `place.short` (pt / en / ru) | `bridge.title` en | `bridge.title` ru |
| --- | --- | --- | --- |
| aljubarrota-1385 | Aljubarrota / Aljubarrota / Алжубарроту | Aljubarrota Battle Interpretation Centre (CIBA) | Центр интерпретации битвы при Алжубарроте (CIBA) |
| tripeiros-1415 | Porto / Porto / Порту | Monument by Lagoa Henriques (1960) near the old Ouro shipyards | Памятник работы Лагоа Энрикиша (1960) у бывших верфей Оуру |
| cantino-1502 | Lisboa / Lisbon / Лиссабон | Maritime Museum (copy of the Cantino map) | Морской музей (копия карты Кантино) |
| elefantes-malaca-1511 | Malaca / Malacca / Малакка | Monument to Afonso de Albuquerque (Belém) | Памятник Афонсу де Албукерки (Белен) |
| rinoceronte-1515 | Lisboa / Lisbon / Лиссабон | Belém Tower (the sentry box with the rhinoceros) | Беленская башня (башенка с носорогом) |
| terramoto-1755 | Lisboa / Lisbon / Лиссабон | Carmo Archaeological Museum (ruins of the Carmo Convent) | Археологический музей Кармо (руины монастыря Кармо) |
| douro-1756 | Vale do Douro / Douro Valley / Долина Дору | 17•56 Museum and Wine Library of the Real Companhia Velha (Gaia quay) | Музей и энотека «17•56» компании Реал-Компанья-Велья (набережная Гайи) |
| motim-companhia-1757 | Porto / Porto / Порту | то же, что у douro-1756 | то же, что у douro-1756 |
| casa-da-neve-1782 | Lisboa / Lisbon / Лиссабон | Café Martinho da Arcada | Кафе «Мартиньо да Аркада» |
| guerra-laranjas-1801 | Alto Alentejo / Upper Alentejo / Алту-Алентежу | Elvas, the fortress town that stopped Godoy (World Heritage Site) | Эльваш, крепость, остановившая Годоя (Всемирное наследие) |
| ponte-das-barcas-1809 | Porto / Porto / Порту | Alminhas da Ponte shrine (Ribeira, Porto) | Часовня Алминьяш-да-Понте (Рибейра, Порту) |
| torres-vedras-1810 | Sobral de Monte Agraço / Sobral de Monte Agraço / Собраль-де-Монте-Аграсу | Lines of Torres Vedras Interpretation Centre (São Vicente Fort) | Центр интерпретации линий Торриш-Ведраш (форт Сан-Висенте) |
| legiao-portuguesa-1812 | Borodino / Borodino / Бородино | Lisbon Military Museum | Лиссабонский военный музей |

В колонке `bridge.title` для pt берётся текущее `bridge.name` без изменений. Русские названия — мои предложения, их нужно вычитать (особенно транскрипции: Алжубарроту, Алминьяш-да-Понте, Собраль-де-Монте-Аграсу, Торриш-Ведраш).

После подтверждения вношу значения в YAML (ничего другого в данных не трогаю) отдельным коммитом.
