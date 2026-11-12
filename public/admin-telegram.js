(()=>{
const el=id=>document.getElementById(id),status=el('telegramSetupStatus');
const translations={
ru:{waiting:'Проверка настроек...',connected:'Настроено: токен бота и чат указаны. Теперь отправьте тестовое сообщение.',missing:'Telegram ещё не подключён. Добавьте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в настройках Environment сервиса Render.',volatile:'ВНИМАНИЕ: хранилище временное. Заказы могут исчезнуть при перезапуске, подключите постоянную базу.',testok:'✅ Тест доставлен в Telegram. Проверьте сообщение в вашем чате.',testfailed:'Не удалось отправить тест. Проверьте токен, правильность ID чата и нажмите /start в боте.',chatempty:'Чат не найден. Откройте своего бота в Telegram, отправьте /start и повторите поиск.',found:'Найденные чаты. Скопируйте ID нужного чата в Render → Environment → TELEGRAM_CHAT_ID:',token:'Сначала добавьте TELEGRAM_BOT_TOKEN в Environment сервиса Render.',unknown:'Ошибка связи с сервером.'},
ro:{waiting:'Verificarea configurării...',connected:'Configurat: tokenul botului și ID-ul conversației sunt setate. Trimiteți un mesaj de test.',missing:'Telegram nu este conectat. Adăugați TELEGRAM_BOT_TOKEN și TELEGRAM_CHAT_ID în setările Environment din Render.',volatile:'ATENȚIE: stocarea este temporară. Comenzile se pot pierde la repornire. Conectați o bază de date persistentă.',testok:'✅ Mesajul de test a ajuns în Telegram. Verificați conversația.',testfailed:'Mesajul de test nu a putut fi trimis. Verificați tokenul, ID-ul conversației și trimiteți /start botului.',chatempty:'Nu a fost găsită nicio conversație. Trimiteți /start botului și încercați din nou.',found:'Conversații găsite. Copiați ID-ul corect în Render → Environment → TELEGRAM_CHAT_ID:',token:'Adăugați mai întâi TELEGRAM_BOT_TOKEN în Environment din Render.',unknown:'Eroare de conexiune la server.'},
uk:{waiting:'Перевіряємо налаштування...',connected:'Налаштовано: токен бота та ID чату вказані. Надішліть тестове повідомлення.',missing:'Telegram ще не підключено. Додайте TELEGRAM_BOT_TOKEN і TELEGRAM_CHAT_ID у налаштування Environment на Render.',volatile:'УВАГА: сховище тимчасове. Замовлення можуть зникнути після перезапуску. Підключіть постійну базу даних.',testok:'✅ Тестове повідомлення доставлено в Telegram. Перевірте свій чат.',testfailed:'Не вдалося надіслати тест. Перевірте токен, ID чату та надішліть боту /start.',chatempty:'Чат не знайдено. Надішліть /start своєму боту та повторіть пошук.',found:'Знайдені чати. Скопіюйте потрібний ID у Render → Environment → TELEGRAM_CHAT_ID:',token:'Спершу додайте TELEGRAM_BOT_TOKEN у Environment на Render.',unknown:'Помилка зв’язку із сервером.'},
en:{waiting:'Checking settings...',connected:'Configured: bot token and chat ID are set. Send a test message now.',missing:'Telegram is not connected. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to your Render Environment settings.',volatile:'WARNING: Storage is temporary. Orders may disappear after a restart. Connect a persistent database.',testok:'✅ Test message delivered to Telegram. Check your chat.',testfailed:'Could not send a test message. Check the token, chat ID, and send /start to your bot.',chatempty:'No chat found. Send /start to your bot, then try again.',found:'Found chats. Copy the correct ID into Render → Environment → TELEGRAM_CHAT_ID:',token:'Add TELEGRAM_BOT_TOKEN to Render Environment first.',unknown:'Server connection failed.'}
};
function t(k){return (translations[document.getElementById('adminLanguage')?.value]||translations.ru)[k]||k}
async function request(url,method='GET'){
 const response=await fetch(url,{method,credentials:'same-origin',headers:method==='GET'?{}:{'Content-Type':'application/json'},body:method==='GET'?undefined:'{}',cache:'no-store'});
 let data;try{data=await response.json()}catch{data={error:'INVALID_RESPONSE'}}
 if(!response.ok)throw Error(data.error||'HTTP '+response.status);return data;
}
async function check(){status.textContent=t('waiting');try{
 const x=await request('/api/admin/telegram/status');
 status.textContent=(x.ready?t('connected'):t('missing'))+(x.storagePersistent?'':'\n'+t('volatile'));
}catch(e){status.textContent=e.message.startsWith('HTTP 401')?'':t('unknown')}}
async function test(){status.textContent=t('waiting');try{await request('/api/admin/telegram/test','POST');status.textContent=t('testok')}catch{status.textContent=t('testfailed')}}
async function discover(){status.textContent=t('waiting');try{
 const x=await request('/api/admin/telegram/discover');const chats=x.chats||[];
 status.textContent=chats.length?t('found')+'\n'+chats.map(x=>x.label+' ('+x.type+'): '+x.id).join('\n'):t('chatempty');
}catch(e){status.textContent=e.message==='BOT_TOKEN_MISSING'?t('token'):t('unknown')}}
el('telegramCheck')?.addEventListener('click',check);
el('telegramTest')?.addEventListener('click',test);
el('telegramDiscover')?.addEventListener('click',discover);
el('adminLanguage')?.addEventListener('change',()=>{if(status.textContent)check()});
// Avoid calling any authenticated endpoint before login; display the controls only in the admin view.
})();// Telegram token is never stored in the browser.
