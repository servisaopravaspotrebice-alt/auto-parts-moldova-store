// User-facing, non-technical diagnostics for external supplier imports.
// This file runs before supplier-import.js in the closed administrator page.
'use strict';
(function (root) {
  const docs = {
    NO_PRODUCT_LINKS_FOUND: {
      title: 'Не найдены ссылки на запчасти',
      explanation: 'Сканер не обнаружил на проверенных страницах ссылки на карточки товаров. Возможно, каталог загружается через JavaScript или использует нестандартные адреса.',
      action: 'Укажите прямую ссылку на категорию или sitemap.xml. Если товары по-прежнему не находятся, попросите поставщика предоставить CSV/XML или API.'
    },
    SOURCE_ACCESS_RESTRICTED: {
      title: 'Сайт ограничивает автоматический доступ',
      explanation: 'Сайт поставщика не разрешил серверу прочитать страницы каталога. Такое бывает при защите от роботов, проверке входа или ограничении частых запросов.',
      action: 'Откройте сайт в обычном браузере. Для импорта используйте официальную выгрузку CSV/XML или API, полученные у поставщика.'
    },
    SOURCE_HTTP_403: {title:'Доступ к сайту запрещён (403)', explanation:'Сервер поставщика запретил автоматическое чтение страницы.', action:'Запросите у поставщика выгрузку CSV/XML или API.'},
    SOURCE_HTTP_401: {title:'Требуется авторизация на сайте поставщика (401)', explanation:'Каталог недоступен без входа в аккаунт.',action:'Получите разрешённую выгрузку через кабинет поставщика и загрузите её сюда.'},
    SOURCE_HTTP_429: {title:'Слишком много запросов (429)',explanation:'Сайт временно ограничил частоту автоматических обращений.', action:'Попробуйте позднее или загрузите каталог через CSV/XML.'},
    SOURCE_HTTP_404: {title:'Страница не найдена (404)',explanation:'Указанный адрес каталога не существует либо был изменён.',action:'Проверьте URL и попробуйте адрес рабочей категории или файл sitemap.xml.'},
    SOURCE_HTTP_503: {title:'Сайт поставщика временно недоступен (503)',explanation:'Сервер не смог получить страницу каталога.',action:'Попробуйте позже или импортируйте файл CSV/XML.'},
    SOURCE_TIMEOUT: {title:'Сайт слишком долго не отвечает',explanation:'Сервер поставщика не прислал ответ за отведённое время.',action:'Попробуйте сканирование позднее или укажите более узкую категорию.'},
    SOURCE_SCAN_UNAVAILABLE: {title:'Не удалось прочитать каталог поставщика',explanation:'Все доступные способы чтения страниц завершились ошибкой. Причина может быть на стороне сайта или сети.',action:'Проверьте адрес в браузере. Если сайт открывается, используйте выгрузку CSV/XML или доступ к API.'},
    URL_INVALID: {title:'Неправильный адрес сайта',explanation:'Адрес введён не в формате ссылки.',action:'Введите полный адрес, например https://example.com/catalog/.'},
    PUBLIC_HTTPS_URL_REQUIRED: {title:'Разрешены только публичные HTTPS-ссылки',explanation:'Нельзя сканировать ссылки без HTTPS, локальные адреса или адреса с логином и паролем.',action:'Используйте публичный адрес сайта, начинающийся с https://.'},
    HOST_NOT_PUBLIC: {title:'Адрес недоступен для внешнего сканирования',explanation:'Адрес ведёт на внутреннюю сеть или не имеет публичного сетевого адреса.',action:'Укажите публичный HTTPS-адрес магазина.'},
    SOURCE_PAGE_TOO_LARGE: {title:'Страница слишком большая',explanation:'Размер ответа превышает допустимый размер для сканирования.',action:'Укажите конкретную категорию или используйте CSV/XML выгрузку.'},
    NOT_TEXT_RESOURCE: {title:'Это не страница каталога',explanation:'Ссылка ведёт на ресурс, формат которого сканер не может прочитать.',action:'Укажите HTML-каталог, XML/CSV или файл sitemap.xml.'},
    TOO_MANY_REDIRECTS: {title:'Слишком много перенаправлений',explanation:'Сайт несколько раз перенаправил сканер на другие адреса.',action:'Откройте сайт в браузере и скопируйте конечный HTTPS-адрес категории.'},
    CROSS_DOMAIN_REDIRECT_BLOCKED: {title:'Сайт перенаправил запрос на другой домен',explanation:'Для безопасности автоматический переход на сторонний домен остановлен.',action:'Используйте конечную официальную ссылку на каталог.'},
    NO_VALID_PRODUCTS_IN_FEED: {title:'В файле не найдены корректные товары',explanation:'CSV/XML-файл не содержит распознаваемых карточек с названием и ссылкой.',action:'Проверьте поля name/title, url/link, price и image.'},
    IMPORT_IN_PROGRESS: {title:'Другой импорт ещё выполняется',explanation:'Сканер обрабатывает запущенную ранее загрузку.',action:'Дождитесь её завершения и нажмите «Обновить статус».'},
    LOGIN_REQUIRED: {title:'Необходимо войти в админ-панель',explanation:'Время действия сессии администратора закончилось.',action:'Войдите ещё раз, затем повторите сканирование.'}
  };
  function normalize(raw) {
    const value=String(raw?.message || raw?.error || raw || '').trim();
    if (!value) return 'SOURCE_SCAN_UNAVAILABLE';
    if(value.includes('SITE_DNS_ERROR')) return 'SITE_DNS_ERROR';
    if(value.includes('SITE_TLS_ERROR')) return 'SITE_TLS_ERROR';
    const http=value.match(/SOURCE_HTTP_(\d{3})/);
    if (http) return 'SOURCE_HTTP_'+http[1];
    const known=Object.keys(docs).find(code=>value.includes(code));
    if (known) return known;
    if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(value)) return 'SITE_DNS_ERROR';
    if (/CERT_|SSL|TLS|UNABLE_TO_VERIFY_LEAF_SIGNATURE/i.test(value)) return 'SITE_TLS_ERROR';
    if (/ETIMEDOUT|ECONNRESET|ESOCKETTIMEDOUT/i.test(value)) return 'SOURCE_TIMEOUT';
    return 'SOURCE_SCAN_UNAVAILABLE';
  }
  function explain(raw){
    const code=normalize(raw);
    if(code==='SITE_DNS_ERROR')return {code,title:'Сайт не найден',explanation:'Адрес сайта не удалось найти в интернете. Возможно, опечатка или временная ошибка DNS.',action:'Проверьте написание адреса и откройте его в браузере.'};
    if(code==='SITE_TLS_ERROR')return {code,title:'Ошибка защищённого соединения',explanation:'Сайт не удалось проверить по HTTPS из-за ошибки сертификата.',action:'Проверьте адрес и исправность HTTPS на сайте поставщика.'};
    if(/^SOURCE_HTTP_\d+$/.test(code)&&!docs[code])return {code,title:'Сайт ответил ошибкой '+code.slice(-3),explanation:'Сервер поставщика не отдал запрошенную страницу.',action:'Проверьте адрес или используйте выгрузку CSV/XML.'};
    return {code,...(docs[code]||docs.SOURCE_SCAN_UNAVAILABLE)};
  }
  root.supplierImportError=explain;
})(window);
