/* Interactive OCR overlay: tap/drag over text on a VIN photo, then insert. */
(()=>{
'use strict';
const core=window.VinLensCore;
const input=document.getElementById('vin');
const openButton=document.getElementById('vinLensOpen');
if(!core||!input||!openButton)return;
const language=()=>document.getElementById('language')?.value||'ro';
const strings={
 ro:{title:'Selectează VIN-ul din fotografie',help:'Fotografiază VIN-ul sau alege o imagine. Apasă pe cuvintele recunoscute ori glisează peste text, ca într-un scanner de text.',camera:'📷 Cameră',gallery:'▧ Din galerie',placeholder:'Încarcă o fotografie. Textul identificat va putea fi selectat direct de pe imagine.',ready:'Fotografia este pregătită. Recunoaștem textul…',loading:'Se recunoaște textul pe dispozitiv…',found:'Selectează cuvintele din imagine sau alege un VIN detectat.',notFound:'Nu am găsit o serie sigură. Selectează textul sau corectează-l manual mai jos.',error:'Recunoașterea nu a reușit. Poți introduce codul manual sau încerca o fotografie mai clară.',select:'Text selectat (îl poți corecta)',insert:'Inserează în câmpul VIN',clear:'Șterge selecția',invalid:'Verifică seria: un VIN are 17 caractere fără I, O, Q. Poți corecta textul.',added:'Text adăugat. Verifică seria înainte de trimitere.',empty:'Alege sau scrie codul înainte de inserare.',close:'Închide',allText:'Text OCR — apasă o linie pentru a selecta',big:'Imaginea poate avea cel mult 15 MB.',candidate:'VIN detectat:',barcode:'Cod identificat:'},
 ru:{title:'Выберите VIN на фотографии',help:'Сфотографируйте VIN или выберите фото. Нажимайте на распознанные слова либо проведите пальцем по строке — как при выделении текста в Google Объективе.',camera:'📷 Камера',gallery:'▧ Из галереи',placeholder:'Выберите фотографию. Распознанный текст можно будет выделять прямо на изображении.',ready:'Фотография загружена. Подготавливаем распознавание…',loading:'Распознаём текст на вашем устройстве…',found:'Выделите нужную строку на фото или выберите найденный VIN.',notFound:'Точный VIN не найден. Выделите строку или исправьте текст вручную ниже.',error:'Не получилось распознать текст. Можно ввести номер вручную или сделать более чёткое фото.',select:'Выбранный текст (можно исправить)',insert:'Вставить в поле VIN',clear:'Снять выделение',invalid:'Проверьте номер: VIN содержит 17 символов без I, O, Q. При необходимости исправьте вручную.',added:'Текст вставлен. Проверьте символы перед отправкой заявки.',empty:'Выделите или введите номер перед вставкой.',close:'Закрыть',allText:'Найденные строки — нажмите для выбора',big:'Максимальный размер фото — 15 МБ.',candidate:'Найден VIN:',barcode:'Найден штрихкод:'},
 uk:{title:'Виберіть VIN на фотографії',help:'Сфотографуйте VIN або виберіть фото. Натискайте на розпізнані слова чи проведіть пальцем по рядку, щоб вибрати текст.',camera:'📷 Камера',gallery:'▧ Із галереї',placeholder:'Оберіть фотографію. Розпізнаний текст можна буде виділити безпосередньо на зображенні.',ready:'Фото завантажено. Готуємо розпізнавання…',loading:'Розпізнаємо текст на вашому пристрої…',found:'Виділіть потрібний рядок або виберіть знайдений VIN.',notFound:'Точний VIN не знайдено. Виділіть рядок або виправте текст вручну нижче.',error:'Не вдалося розпізнати текст. Можна ввести номер вручну або зробити чіткіше фото.',select:'Вибраний текст (можна виправити)',insert:'Вставити в поле VIN',clear:'Очистити вибір',invalid:'Перевірте VIN: 17 символів без I, O, Q. За потреби виправте.',added:'Текст вставлено. Перевірте символи перед надсиланням.',empty:'Виділіть або введіть код перед вставленням.',close:'Закрити',allText:'Знайдені рядки — натисніть для вибору',big:'Максимальний розмір фото — 15 МБ.',candidate:'Знайдено VIN:',barcode:'Знайдено штрихкод:'},
 en:{title:'Select VIN text from your photo',help:'Take a photo or select an image. Tap recognized words or drag across the text to select it, similar to an image text scanner.',camera:'📷 Camera',gallery:'▧ Photo library',placeholder:'Choose a photo. You will be able to select recognized text directly on the image.',ready:'Photo ready. Preparing recognition…',loading:'Recognizing text on your device…',found:'Select the correct text on the image or pick a detected VIN.',notFound:'No reliable VIN found. Select words or edit the text below.',error:'Could not recognize text. Enter the number manually or try a clearer photo.',select:'Selected text (editable)',insert:'Insert into VIN field',clear:'Clear selection',invalid:'Check the VIN: 17 characters, excluding I, O and Q. Edit if needed.',added:'Text inserted. Verify the characters before sending.',empty:'Select or enter the number before inserting.',close:'Close',allText:'Recognized lines — tap to select',big:'Maximum photo size is 15 MB.',candidate:'Detected VIN:',barcode:'Detected barcode:'}
};
let text=()=>strings[language()]||strings.ro;
const markup=`<div class="vl-shell">
 <div class="vl-top"><h2 id="vlHeading"></h2><button type="button" class="vl-close" id="vlClose" aria-label="Close">×</button></div>
 <div class="vl-help" id="vlHelp"></div>
 <div class="vl-source"><button type="button" class="vl-action" id="vlCameraBtn"></button><button type="button" class="vl-action" id="vlGalleryBtn"></button><input type="file" id="vlCamera" accept="image/*" capture="environment" hidden><input type="file" id="vlGallery" accept="image/*" hidden></div>
 <div class="vl-preview" id="vlPreview"><div class="vl-placeholder" id="vlPlaceholder"></div><div class="vl-picture" id="vlPicture" hidden><img id="vlImage" alt="VIN photo"><div class="vl-overlay" id="vlOverlay"></div><div class="vl-selection-box" id="vlDragBox"></div></div><div class="vl-plain-text" id="vlLines" hidden></div>
 <div class="vl-status" id="vlStatus" role="status" aria-live="polite"></div>
 <div class="vl-bottom"><div class="vl-extracted" id="vlCandidates"></div><label for="vlText" id="vlTextLabel"></label><textarea id="vlText" class="vl-text" spellcheck="false" autocapitalize="characters" rows="1" maxlength="80"></textarea><div class="vl-commands"><button type="button" id="vlClear" class="vl-secondary"></button><button type="button" id="vlApply" class="vl-primary"></button></div></div>
</div>`;
const dialog=document.createElement('dialog');dialog.id='vinLensDialog';dialog.className='vl-dialog';dialog.setAttribute('aria-labelledby','vlHeading');dialog.innerHTML=markup;document.body.appendChild(dialog);
const el=id=>document.getElementById(id);
const image=el('vlImage'),picture=el('vlPicture'),overlay=el('vlOverlay'),lines=el('vlLines'),selectedText=el('vlText'),status=el('vlStatus'), candidates=el('vlCandidates');
const state={words:[],selected:new Set(),photoUrl:null,requestSerial:0,drag:null,ignoreNextClick:false,worker:null};
function translate(){let s=text();for(const [key,id] of Object.entries({title:'vlHeading',help:'vlHelp',camera:'vlCameraBtn',gallery:'vlGalleryBtn',placeholder:'vlPlaceholder',select:'vlTextLabel',insert:'vlApply',clear:'vlClear'}))el(id).textContent=s[key];el('vlClose').setAttribute('aria-label',s.close)}
function setStatus(v){status.textContent=v}
function open(){translate();if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');setStatus('');}
function close(){if(dialog.open&&typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open')}
openButton.addEventListener('click',open);
el('vlClose').addEventListener('click',close);
dialog.addEventListener('click',e=>{if(e.target===dialog)close()});
el('vlCameraBtn').addEventListener('click',()=>el('vlCamera').click());
el('vlGalleryBtn').addEventListener('click',()=>el('vlGallery').click());
function clearSelection(){state.selected.clear();selectedText.value='';overlay.querySelectorAll('.vl-word').forEach(btn=>btn.setAttribute('aria-pressed','false'))}
el('vlClear').addEventListener('click',clearSelection);
function pickText(txt){selectedText.value=String(txt||'').toUpperCase().trim().slice(0,80);state.selected.clear();overlay.querySelectorAll('.vl-word').forEach(btn=>btn.setAttribute('aria-pressed','false'))}
function chooseWords(){const words=[...state.selected].sort((a,b)=>a-b).map(i=>state.words[i]?.text||'');selectedText.value=words.join(' ').trim()}
function toggleWord(index){if(state.selected.has(index))state.selected.delete(index);else state.selected.add(index);const b=overlay.querySelector(`[data-vl-word="${index}"]`);if(b)b.setAttribute('aria-pressed',String(state.selected.has(index)));chooseWords()}
function renderWords(naturalWidth,naturalHeight){overlay.replaceChildren();state.words.forEach((w,index)=>{
 const b=document.createElement('button');b.type='button';b.className='vl-word';b.dataset.vlWord=String(index);b.title=w.text;b.setAttribute('aria-label',w.text);b.setAttribute('aria-pressed','false');
 const box=w.bbox;
 b.style.left=`${Math.max(0,box.x0/naturalWidth*100)}%`;b.style.top=`${Math.max(0,box.y0/naturalHeight*100)}%`;
 b.style.width=`${Math.min(100,Math.max(.6,(box.x1-box.x0)/naturalWidth*100))}%`;
 b.style.height=`${Math.min(100,Math.max(.7,(box.y1-box.y0)/naturalHeight*100))}%`;
 b.addEventListener('click',()=>{if(state.ignoreNextClick){state.ignoreNextClick=false;return}toggleWord(index)});
 overlay.appendChild(b)
 });
}
function localPos(event){const r=picture.getBoundingClientRect();return {x:Math.max(0,Math.min(r.width,event.clientX-r.left)),y:Math.max(0,Math.min(r.height,event.clientY-r.top))}}
function dragRect(a,b){return {x0:Math.min(a.x,b.x),y0:Math.min(a.y,b.y),x1:Math.max(a.x,b.x),y1:Math.max(a.y,b.y)}}
function drawBox(a,b){const r=dragRect(a,b),box=el('vlDragBox');Object.assign(box.style,{display:'block',left:r.x0+'px',top:r.y0+'px',width:(r.x1-r.x0)+'px',height:(r.y1-r.y0)+'px'})}
picture.addEventListener('pointerdown',e=>{if(!state.words.length||e.button>0)return;const a=localPos(e);state.drag={id:e.pointerId,start:a,last:a,moved:false};});
picture.addEventListener('pointermove',e=>{const d=state.drag;if(!d||d.id!==e.pointerId)return;d.last=localPos(e);if(Math.hypot(d.last.x-d.start.x,d.last.y-d.start.y)>8)d.moved=true;if(d.moved)drawBox(d.start,d.last)});
function endDrag(e){const d=state.drag;if(!d||d.id!==e.pointerId)return;state.drag=null;el('vlDragBox').style.display='none';if(!d.moved)return;
 const area=dragRect(d.start,d.last),r=picture.getBoundingClientRect();if(!r.width||!r.height)return;
 state.selected.clear();state.words.forEach((w,i)=>{const box=w.bbox;const mapped={x0:box.x0/image.naturalWidth*r.width,y0:box.y0/image.naturalHeight*r.height,x1:box.x1/image.naturalWidth*r.width,y1:box.y1/image.naturalHeight*r.height};if(core.intersects(mapped,area))state.selected.add(i)});
 overlay.querySelectorAll('.vl-word').forEach(b=>b.setAttribute('aria-pressed',String(state.selected.has(Number(b.dataset.vlWord)))));
 chooseWords();state.ignoreNextClick=true;setTimeout(()=>{state.ignoreNextClick=false},250);
}
picture.addEventListener('pointerup',endDrag);picture.addEventListener('pointercancel',()=>{state.drag=null;el('vlDragBox').style.display='none'});
function addCandidate(label,value){const b=document.createElement('button');b.type='button';b.className='vl-chip';b.textContent=label+' '+value;b.addEventListener('click',()=>pickText(value));candidates.appendChild(b)}
function addFallbackLines(fullText){lines.replaceChildren();const linesList=String(fullText||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,30);if(state.words.length||!linesList.length){lines.hidden=true;return}lines.hidden=false;
 const title=document.createElement('div');title.style.width='100%';title.style.fontSize='12px';title.style.color='#ddd';title.textContent=text().allText;lines.appendChild(title);
 linesList.forEach(raw=>{const b=document.createElement('button');b.type='button';b.className='vl-line';b.textContent=raw;b.addEventListener('click',()=>pickText(raw));lines.appendChild(b)})
}
let scriptPromise;
function loadOCR(){if(window.Tesseract)return Promise.resolve(window.Tesseract);if(scriptPromise)return scriptPromise;scriptPromise=new Promise((resolve,reject)=>{
 const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error('OCR_LIBRARY_UNAVAILABLE'));script.onerror=()=>reject(new Error('OCR_LIBRARY_UNAVAILABLE'));document.head.appendChild(script)
 }).catch(err=>{scriptPromise=null;throw err});return scriptPromise}
async function readImage(file){
 if(!file||!file.type.startsWith('image/'))return;
 if(file.size>15_000_000){setStatus(text().big);return}
 const serial=++state.requestSerial;state.selected.clear();state.words=[];selectedText.value='';overlay.replaceChildren();lines.hidden=true;candidates.replaceChildren();
 if(state.photoUrl)URL.revokeObjectURL(state.photoUrl);
 state.photoUrl=URL.createObjectURL(file);image.src=state.photoUrl;picture.hidden=false;el('vlPlaceholder').hidden=true;
 try{await image.decode()}catch{}
 setStatus(text().ready);
 try{
   let scannedBarcodes=[];
   if('BarcodeDetector' in window){try{let all=await BarcodeDetector.getSupportedFormats();let formats=['code_39','code_128','pdf417','qr_code'].filter(x=>all.includes(x));if(formats.length){let detector=new BarcodeDetector({formats});let rows=await detector.detect(image);scannedBarcodes=rows.map(x=>String(x.rawValue||'').trim()).filter(Boolean)}}catch{}}
   if(serial!==state.requestSerial)return;
   setStatus(text().loading);
   const tess=await loadOCR();
   if(!state.worker){state.worker=await tess.createWorker('eng',1,{logger:m=>{if(serial!==state.requestSerial||m.status!=='recognizing text')return;setStatus(text().loading+' '+Math.round((m.progress||0)*100)+'%')}})}
   const result=await state.worker.recognize(file,{}, {blocks:true,tsv:true});
   if(serial!==state.requestSerial)return;
   const data=result.data||{};
   state.words=core.flattenWords(data);
   renderWords(image.naturalWidth||1,image.naturalHeight||1);
   addFallbackLines(data.text);
   const found=[...new Set(scannedBarcodes.flatMap(core.vinCandidates).concat(core.vinCandidates(data.text)))];
   found.forEach(x=>addCandidate(text().candidate,x));
   scannedBarcodes.filter(v=>!found.includes(v)).slice(0,3).forEach(x=>addCandidate(text().barcode,x));
   if(found.length){pickText(found[0]);setStatus(text().found)}
   else if(state.words.length||String(data.text||'').trim()){setStatus(text().notFound)}
   else setStatus(text().error);
 }catch(e){if(serial===state.requestSerial){setStatus(text().error);if(!state.words.length)lines.hidden=true}}
}
for(const id of ['vlCamera','vlGallery'])el(id).addEventListener('change',e=>{const file=e.target.files?.[0];readImage(file);e.target.value='' });
el('vlApply').addEventListener('click',()=>{
 const value=core.cleanForField(selectedText.value);
 if(!value){setStatus(text().empty);return}
 if(value.length===17&&!/^[A-HJ-NPR-Z0-9]{17}$/.test(value)){setStatus(text().invalid);return}
 input.value=value;
 input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
 document.getElementById('vinStatus').textContent=value.length===17?text().added:text().invalid;
 close();input.focus();
});
dialog.addEventListener('close',()=>{state.requestSerial++;state.drag=null});
document.getElementById('language')?.addEventListener('change',translate);
translate();
})();
