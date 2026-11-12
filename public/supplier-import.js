'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const previewForm=$('sourcePreviewForm');if(!previewForm)return;
 let lastPreview=null;
 const message=(s)=>{if(typeof notice==='function')notice(s)};
 const toUrl=()=>String($('externalSiteUrl').value||'').trim();
 const explainError=raw=>window.supplierImportError?.(raw)||{title:'Не удалось проверить сайт',explanation:'Сканер не получил каталог.',action:'Проверьте адрес или используйте CSV/XML.'};
 function showScanError(raw){
  const d=explainError(raw);$('sourceDiagnostic').hidden=false;
  $('sourceErrorTitle').textContent=d.title;
  $('sourceErrorExplanation').textContent=d.explanation;
  $('sourceErrorAction').textContent='Что делать: '+d.action;
  $('sourceDiagnostic').scrollIntoView({behavior:'smooth',block:'center'});
 }
 function clearScanError(){$('sourceDiagnostic').hidden=true;}

 function example(p){const card=document.createElement('div');card.className='source-product';if(p.image){const image=document.createElement('img');image.loading='lazy';image.alt=p.name||'';image.referrerPolicy='no-referrer';image.src=p.image;card.append(image)}const b=document.createElement('b');b.textContent=p.name||'Товар';card.append(b);const line=document.createElement('span');line.textContent=p.price_ron==null?'Цена по запросу':`${Math.round(p.price_ron).toLocaleString('ru-RU')} RON`;card.append(line);return card}
 function showPreview(out,url,markup){lastPreview={url,markup};$('sourcePreview').hidden=false;$('sourceRights').checked=false;$('sourceImportBtn').disabled=true;$('sourceSummary').textContent=`Найдено карточек: ${out.found||0} · Источник: ${out.website||url} · Примеров: ${(out.examples||[]).length}`;const grid=$('sourcePreviewsGrid');grid.replaceChildren(...(out.examples||[]).map(example));if(!out.examples?.length){const line=document.createElement('p');line.textContent='Не удалось получить примеры товара. Проверьте адрес и доступность сайта.';grid.append(line)}$('sourcePreview').scrollIntoView({behavior:'smooth',block:'start'});}
 previewForm.addEventListener('submit',async e=>{e.preventDefault();lastPreview=null;$('sourceImportBtn').disabled=true;const url=toUrl(),markup=Number($('externalMarkup').value);$('sourcePreviewBtn').disabled=true;clearScanError();$('sourceSummary').textContent='Сканирование…';try{const r=await api('/sources/preview',{method:'POST',data:{url,markup}});showPreview(r,url,markup);message('Сайт проверен. Просмотрите примеры и подтвердите разрешение на импорт.')}catch(err){$('sourcePreview').hidden=true;showScanError(err);notice(explainError(err).title,false)}finally{$('sourcePreviewBtn').disabled=false}});
 $('sourceRights').addEventListener('change',()=>{$('sourceImportBtn').disabled=!$('sourceRights').checked||!lastPreview});
 $('sourceImportBtn').addEventListener('click',async()=>{if(!lastPreview||!$('sourceRights').checked)return; if(!confirm('Загрузить товары этого поставщика с наценкой '+lastPreview.markup+'%?'))return;const url=lastPreview.url,markup=lastPreview.markup;$('sourceImportBtn').disabled=true;try{await api('/sources/import',{method:'POST',data:{url,markup,rightsConfirmed:true,confirm:true}});$('externalJobPanel').hidden=false;notice('Импорт запущен. Статус отображается ниже.');await refresh();}catch(e){notice('Ошибка импорта: '+e.message,false);$('sourceImportBtn').disabled=false}});
 function paint(data){const job=data.job||{},busy=!!job.busy;$('externalJobPanel').hidden=!(busy||job.lastSuccess||job.error);$('sourceJobPhase').textContent=job.phase||'Ожидание';const pct=job.total?Math.round(job.processed/job.total*100):0;$('sourceJobPct').textContent=pct+'%';$('sourceJobProgress').value=pct;$('sourceJobNumbers').textContent=`Найдено: ${job.total||job.found||0} · Обработано: ${job.processed||0} · Добавлено: ${job.added||0} · Обновлено: ${job.updated||0} · Ошибок: ${job.failed||0}`;const e=$('sourceJobErrors');e.hidden=!job.error&&!(job.errors||[]).length;if(!e.hidden)e.textContent=[job.error,...(job.errors||[]).map(x=>typeof x==='string'?x:x.error)].filter(Boolean).slice(0,5).map(x=>explainError(x).title).join(' · ');const wrap=$('sourceHistory');wrap.replaceChildren();if(!(data.suppliers||[]).length){wrap.textContent='Другие поставщики пока не добавлены.';return}for(const site of data.suppliers){const p=document.createElement('div');p.className='source-site';const b=document.createElement('b');b.textContent=site.website;const small=document.createElement('small');small.textContent=`Наценка: ${site.markup}% · Последняя загрузка: ${site.lastSync||'—'} · Товаров: ${site.products||0}`;p.append(b,small);wrap.append(p)}}
 async function refresh(){try{paint(await api('/sources/status'))}catch(e){if(e.message!=='LOGIN_REQUIRED')console.warn(e)}}
 $('sourceRefresh').addEventListener('click',refresh);
 let feedPreview=null;
 $('externalFeedPreview').addEventListener('click',async()=>{
  const file=$('externalFeedFile').files?.[0],url=toUrl(),markup=Number($('externalMarkup').value);
  if(!file)return notice('Выберите CSV или XML-файл другого поставщика.',false);
  if(!url.startsWith('https://'))return notice('Укажите HTTPS-адрес сайта поставщика над полем файла.',false);
  if(file.size>11_000_000)return notice('Файл должен быть не больше 11 МБ.',false);
  $('externalFeedPreview').disabled=true;$('externalFeedImport').disabled=true;
  try{
   const raw=await file.text();const query=new URLSearchParams({site:url,markup:String(markup),preview:'true'});
   const out=await api('/sources/upload?'+query.toString(),{method:'POST',raw:{type:'text/plain',data:raw}});
   feedPreview={url,markup,raw};$('externalFeedResults').textContent=`Найдено товаров: ${out.found}. Без цены: ${out.unpriced}. Пример: ${(out.examples||[]).map(p=>p.name).slice(0,2).join(' · ')}`;
   $('externalFeedImport').disabled=!$('sourceRights').checked;
   $('sourcePreview').hidden=false;$('sourceSummary').textContent=`Проверка выгрузки: ${out.found} товаров.`;
   $('sourcePreviewsGrid').replaceChildren(...(out.examples||[]).map(example));
   notice('Файл проверен. Подтвердите право на данные и импорт.');
  }catch(e){feedPreview=null;showScanError(e);notice(explainError(e).title,false)}finally{$('externalFeedPreview').disabled=false}
 });
 $('externalFeedImport').addEventListener('click',async()=>{
  if(!feedPreview||!$('sourceRights').checked)return notice('Подтвердите права на каталог.',false);
  if(!confirm('Импортировать товары из этого файла?'))return;
  $('externalFeedImport').disabled=true;
  try{const query=new URLSearchParams({site:feedPreview.url,markup:String(feedPreview.markup),confirm:'true',rightsConfirmed:'true'});
   const out=await api('/sources/upload?'+query.toString(),{method:'POST',raw:{type:'text/plain',data:feedPreview.raw}});
   notice(`Загрузка завершена: добавлено ${out.report.added}, обновлено ${out.report.updated}.`);feedPreview=null;await refresh();await getProducts();
  }catch(e){showScanError(e);notice(explainError(e).title,false)}
 });
 $('sourceRights').addEventListener('change',()=>{$('externalFeedImport').disabled=!$('sourceRights').checked||!feedPreview});

 let tick=0;setInterval(()=>{tick++;if(tick%2===0&& !$('tab-import').hidden&& !$('adminView').hidden)refresh()},2500);
 document.querySelector('[data-tab="import"]')?.addEventListener('click',refresh); // Refresh when opened
})();
