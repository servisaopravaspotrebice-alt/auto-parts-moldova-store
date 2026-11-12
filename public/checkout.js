// Cart checkout: one Telegram order with verified products, quantities, amounts and client phone.
const CHECKOUT_STRINGS={
 ro:{title:'Trimite comanda',name:'Nume (opțional)',phone:'Număr de telefon *',vin:'VIN (opțional)',consent:'Sunt de acord să fiu contactat pentru această comandă',submit:'Trimite comanda',empty:'Adăugați cel puțin o piesă în coș.',sent:'Comanda a fost trimisă consultantului. Număr: ',unavailable:'Cererea a fost salvată, dar notificarea Telegram nu este configurată încă. Pentru urgențe, sunați-ne.',error:'Nu am putut trimite notificarea. Vă rugăm să sunați consultantul.',sending:'Se trimite...'},
 ru:{title:'Оформление заказа',name:'Ваше имя (необязательно)',phone:'Номер телефона *',vin:'VIN (необязательно)',consent:'Согласен на обработку данных для связи по заказу',submit:'ОТПРАВИТЬ ЗАКАЗ',empty:'Добавьте хотя бы одну запчасть в корзину.',sent:'Заказ передан консультанту. Номер: ',unavailable:'Заявка сохранена, но отправка в Telegram пока не настроена. Вы можете позвонить консультанту.',error:'Не удалось передать заказ. Позвоните консультанту.',sending:'Отправляем...'},
 uk:{title:'Оформлення замовлення',name:'Імʼя (необовʼязково)',phone:'Номер телефону *',vin:'VIN (необовʼязково)',consent:'Згоден на обробку даних для звʼязку щодо замовлення',submit:'НАДІСЛАТИ ЗАМОВЛЕННЯ',empty:'Додайте хоча б одну запчастину до кошика.',sent:'Замовлення надіслано консультанту. Номер: ',unavailable:'Заявку збережено, але Telegram ще не налаштовано. Зателефонуйте консультанту.',error:'Не вдалося надіслати замовлення. Зателефонуйте консультанту.',sending:'Надсилаємо...'},
 en:{title:'Place your order',name:'Name (optional)',phone:'Phone number *',vin:'VIN (optional)',consent:'I agree to be contacted about this order',submit:'SEND ORDER',empty:'Add at least one part to your cart.',sent:'Your request was sent to our consultant. Order: ',unavailable:'Your request is saved, but Telegram delivery is not yet configured. Please call our consultant.',error:'Could not send order. Please call our consultant.',sending:'Sending...'}
};
const CART_NEW_STRINGS={
 ro:{admin:'Intrare administrator',help:'Confirmăm disponibilitatea, compatibilitatea și prețul la telefon.',total:'Total',noItems:'piese'},
 ru:{admin:'Вход для администратора',help:'Консультант позвонит, чтобы подтвердить наличие, совместимость и цену.',total:'Итого',noItems:'товаров'},
 uk:{admin:'Вхід для адміністратора',help:'Консультант зателефонує для підтвердження наявності, сумісності та ціни.',total:'Разом',noItems:'товарів'},
 en:{admin:'Administrator login',help:'A consultant will call to confirm availability, compatibility and price.',total:'Total',noItems:'items'}
};
const checkoutForm=document.getElementById('cartCheckout');
function checkoutTranslate(){const d=CHECKOUT_STRINGS[lang]||CHECKOUT_STRINGS.ro;for(const [id,value] of [['checkoutTitle','title'],['checkoutNameLabel','name'],['checkoutPhoneLabel','phone'],['checkoutVinLabel','vin'],['checkoutConsentText','consent'],['checkoutSubmit','submit']]){const el=document.getElementById(id);if(el)el.textContent=d[value]}const x=CART_NEW_STRINGS[lang]||CART_NEW_STRINGS.ro;for(const [id,key] of [['adminFooterLink','admin'],['checkoutHelp','help'],['cartTotalLabel','total']]){const el=document.getElementById(id);if(el)el.textContent=x[key]};const el=document.getElementById('cartCountLabel');if(el)el.textContent=String(cart.reduce((s,a)=>s+a.qty,0))+' '+x.noItems}
checkoutTranslate();document.getElementById('language').addEventListener('change',checkoutTranslate);
checkoutForm.addEventListener('submit',async e=>{
 e.preventDefault();const d=CHECKOUT_STRINGS[lang]||CHECKOUT_STRINGS.ro,status=document.getElementById('checkoutStatus'),submit=document.getElementById('checkoutSubmit');
 if(!cart.length){status.textContent=d.empty;return}
 const phone=document.getElementById('checkoutPhone').value.trim(),vin=document.getElementById('checkoutVin').value.trim().toUpperCase();
 if(!/^\+?[\d ()-]{7,22}$/.test(phone)||phone.replace(/\D/g,'').length<8){status.textContent=d.phone;return}
 if(vin&&!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)){status.textContent='VIN: 17 characters (excluding I, O, Q)';return}
 submit.disabled=true;submit.textContent=d.sending;status.textContent='';
 try{const r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('checkoutName').value.trim(),phone,vin,cart:cart.map(x=>({id:x.id,qty:x.qty})),currency:curr,language:lang,consent:document.getElementById('checkoutConsent').checked})});const payload=await r.json();
 if(!r.ok){status.textContent=payload.saved?d.unavailable+' № '+(payload.orderId||''):d.error;return}
 status.textContent=d.sent+payload.orderId;cart=[];saveCart();renderCart();checkoutForm.querySelectorAll('input:not([type=checkbox])').forEach(input=>input.value='');document.getElementById('checkoutConsent').checked=false;
 }catch{status.textContent=d.error}finally{submit.disabled=false;checkoutTranslate()}
});
