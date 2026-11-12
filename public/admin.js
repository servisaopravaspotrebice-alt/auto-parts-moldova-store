const $=id=>document.getElementById(id);let items=[],page=1,total=0;const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path,{method='GET',data,raw}={}){const r=await fetch('/api/admin'+path,{method,credentials:'same-origin',headers:raw?{'Content-Type':raw.type||'text/plain'}:data===undefined?{}:{'Content-Type':'application/json'},body:raw?raw.data:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});let out;try{out=await r.json()}catch{out={error:'INVALID_SERVER_RESPONSE'}}if(!r.ok)throw Error(out.error||`HTTP ${r.status}`);return out}
function notice(msg,ok=true){const node=$('adminMessage');node.textContent=msg;node.className=ok?'notice ok':'notice'}
function loggedIn(v){$('loginView').hidden=v;$('adminView').hidden=!v;$('logout').hidden=!v;}
async function authCheck(){try{await api('/session');loggedIn(true);await refreshAll()}catch{loggedIn(false)}}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginMessage').textContent='Проверка...';const f=e.currentTarget,btn=f.querySelector('button');btn.disabled=true;try{await api('/session',{method:'POST',data:{username:$('username').value.trim(),password:$('password').value}});$('password').value='';loggedIn(true);$('loginMessage').textContent='';await refreshAll()}catch(e){$('loginMessage').textContent=e.message==='BAD_CREDENTIALS'?'Неверный логин или пароль.':e.message==='ADMIN_NOT_CONFIGURED'?'Учётная запись администратора не настроена на сервере.':'Ошибка входа: '+e.message}finally{btn.disabled=false}});
$('logout').addEventListener('click',async()=>{try{await api('/logout',{method:'POST',data:{}})}catch{}loggedIn(false);$('username').value='';$('password').value='';items=[];notice('')});
for(const b of document.querySelectorAll('[data-tab]'))b.addEventListener('click',()=>{const k=b.dataset.tab;for(const t of document.querySelectorAll('[data-tab]'))t.classList.toggle('active',t.dataset.tab===k);for(const s of document.querySelectorAll('.tab'))s.hidden=s.id!==`tab-${k}`});
async function refreshAll(){await Promise.allSettled([getStatus(),getProducts(),getReviews()])}
async function getStatus(){const x=await api('/status');$('adminSummary').textContent=`Всего: ${x.products} · В каталоге: ${x.visible} · База: ${x.store} · Постоянное хранение: ${x.persistent?'да':'нет'}`;$('importStatus').textContent=(x.import?.busy?'Импорт выполняется. ':'Импорт не выполняется. ')+(x.progress?.phase||'')+'\nОбработано: '+Number(x.progress?.processed||0)+' из '+Number(x.progress?.total||0)+' · Ошибок: '+Number(x.progress?.failed||0)+(x.import?.error?'\nОшибка: '+x.import.error:'')+(x.import?.lastSuccess?'\nПоследняя успешная загрузка: '+x.import.lastSuccess:'');$('ratesStatus').textContent=JSON.stringify({rates:x.rates,rateSync:x.rateSync},null,2)}
async function getProducts(){const q=$('adminSearch').value;const r=await api('/products?q='+encodeURIComponent(q)+'&page='+page);items=r.items||[];total=r.total;$('productsPage').textContent=`Страница ${page} из ${Math.max(1,Math.ceil(total/40))} · ${total} товаров`;$('productsPrev').disabled=page<=1;$('productsNext').disabled=page*40>=total;$('adminProducts').innerHTML=items.map(p=>`<tr><td><strong>${safe(p.name)}</strong><small>${safe(p.brand)} · ${safe(p.condition)}${p.hidden?' · скрыто':''}${p.deleted?' · удалено':''}</small></td><td>${safe(p.sku)}</td><td>${p.customer_price_ron==null?'По запросу':Math.round(p.customer_price_ron)+' RON'}</td><td><button type="button" data-edit="${safe(p.id)}">Изменить</button>${p.deleted?`<button type="button" data-restore="${safe(p.id)}">Восстановить</button>`:`<button type="button" data-delete="${safe(p.id)}" class="danger-outline">Удалить</button>`}</td></tr>`).join('');for(const x of document.querySelectorAll('[data-edit]'))x.onclick=()=>editProduct(x.dataset.edit);for(const x of document.querySelectorAll('[data-delete]'))x.onclick=()=>deleteProduct(x.dataset.delete);for(const x of document.querySelectorAll('[data-restore]'))x.onclick=()=>restoreProduct(x.dataset.restore)}
$('adminSearch').addEventListener('input',()=>{page=1;getProducts().catch(e=>notice(e.message,false))});$('productsPrev').onclick=()=>{page=Math.max(1,page-1);getProducts()};$('productsNext').onclick=()=>{page++;getProducts()};
function editProduct(id){const x=items.find(p=>p.id===id);if(!x)return;$('productId').value=x.id;$('prodName').value=x.name||'';$('prodBrand').value=x.brand||'';$('prodModel').value=x.model||'';$('prodSku').value=x.sku||'';$('prodCategory').value=x.category||'other';$('prodCondition').value=x.condition||'unknown';$('prodPrice').value=x.source==='dedauto'?(x.price_override_ron??''):(x.price_ron??'');$('prodDiscount').value=x.discount_percent||0;$('prodImage').value=x.image||'';$('prodDescription').value=x.description||'';$('prodHidden').checked=!!x.hidden;window.scrollTo({top:0,behavior:'smooth'});notice('Редактирование: '+x.name)}
function resetProduct(){for(const x of ['productId','prodName','prodBrand','prodModel','prodSku','prodPrice','prodImage','prodDescription'])$(x).value='';$('prodCategory').value='other';$('prodCondition').value='new';$('prodDiscount').value='0';$('prodHidden').checked=false}$('productReset').onclick=resetProduct;
$('productForm').addEventListener('submit',async e=>{e.preventDefault();const id=$('productId').value;const data={name:$('prodName').value.trim(),brand:$('prodBrand').value.trim(),model:$('prodModel').value.trim(),sku:$('prodSku').value.trim(),category:$('prodCategory').value,condition:$('prodCondition').value,discount_percent:Number($('prodDiscount').value)||0,image:$('prodImage').value.trim(),description:$('prodDescription').value.trim(),hidden:$('prodHidden').checked};if(id)data.price_override_ron=$('prodPrice').value.trim()||null;else data.price_ron=$('prodPrice').value.trim()||null;try{await api(id?'/products/'+encodeURIComponent(id):'/products',{method:id?'PATCH':'POST',data});resetProduct();await getProducts();notice('Товар сохранён.')}catch(e){notice(e.message,false)}});
async function deleteProduct(id){if(!confirm('Скрыть и удалить этот товар из публичного каталога?'))return;try{await api('/products/'+encodeURIComponent(id),{method:'DELETE'});await getProducts();notice('Товар удалён из каталога')}catch(e){notice(e.message,false)}}
async function restoreProduct(id){try{await api('/products/'+encodeURIComponent(id)+'/restore',{method:'POST',data:{}});await getProducts();notice('Товар восстановлен')}catch(e){notice(e.message,false)}}
// Choose the direction explicitly; the server receives only the signed, validated percentage.
let bulkDirection='increase';
const bulkInput=$('bulkPercent');
const formatRon=value=>Number(value).toLocaleString('ru-RU',{maximumFractionDigits:2})+' RON';
function chosenBulkPercent(){
 const raw=bulkInput.value.trim().replace(',','.');
 const amount=Number(raw);
 const limit=bulkDirection==='increase'?100:50;
 if(!raw||!Number.isFinite(amount)||amount<=0||amount>limit||Math.round(amount*10)!==amount*10){
  throw Error(`Введите число больше 0 и не больше ${limit}%, с шагом 0,1%.`);
 }
 return bulkDirection==='increase'?amount:-amount;
}
function updateBulkDescription(){
 for(const [id,direction] of [['bulkIncrease','increase'],['bulkDecrease','decrease']]){
  const active=bulkDirection===direction;
  $(id).classList.toggle('selected',active);
  $(id).setAttribute('aria-pressed',String(active));
 }
 bulkInput.max=bulkDirection==='increase'?'100':'50';
 const val=Number(bulkInput.value);
 if(val>Number(bulkInput.max))bulkInput.value=String(bulkInput.max);
 const amount=bulkInput.value.trim().replace(',','.');
 $('bulkOperationText').textContent=bulkDirection==='increase'?
  `Повысить цены на ${amount||'…'}% по всему каталогу.`:
  `Снизить цены на ${amount||'…'}% по всему каталогу.`;
 $('bulkOperationText').classList.toggle('decrease',bulkDirection==='decrease');
 $('bulkResults').textContent='Нажмите «Посмотреть изменения», чтобы увидеть цены до и после.';
}
$('bulkIncrease').addEventListener('click',()=>{bulkDirection='increase';updateBulkDescription()});
$('bulkDecrease').addEventListener('click',()=>{bulkDirection='decrease';updateBulkDescription()});
bulkInput.addEventListener('input',updateBulkDescription);
updateBulkDescription();
function showBulkPreview(r,percent){
 const examples=Array.isArray(r.examples)?r.examples:[];
 const result=$('bulkResults');
 const verb=percent>0?'повышения':'снижения';
 const rows=examples.map(p=>`<tr><td>${safe(p.name)}</td><td>${formatRon(p.before)}</td><td class="bulk-arrow">→</td><td><b>${formatRon(p.after)}</b></td></tr>`).join('');
 result.innerHTML=`<h3>Предпросмотр ${verb} цен</h3><div class="bulk-summary">Будет изменено товаров: ${Number(r.affected)||0}. Корректировка: ${percent>0?'+':''}${percent}%.</div>${rows?`<div class="table-scroll"><table><thead><tr><th>Запчасть</th><th>Было</th><th></th><th>Станет</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<p>Нет товаров с указанной ценой.</p>'}<p class="hint">Показаны примеры. Пока вы не подтвердите операцию, цены не изменятся.</p>`;
}
async function previewBulk(){
 let pct;
 try{pct=chosenBulkPercent()}catch(e){notice(e.message,false);$('bulkResults').textContent=e.message;return null}
 try{
  const r=await api('/prices/bulk',{method:'POST',data:{percent:pct,preview:true}});
  showBulkPreview(r,pct);return {r,pct};
 }catch(e){notice(e.message,false);$('bulkResults').textContent='Не удалось рассчитать предпросмотр: '+e.message;return null}
}
$('bulkPreview').onclick=previewBulk;
$('bulkForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const preview=await previewBulk();if(!preview)return;
 const {r,pct}=preview;
 if(!r.affected)return notice('Нет товаров с ценой для изменения.',false);
 const text=(pct>0?`Повысить цены на ${pct}%`:`Снизить цены на ${Math.abs(pct)}%`);
 if(!confirm(`${text} для ${r.affected} товаров?\n\nОперация изменяет цены каталога и может быть отменена кнопкой «Отменить последнее изменение».`))return;
 $('bulkApply').disabled=true;
 try{
  await api('/prices/bulk',{method:'POST',data:{percent:pct,confirm:true}});
  await refreshAll();notice(`${text} — изменение выполнено.`);
  $('bulkResults').textContent=`Готово: ${text.toLowerCase()} для ${r.affected} товаров.`;
 }catch(err){notice(err.message,false)}finally{$('bulkApply').disabled=false}
});
$('bulkUndo').onclick=async()=>{
 if(!confirm('Отменить последнее изменение цен во всём каталоге?'))return;
 try{await api('/prices/undo',{method:'POST',data:{confirm:true}});await refreshAll();notice('Последнее изменение цен отменено.');$('bulkResults').textContent='Последнее изменение цен отменено.'}catch(e){notice(e.message,false)}
};
$('reviewForm').addEventListener('submit',async e=>{e.preventDefault();if(!$('revVerified').checked)return notice('Необходимо подтвердить достоверность отзыва.',false);try{await api('/reviews',{method:'POST',data:{name:$('revName').value.trim(),rating:Number($('revRating').value),text:$('revText').value.trim(),language:$('revLang').value,published:$('revPublished').checked,verified:true,translateAutomatically:$('revTranslate').checked}});$('reviewForm').reset();await getReviews();notice('Отзыв сохранён.')}catch(e){notice(e.message,false)}});
async function getReviews(){const r=await api('/reviews');$('adminReviews').innerHTML=(r.items||[]).map(x=>`<div class="row"><strong>${safe(x.name)}</strong> · ${x.rating}★ · ${safe(x.language)} · ${x.published?'опубликован':'скрыт'}<button type="button" class="danger-outline" data-del-review="${safe(x.id)}">Удалить</button><p style="width:100%">${safe(x.text)}</p></div>`).join('')||'<p>Отзывов пока нет.</p>';for(const b of document.querySelectorAll('[data-del-review]'))b.onclick=async()=>{if(!confirm('Удалить отзыв?'))return;try{await api('/reviews/'+encodeURIComponent(b.dataset.delReview),{method:'DELETE'});await getReviews();notice('Отзыв удалён')}catch(e){notice(e.message,false)}}}
$('startSync').onclick=async()=>{try{await api('/sync',{method:'POST',data:{}});notice('Импорт запущен. Проверяйте результат в разделе «Импорт».');await getStatus()}catch(e){notice(e.message,false)}};$('refreshStatus').onclick=()=>getStatus().catch(e=>notice(e.message,false));$('ratesSync').onclick=async()=>{try{const r=await api('/rates',{method:'POST',data:{}});$('ratesStatus').textContent=JSON.stringify(r,null,2);notice(r.ok?'Курсы проверены':'Источник курсов временно недоступен',r.ok)}catch(e){notice(e.message,false)}};
$('feedUpload').onclick=async()=>{const file=$('feedFile').files?.[0];if(!file)return notice('Выберите XML или CSV файл.',false);if(file.size>11e6)return notice('Файл слишком большой.',false);const ext=file.name.toLowerCase().endsWith('.csv')?'csv':'xml';try{const t=await file.text();const r=await api('/import?format='+ext,{method:'POST',raw:{type:'text/plain',data:t}});notice('Загружено: '+JSON.stringify(r.report));await refreshAll()}catch(e){notice(e.message,false)}};
authCheck();
