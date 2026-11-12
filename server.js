import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {Store} from './lib/storage.js';
import {CATEGORIES,SUBCATEGORIES,clean,retailRon,fromSupplier,parseSupplierHtml,parseCatalogPage,parseFeed,parseBnmXml,validUrl,parseRon} from './lib/catalog.js';
import {localizeName,localizeDescription,productLanguages,productSummary} from './lib/product-locale.js';
import {normalizePublicUrl,safeFetchPage,discoverCatalog,previewSource,sourceProductFromHtml,externalFeedProducts} from './lib/external-import.js';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const SEED=JSON.parse(await fs.readFile(path.join(ROOT,'data/products.json'),'utf8'));
const PUBLIC_SNAPSHOT_REPO='https://raw.githubusercontent.com/servisaopravaspotrebice-alt/auto-parts-moldova-store/main/data/';
async function localOrSnapshot(name,fallback){
  try{return await fs.readFile(path.join(ROOT,'data',name),'utf8')}
  catch{try{const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);try{const resp=await fetch(PUBLIC_SNAPSHOT_REPO+name,{signal:ctl.signal});if(resp.ok)return await resp.text()}finally{clearTimeout(timer)}}catch(e){console.warn('Snapshot fetch failed',name,e.message)}}
  return fallback;
}
const SUPPLIER_SITEMAP = JSON.parse(await localOrSnapshot('supplier-urls.json','{"productUrls":[]}'));
// Seed every verified supplier URL as an unpriced pending record; prices/photos are added only after supplier detail verification.
const SUPPLIER_SEEDS=(SUPPLIER_SITEMAP.productUrls||[]).map(url=>fromSupplier({url})).filter(Boolean);
const SNAPSHOT_ROWS=[];
for(let i=1;i<=6;i++){try{const rows=JSON.parse(await localOrSnapshot(`catalog-snapshot-${i}.json`,'[]'));if(Array.isArray(rows))SNAPSHOT_ROWS.push(...rows)}catch(e){console.warn('Catalog snapshot missing',i)}}
function sanitizedSupplierTechnicalText(raw){
 const t=String(raw||'');let desc=t.includes('**Mod operare:**')?t.slice(t.indexOf('**Mod operare:**')):t.includes('**Tip cremaliera:**')?t.slice(t.indexOf('**Tip cremaliera:**')):'';
 desc=desc.split(/Informatii conformitate produs|Review-ul a fost trimis|Daca doresti|Produse similare/i)[0];
 return desc.replace(/\*\*/g,'').replace(/\+40[\d ()-]{7,25}/g,'').replace(/\s+/g,' ').slice(0,1100).trim();
}
const SNAPSHOT_SEEDS=SNAPSHOT_ROWS.map(row=>{const p=fromSupplier({...row,description:sanitizedSupplierTechnicalText(row.description)});return p?{...p,last_import_success:new Date().toISOString(),verified_at:new Date().toISOString().slice(0,10)}:null}).filter(Boolean);
const SEED_CLEAN=SEED.filter(item=>!SNAPSHOT_SEEDS.some(p=>item.sku&&p.sku&&item.sku===p.sku));
const store=await new Store(ROOT).init([...SNAPSHOT_SEEDS,...SUPPLIER_SEEDS,...SEED_CLEAN]);
const app=express();app.disable('x-powered-by');app.set('trust proxy',1);
if(process.env.STAGING_NO_INDEX==='true')app.use((req,res,next)=>{res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');next()});
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:'5mb'}));
app.use(['/api/lead','/api/orders'],rateLimit({windowMs:15*60*1000,limit:6,standardHeaders:'draft-7',legacyHeaders:false}));
app.use('/api/admin/session',rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:'draft-7',legacyHeaders:false}));
app.use(express.static(path.join(ROOT,'public'),{extensions:['html'],maxAge:'2m'}));
const VALID_CURRENCIES=new Set(['MDL','RON','USD','EUR']);
const INITIAL_RATES={date:'11.11.2026',rates:{MDL:1,RON:3.7666,EUR:20.1298,USD:17.9458},updatedAt:null,fallback:true};
let currentRates=store.state.rates||INITIAL_RATES;
let catalogSync={busy:false,lastAttempt:null,lastSuccess:null,error:null,lastReport:null};
let rateSync={busy:false,lastAttempt:null,lastSuccess:currentRates.updatedAt,error:null};
let importProgress={total:(SUPPLIER_SITEMAP.productUrls||[]).length,processed:0,failed:0,phase:'idle'};
let externalJob={busy:false,phase:'idle',website:null,total:0,processed:0,added:0,updated:0,skipped:0,failed:0,errors:[],lastSuccess:null,error:null};
const externalPreviews=new Map();
const sessions=new Map();
const secret=process.env.ADMIN_SESSION_SECRET||crypto.randomBytes(40).toString('base64url');
// Only a memory-hard hash lives in the hosting secret manager. No plaintext password in source or static files.
const ADMIN_USERNAME=process.env.ADMIN_USERNAME||'';
const ADMIN_PASSWORD_HASH=process.env.ADMIN_PASSWORD_HASH||'';
const adminConfigured=!!(ADMIN_USERNAME&&/^scrypt\$16384\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/.test(ADMIN_PASSWORD_HASH));
function passwordMatches(candidate){
  if(!adminConfigured||typeof candidate!=='string'||candidate.length>256)return false;
  try {const [type,N,salt,key]=ADMIN_PASSWORD_HASH.split('$');
    const expected=Buffer.from(key,'base64url');
    const actual=crypto.scryptSync(candidate,Buffer.from(salt,'base64url'),expected.length,{N:Number(N),r:8,p:1,maxmem:64*1024*1024});
    return crypto.timingSafeEqual(expected,actual);
  } catch {return false}
}
const safeEqual=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)};
const s=(v,n=255)=>typeof v==='string'?clean(v).slice(0,n):'';
const sqlish=(v)=>Number.isFinite(Number(v))?Number(v):null;
function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>{const i=x.indexOf('=');return i<0?['','']:[x.slice(0,i).trim(),x.slice(i+1).trim()]}));}
function adminAccess(req,res,next){const token=cookies(req).autopiese_session||'';const [id,mac]=token.split('.');const expected=id?crypto.createHmac('sha256',secret).update(id).digest('hex'):'';if(!id||!mac||!safeEqual(mac,expected)||!sessions.has(id)||sessions.get(id)<Date.now()){return res.status(401).json({error:'LOGIN_REQUIRED'})}next();}
function safeOrigin(req,res,next){if(!['POST','PATCH','DELETE','PUT'].includes(req.method))return next();const source=req.headers.origin;if(source){try{if(new URL(source).host!==req.headers.host)return res.status(403).json({error:'ORIGIN_DENIED'})}catch{return res.status(403).json({error:'ORIGIN_DENIED'})}}next()}
app.use('/api/admin',(req,res,next)=>{res.setHeader('Cache-Control','no-store');next()},safeOrigin);
const dateInChisinau=()=>{const x={};const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Chisinau',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());for(const p of parts)x[p.type]=p.value;return {day:`${x.year}-${x.month}-${x.day}`,hour:Number(x.hour),minute:Number(x.minute)}};
async function fetchRemote(url,kind='html',timeout=14000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{const r=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; AutoPieseMoldovaSupplierImporter/2.0)','Accept':kind==='xml'?'application/xml,text/xml,*/*;q=.8':'text/html,application/xhtml+xml,*/*;q=.8'}});if(!r.ok)throw Error(`HTTP_${r.status}:${new URL(url).hostname}`);return await r.text()}finally{clearTimeout(timer)}}
function allowFeedUrl(raw){try{const u=new URL(raw);if(u.protocol!=='https:'||!['dedauto.ro','www.dedauto.ro'].includes(u.hostname))return null;return u.href}catch{return null}}
async function updateRates(){if(rateSync.busy)return;rateSync.busy=true;rateSync.lastAttempt=new Date().toISOString();rateSync.error=null;try{const xml=await fetchRemote('https://www.bnm.md/en/official_exchange_rates?date='+dateInChisinau().day.split('-').reverse().join('.')+'&get_xml=1','xml',14000);const val=parseBnmXml(xml);currentRates=val;await store.rates(val);rateSync.lastSuccess=val.updatedAt;return val}catch(e){rateSync.error=String(e.message).slice(0,200);console.error('BNM fetch failed',rateSync.error);return null}finally{rateSync.busy=false}}
let lastRateDateAttempt='';let rateRetryAfter=0;
async function checkRateSchedule(){const local=dateInChisinau(),isTime=local.hour>8||(local.hour===8&&local.minute>=0);if(!isTime)return;if(lastRateDateAttempt===local.day&&Date.now()<rateRetryAfter)return;lastRateDateAttempt=local.day;rateRetryAfter=Date.now()+15*60*1000;const result=await updateRates();if(result){rateRetryAfter=Infinity}}
async function syncCatalog(urlOverride=null){
 if(catalogSync.busy)return {busy:true};catalogSync.busy=true;catalogSync.lastAttempt=new Date().toISOString();catalogSync.error=null;importProgress={total:(SUPPLIER_SITEMAP.productUrls||[]).length,processed:0,failed:0,phase:'Обнаружение каталога поставщика'};
 try{
   const feed=allowFeedUrl(urlOverride||process.env.SUPPLIER_FEED_URL||'');
   if(feed){const data=await fetchRemote(feed,'xml',35000);const arr=parseFeed(data,feed.includes('.csv')?'csv':'xml');if(!arr.length)throw Error('Supplier feed returned no products');const report=await store.importProducts(arr);catalogSync.lastReport={...report,method:'feed'};catalogSync.lastSuccess=new Date().toISOString();await store.logImport(catalogSync.lastReport);return catalogSync.lastReport;}
   let urls=(SUPPLIER_SITEMAP.productUrls||[]).filter(allowFeedUrl);
   // Check official product sitemap for additions without blocking import of the last confirmed snapshot.
   try{const xml=await fetchRemote('https://www.dedauto.ro/sitemap_products.xml','xml',25000);const found=[...xml.matchAll(/<loc>(https:\/\/(?:www\.)?dedauto\.ro\/[^<]+\.html)<\/loc>/gi)].map(x=>x[1].replace(/&amp;/g,'&')).filter(allowFeedUrl);if(found.length>100){urls=[...new Set([...urls,...found])]}}catch(e){console.warn('Sitemap refresh unavailable, using last known snapshot:',e.message)}
   urls=[...new Set(urls)];if(!urls.length)throw Error('Supplier URL catalog is empty');
   const toImport=urls.map(url=>fromSupplier({url})).filter(p=>p&&!store.find(p.id));
   if(toImport.length)await store.importProducts(toImport);
   const targets=urls.filter(url=>{let p=store.find('dedauto-'+crypto.createHash('sha256').update(url).digest('hex').slice(0,18));return p&&!p.deleted&&!p.lock_supplier&&(!p.supplier_price_ron||!p.images?.length||!p.sku||!p.last_import_success||(Date.now()-Date.parse(p.last_import_success)>24*3600*1000))});
   importProgress={total:urls.length,processed:urls.length-targets.length,failed:0,phase:'Загрузка карточек товаров'};
   const concurrency=5;let parsed=0;
   for(let i=0;i<targets.length;i+=concurrency){const chunk=targets.slice(i,i+concurrency);const result=await Promise.allSettled(chunk.map(async url=>{const html=await fetchRemote(url,'html',18000);const p=parseSupplierHtml(html,url);if(p)p.last_import_success=new Date().toISOString();return p}));const list=[];
    for(const x of result){importProgress.processed++;if(x.status==='fulfilled'&&x.value){parsed++;list.push(x.value)}else importProgress.failed++}
    if(list.length)await store.importProducts(list);
   }
   importProgress.phase='Завершено';catalogSync.lastSuccess=new Date().toISOString();catalogSync.lastReport={products:store.products().length,sourceUrls:urls.length,detailsVerified:parsed,failed:importProgress.failed,method:'sitemap+supplier-pages'};
   await store.logImport(catalogSync.lastReport);return catalogSync.lastReport;
 }catch(e){catalogSync.error=String(e.message).slice(0,300);importProgress.phase='Ошибка';console.error('Catalog import:',catalogSync.error);return {error:catalogSync.error}}finally{catalogSync.busy=false}
}

const publicItem=p=>({id:p.id,name:p.name,name_translations:productLanguages(p),description_translations:{ro:productSummary(p,'ro'),ru:productSummary(p,'ru'),uk:productSummary(p,'uk'),en:productSummary(p,'en')},brand:p.brand,model:p.model,category:p.category,subcategory:p.subcategory,condition:p.condition,sku:p.sku,description:p.description,oem:p.oem||[],image:p.image||p.images?.[0]||'',images:p.images||[],view360:!!p.view360&&Array.isArray(p.images)&&p.images.length>=8,price_ron:store.customerPrice(p),original_price_ron:store.activeDiscount(p)>0?store.regularPrice(p):null,discount_percent:store.activeDiscount(p),stock:p.stock,verified_at:p.verified_at});
app.get('/media/:id.webp',(req,res)=>{const record=store.state.media?.[req.params.id];if(!record)return res.status(404).end();res.set({'Content-Type':'image/webp','Cache-Control':'public,max-age=604800','X-Content-Type-Options':'nosniff'});res.send(Buffer.from(record,'base64'))});
app.post('/api/admin/images',adminAccess,async(req,res)=>{const payload=req.body||{};const arr=Array.isArray(payload.photos)?payload.photos:[];
 if(!arr.length||arr.length>12)return res.status(400).json({error:'PHOTO_COUNT_1_TO_12'});const refs=[];
 for(const b64 of arr){if(typeof b64!=='string'||b64.length>500000||!/^[A-Za-z0-9+/]+={0,2}$/.test(b64))return res.status(400).json({error:'PHOTO_TOO_LARGE_OR_INVALID'});const bytes=Buffer.from(b64,'base64');if(bytes.length>350000||bytes.length<100||bytes.slice(0,4).toString('ascii')!=='RIFF'||bytes.slice(8,12).toString('ascii')!=='WEBP')return res.status(400).json({error:'NOT_VALID_WEBP'});const id=crypto.randomUUID();await store.upsertMedia(id,b64);refs.push('/media/'+id+'.webp');}
 res.json({ok:true,urls:refs,persistent:store.persistent});
});
app.get('/api/status',(req,res)=>res.json({online:true,catalogCount:store.products().length,orderCount:store.state.orders.length,telegramReady:!!(process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_CHAT_ID),adminConfigured,storageMode:store.mode,persistent:store.persistent,syncing:catalogSync.busy,lastSync:catalogSync.lastSuccess,syncError:catalogSync.error,rateUpdateAt:'08:00 Europe/Chisinau',ratesCurrent:!currentRates.fallback,rateError:rateSync.error}));
app.get('/api/rates',(req,res)=>res.json({...currentRates,schedule:'08:00 Europe/Chisinau',lastAttempt:rateSync.lastAttempt,error:rateSync.error}));
app.get('/api/categories',(req,res)=>{let list=store.products(),cat=CATEGORIES.map(c=>({...c,count:list.filter(p=>p.category===c.id).length}));res.json({categories:cat,subcategories:SUBCATEGORIES,brands:[...new Set(list.map(x=>x.brand).filter(Boolean))].sort(),conditions:['new','used','refurbished','unknown']})});
app.get('/api/products',(req,res)=>{const q=s(req.query.q,100).toLowerCase(),cat=s(req.query.category,50),sub=s(req.query.subcategory,50),brand=s(req.query.brand,80).toLowerCase(),condition=s(req.query.condition,40);const page=Math.max(1,Math.min(1000,Number(req.query.page)||1));let list=store.products().filter(p=>(!cat||p.category===cat)&&(!sub||p.subcategory===sub)&&(!brand||p.brand.toLowerCase().includes(brand))&&(!condition||p.condition===condition)&&(!q||[p.name,...Object.values(productLanguages(p)),p.brand,p.model,p.sku,p.supplier_code,...(p.oem||[])].join(' ').toLowerCase().includes(q)));list.sort((a,b)=>(Number(!!b.image&&store.customerPrice(b)!=null)-Number(!!a.image&&store.customerPrice(a)!=null))||String(a.name).localeCompare(String(b.name),'ro'));const total=list.length;const limit=24;res.json({items:list.slice((page-1)*limit,page*limit).map(publicItem),total,page,pages:Math.ceil(total/limit),markupPercent:20})});
app.get('/api/products/:id',(req,res)=>{const p=store.find(req.params.id);if(!p||p.deleted||p.hidden)return res.status(404).json({error:'NOT_FOUND'});res.json(publicItem(p))});

const sanitizePhone=phone=>s(phone,55);
const publicOrder=id=>String(id).replace(/[^a-zA-Z0-9-]/g,'');
async function sendTelegramOrder(order){
 if(!process.env.TELEGRAM_BOT_TOKEN||!process.env.TELEGRAM_CHAT_ID)throw Error('TELEGRAM_NOT_CONFIGURED');
 const lines=[
  `🛒 AUTOPIESE MOLDOVA — Заказ № ${order.id}`,
  `📅 ${new Date(order.createdAt).toLocaleString('ru-RU',{timeZone:'Europe/Chisinau'})} (Молдова)`,
  `👤 Клиент: ${order.name||'—'}`,
  `📞 Телефон: ${order.phone}`,
  `🚘 Автомобиль: ${[order.brand,order.model,order.year].filter(Boolean).join(' ')||'—'}`,
  `🔎 VIN: ${order.vin||'—'}`,
  `🌐 Язык: ${order.language} | Валюта: ${order.currency}`,
  '',`📦 СПИСОК ЗАПЧАСТЕЙ (${order.items.length} позиций):`
 ];
 let index=0;for(const item of order.items){index++;
   const unit=item.unit_price==null?'Цена по запросу':`${item.unit_price.toLocaleString('ru-RU')} ${order.currency}`;
   const amount=item.total_price==null?'Цена по запросу':`${item.total_price.toLocaleString('ru-RU')} ${order.currency}`;
   lines.push(`${index}. ${item.name}`,`   OEM: ${item.sku||'—'} | ${item.qty} шт. × ${unit}`,`   Сумма: ${amount}`);
 }
 if(order.part)lines.push(`📝 Искомая деталь: ${order.part}`);
 if(order.comment)lines.push(`💬 Комментарий: ${order.comment}`);
 lines.push('',`💰 ИТОГО: ${order.total.toLocaleString('ru-RU')} ${order.currency}${order.hasUnpriced?' + товары с ценой по запросу':''}`,`ℹ️ Не оплачено. Подтвердить наличие, совместимость и цену.`);
 // Telegram messages max 4096 characters. Split only between lines; repeat identity on every part.
 const messages=[];let part=lines[0]+'\n';const intro=`Заказ № ${order.id} • ${order.phone}\n`;
 for(const line of lines.slice(1)){
   if(part.length+line.length+1>3800){messages.push(part);part=intro;}
   part+=line.slice(0,1200)+'\n';
 }
 if(part.trim())messages.push(part);
 for(let j=0;j<messages.length;j++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:process.env.TELEGRAM_CHAT_ID,text:messages[j],disable_web_page_preview:true}),signal:controller.signal
   });
   const data=await response.json().catch(()=>({ok:false}));if(!response.ok||!data.ok)throw Error('TELEGRAM_SEND_FAILED');
  } finally {clearTimeout(timer)}
 }
 return messages.length;
}
async function handleOrder(req,res){
 const {name,phone,brand,model,year,vin,part,comment,cart=[],language='ro',currency='MDL',consent}=req.body||{};
 if(consent!==true)return res.status(400).json({error:'CONSENT_REQUIRED'});
 const number=sanitizePhone(phone);if(!/^\+?[\d ()-]{7,22}$/.test(number)||number.replace(/\D/g,'').length<8)return res.status(400).json({error:'PHONE_REQUIRED'});
 const vinValue=s(vin,30).toUpperCase().trim();if(vinValue&&!/^[A-HJ-NPR-Z0-9]{17}$/.test(vinValue))return res.status(400).json({error:'VIN_INVALID'});
 const rows=Array.isArray(cart)?cart.slice(0,50):[];
 if(!rows.length&&!s(part,300))return res.status(400).json({error:'PART_REQUIRED'});
 if(Array.isArray(cart)&&cart.length>50)return res.status(400).json({error:'CART_TOO_LARGE'});
 const selected=VALID_CURRENCIES.has(currency)?currency:'MDL',rates=currentRates.rates||INITIAL_RATES.rates;
 if(!rates?.RON||!rates[selected])return res.status(503).json({error:'RATES_UNAVAILABLE'});
 const items=[];
 for(const row of rows){
  const product=store.find(s(row?.id,100));if(!product||product.deleted||product.hidden)return res.status(400).json({error:'PRODUCT_UNAVAILABLE'});
  const qty=Number(row?.qty);if(!Number.isInteger(qty)||qty<1||qty>99)return res.status(400).json({error:'QUANTITY_INVALID'});
  const price=store.customerPrice(product);
  const unit=price==null?null:Math.round(price*rates.RON/rates[selected]);
  const total=unit==null?null:unit*qty;
  items.push({id:product.id,name:s(product.name,200),sku:s(product.sku,80),qty,unit_price:unit,total_price:total});
 }
 const order={id:'AP-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(3).toString('hex').toUpperCase(),createdAt:new Date().toISOString(),status:'pending_notification',name:s(name,100),phone:number,brand:s(brand,80),model:s(model,80),year:s(year,4),vin:vinValue,part:s(part,300),comment:s(comment,600),currency:selected,language:['ro','ru','uk','en'].includes(language)?language:'ro',items,total:items.reduce((sum,item)=>sum+(item.total_price??0),0),hasUnpriced:items.some(item=>item.unit_price===null),notifiedAt:null};
 try{await store.saveOrder(order)}catch(e){console.error('Order persistence failed:',e.message);return res.status(503).json({error:'STORAGE_UNAVAILABLE'})}
 try{
  const chunks=await sendTelegramOrder(order);
  await store.updateOrder(order.id,{status:'sent_to_telegram',notifiedAt:new Date().toISOString(),telegramChunks:chunks});
  res.status(201).json({ok:true,orderId:order.id,items:items.length,total:order.total,currency:selected});
 }catch(e){
  await store.updateOrder(order.id,{status:e.message==='TELEGRAM_NOT_CONFIGURED'?'awaiting_telegram_setup':'telegram_delivery_failed'}).catch(()=>{});
  console.error('Order Telegram notification:',e.message);res.status(503).json({error:e.message==='TELEGRAM_NOT_CONFIGURED'?'TELEGRAM_NOT_CONFIGURED':'TELEGRAM_DELIVERY_FAILED',saved:true,orderId:order.id});
 }
}
app.post('/api/orders',handleOrder);
app.post('/api/lead',handleOrder);
app.get('/api/admin/orders',adminAccess,(req,res)=>res.json({items:store.state.orders.slice(0,200)}));
app.patch('/api/admin/orders/:id',adminAccess,async(req,res)=>{const status=s(req.body?.status,50);if(!['new','in_progress','completed','cancelled','sent_to_telegram'].includes(status))return res.status(400).json({error:'STATUS_INVALID'});const record=await store.updateOrder(publicOrder(req.params.id),{status});if(!record)return res.status(404).json({error:'NOT_FOUND'});res.json({ok:true,order:record})});
app.post('/api/admin/orders/:id/notify',adminAccess,async(req,res)=>{const order=store.findOrder(publicOrder(req.params.id));if(!order)return res.status(404).json({error:'NOT_FOUND'});try{const n=await sendTelegramOrder(order);await store.updateOrder(order.id,{status:'sent_to_telegram',notifiedAt:new Date().toISOString(),telegramChunks:n});res.json({ok:true})}catch(e){res.status(503).json({error:e.message})}});
app.post('/api/admin/session',(req,res)=>{res.setHeader('Cache-Control','no-store');if(!adminConfigured)return res.status(503).json({error:'ADMIN_NOT_CONFIGURED'});if(!safeEqual(String(req.body?.username||''),ADMIN_USERNAME)||!passwordMatches(req.body?.password))return res.status(401).json({error:'BAD_CREDENTIALS'});const id=crypto.randomBytes(24).toString('hex');sessions.set(id,Date.now()+8*60*60*1000);const mac=crypto.createHmac('sha256',secret).update(id).digest('hex');res.setHeader('Set-Cookie',`autopiese_session=${id}.${mac}; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=28800`);res.json({ok:true})});
app.get('/api/admin/session',adminAccess,(req,res)=>res.set('Cache-Control','no-store').json({ok:true}));
app.get('/admin',(req,res)=>res.set('Cache-Control','no-store').sendFile(path.join(ROOT,'public','admin.html')));
app.post('/api/admin/logout',adminAccess,(req,res)=>{const id=(cookies(req).autopiese_session||'').split('.')[0];sessions.delete(id);res.setHeader('Set-Cookie','autopiese_session=; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=0');res.json({ok:true})});

// Telegram diagnostics are accessible only to an authenticated administrator.
// Never return bot credentials or include them in application logs.
const telegramAdminLimit=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:'draft-7',legacyHeaders:false});
function telegramConfigured(){return Boolean(process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_CHAT_ID)}
async function telegramBotMethod(method,payload){
 const token=process.env.TELEGRAM_BOT_TOKEN;
 if(!token)throw Error('BOT_TOKEN_MISSING');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload||{}),signal:controller.signal
  });
  const result=await response.json().catch(()=>({ok:false}));
  if(!response.ok||!result.ok){
    if(result.error_code===403)throw Error('TELEGRAM_BOT_NOT_STARTED_OR_BLOCKED');
    if(result.error_code===400)throw Error('TELEGRAM_INVALID_CHAT');
    if(result.error_code===401)throw Error('TELEGRAM_INVALID_TOKEN');
    throw Error('TELEGRAM_DELIVERY_FAILED');
  }
  return result.result;
 }catch(e){if(e.name==='AbortError')throw Error('TELEGRAM_TIMEOUT');throw e}
 finally{clearTimeout(timer)}
}
app.get('/api/admin/telegram/status',adminAccess,(req,res)=>{
 res.set('Cache-Control','no-store').json({
  botTokenConfigured:Boolean(process.env.TELEGRAM_BOT_TOKEN),
  chatConfigured:Boolean(process.env.TELEGRAM_CHAT_ID),
  ready:telegramConfigured(),
  storagePersistent:store.persistent,
  sentOrders:store.state.orders.filter(o=>o.status==='sent_to_telegram').length,
  pendingOrders:store.state.orders.filter(o=>o.status==='pending_notification'||o.status==='awaiting_telegram_setup'||o.status==='telegram_delivery_failed').length
 });
});
app.post('/api/admin/telegram/test',adminAccess,telegramAdminLimit,async(req,res)=>{
 if(!telegramConfigured())return res.status(503).json({error:'TELEGRAM_NOT_CONFIGURED'});
 try{
  await telegramBotMethod('sendMessage',{
    chat_id:process.env.TELEGRAM_CHAT_ID,
    text:'✅ AutoPiese Moldova: тестовое сообщение. Уведомления о заказах подключены. Это не заказ покупателя.',
    disable_web_page_preview:true
  });
  res.json({ok:true,delivered:true});
 }catch(e){res.status(502).json({error:e.message.startsWith('TELEGRAM_')?e.message:'TELEGRAM_DELIVERY_FAILED'})}
});
app.get('/api/admin/telegram/discover',adminAccess,telegramAdminLimit,async(req,res)=>{
 if(!process.env.TELEGRAM_BOT_TOKEN)return res.status(503).json({error:'BOT_TOKEN_MISSING'});
 try{
  const updates=await telegramBotMethod('getUpdates',{limit:50,timeout:0});
  const chats=new Map();
  for(const entry of updates||[]){
    const c=entry.message?.chat||entry.my_chat_member?.chat||entry.channel_post?.chat;
    if(c?.id)chats.set(String(c.id),{
      id:String(c.id),type:String(c.type||''),label:String(c.title||c.first_name||c.username||'Telegram chat').slice(0,80)
    });
  }
  res.json({ok:true,chats:[...chats.values()].slice(-20)});
 }catch(e){res.status(502).json({error:e.message.startsWith('TELEGRAM_')?e.message:'TELEGRAM_DISCOVERY_FAILED'})}
});

app.get('/api/admin/status',adminAccess,(req,res)=>res.json({ok:true,products:store.products(true).length,visible:store.products().length,orders:store.state.orders.length,pricing:{globalFactor:store.state.settings.globalPriceFactor,history:store.state.settings.priceHistory||[]},reviews:store.state.reviews.length,store:store.mode,persistent:store.persistent,import:catalogSync,progress:importProgress,externalImport:externalJob,suppliers:store.state.settings.supplierSources||[],rates:currentRates,rateSync,importHistory:store.state.imports}));
app.get('/api/admin/products',adminAccess,(req,res)=>{const q=s(req.query.q,100).toLowerCase(),page=Math.max(1,Math.min(1000,Number(req.query.page)||1)),limit=40;let rows=store.products(true).filter(p=>!q||[p.name,p.sku,p.brand,p.id].join(' ').toLowerCase().includes(q));res.json({total:rows.length,page,items:rows.slice((page-1)*limit,page*limit).map(p=>({...p,regular_price_ron:store.regularPrice(p),customer_price_ron:store.customerPrice(p)}))})});
function cleanManual(body,existing){const p=body||{};const src=existing?.source||'manual';const imported=src==='dedauto'||src.startsWith('external:');const supplierPrice=p.supplier_price_ron==null?null:parseRon(p.supplier_price_ron),manualPrice=p.price_ron==null?null:parseRon(p.price_ron);let price=imported?existing?.price_ron??(supplierPrice!==null?retailRon(supplierPrice):manualPrice):manualPrice;const override=p.price_override_ron==null||p.price_override_ron===''?null:parseRon(p.price_override_ron);const discount=Math.max(0,Math.min(70,Number(p.discount_percent||0)));let image=s(p.image,1500),url=s(p.url,1500);if(image&&!(/^https:\/\//.test(image)||/^\/media\/[0-9a-f-]+\.webp$/.test(image)))image='';const now=new Date().toISOString();return {...existing,id:existing?.id||'manual-'+crypto.randomBytes(9).toString('hex'),source:src,name:s(p.name,240),name_translations:Object.fromEntries(['ro','ru','uk','en'].map(l=>[l,s(p.name_translations?.[l],360)]).filter(([,v])=>v)),description_translations:Object.fromEntries(['ro','ru','uk','en'].map(l=>[l,s(p.description_translations?.[l],1500)]).filter(([,v])=>v)),brand:s(p.brand,100),model:s(p.model,100),category:s(p.category,100)||'other',subcategory:s(p.subcategory,100),condition:s(p.condition,50)||'unknown',sku:s(p.sku,120),supplier_code:s(p.supplier_code,120),description:s(p.description,9000),image,view360:!!p.view360,images:Array.isArray(p.images)&&p.images.length?p.images.slice(0,24).filter(x=>/^https:\/\//.test(x)||/^\/media\/[0-9a-f-]+\.webp$/.test(x)):image?[image]:[],url,stock:s(p.stock,30)||'unknown',oem:Array.isArray(p.oem)?p.oem.slice(0,70).map(x=>s(x,80)):[],supplier_price_ron:imported?supplierPrice:null,price_ron:price,price_override_ron:override,discount_percent:discount,discount_ends_at:s(p.discount_ends_at,40)||null,hidden:!!p.hidden,deleted:false,lock_supplier:true,updatedAt:now};}
app.post('/api/admin/products',adminAccess,async(req,res)=>{const p=cleanManual(req.body);if(!p.name)return res.status(400).json({error:'NAME_REQUIRED'});await store.upsertManual(p);res.status(201).json({ok:true,item:p})});
app.patch('/api/admin/products/:id',adminAccess,async(req,res)=>{const old=store.find(req.params.id);if(!old)return res.status(404).json({error:'NOT_FOUND'});const update=cleanManual({...old,...req.body},old);if(!update.name)return res.status(400).json({error:'NAME_REQUIRED'});await store.upsertManual(update);res.json({ok:true,item:publicItem(update)})});
app.delete('/api/admin/products/:id',adminAccess,async(req,res)=>{const p=await store.setVisibility(req.params.id,{deleted:true});if(!p)return res.status(404).json({error:'NOT_FOUND'});res.json({ok:true})});
app.post('/api/admin/products/:id/restore',adminAccess,async(req,res)=>{const p=await store.setVisibility(req.params.id,{deleted:false});if(!p)return res.status(404).json({error:'NOT_FOUND'});res.json({ok:true})});
app.post('/api/admin/import',adminAccess,express.text({type:'text/plain',limit:'12mb'}),async(req,res)=>{const fmt=s(req.query.format,8)||'xml';if(!['xml','csv'].includes(fmt))return res.status(400).json({error:'FORMAT'});try{const items=parseFeed(String(req.body||''),fmt);if(!items.length)throw Error('NO_VALID_PRODUCTS');const data=await store.importProducts(items);await store.logImport({...data,method:'uploaded-'+fmt});res.json({ok:true,report:data})}catch(e){res.status(400).json({error:s(e.message)})}});
app.post('/api/admin/sync',adminAccess,async(req,res)=>{if(catalogSync.busy)return res.json({ok:true,busy:true});const feed=s(req.body?.feed,1200);if(feed&&!allowFeedUrl(feed))return res.status(400).json({error:'FEED_HOST_NOT_ALLOWED'});syncCatalog(feed||null).catch(console.error);res.json({ok:true,started:true})});
// Import additional authorized public supplier sites through an explicit preview + confirmation.
function externalInput(req){const url=normalizePublicUrl(req.body?.url).href;const markup=Number(req.body?.markup??20);if(!Number.isFinite(markup)||markup<0||markup>100)throw Error('MARKUP_OUT_OF_RANGE');return {url,markup};}
async function executeExternalImport({url,markup,limit=750}){
 externalJob={busy:true,phase:'Поиск каталога',website:url,total:0,processed:0,added:0,updated:0,skipped:0,failed:0,errors:[],lastSuccess:externalJob.lastSuccess,error:null};
 try{
  const target=normalizePublicUrl(url),host=target.hostname;
  let items=[],sourceUrls=[];
  if(/\.(csv|xml)(?:\?|$)/i.test(url)&&!/sitemap/i.test(url)){
   const r=await safeFetchPage(url,{maxBytes:5_000_000,timeout:25000,expectedHostname:host});
   // XML may be a sitemap rather than a product feed.
   if(/^\s*<(?:\?xml[^>]*>\s*)?(?:sitemapindex|urlset)/i.test(r.body)){
    const map=await discoverCatalog(url,{limit});sourceUrls=map.links;
   }else items=externalFeedProducts(r.body,url,{markup,rates:currentRates.rates});
  }else{
   const map=await discoverCatalog(url,{limit,onProgress:p=>{externalJob.phase='Поиск ссылок';externalJob.found=p.found??0;externalJob.pagesScanned=p.pagesScanned??0}});sourceUrls=map.links;
   if(map.truncated)externalJob.errors.push('Лимит сканирования: '+limit+'. Для более крупного каталога рекомендуем CSV/XML выгрузку.');
  }
  externalJob.total=sourceUrls.length||items.length;externalJob.phase='Получение товаров';
  if(items.length){const report=await store.importProducts(items);Object.assign(externalJob,{processed:items.length,added:report.added,updated:report.updated,skipped:report.skipped});}
  else{
   const batchSize=5;
   for(let i=0;i<sourceUrls.length;i+=batchSize){const chunk=sourceUrls.slice(i,i+batchSize);
    const settled=await Promise.allSettled(chunk.map(async link=>{
     const page=await safeFetchPage(link,{maxBytes:2_500_000,timeout:17000,expectedHostname:host});
     const product=sourceProductFromHtml(page.body,link,{markup,rates:currentRates.rates});
     if(!product||(!product.image&&!product.sku&&product.supplier_price_ron===null))throw Error('NOT_A_PRODUCT');return product;
    }));
    const rows=[];for(let j=0;j<settled.length;j++){let x=settled[j];externalJob.processed++;if(x.status==='fulfilled')rows.push(x.value);else{externalJob.failed++;if(externalJob.errors.length<12)externalJob.errors.push({url:chunk[j],error:String(x.reason?.message||x.reason)})}}
    if(rows.length){const report=await store.importProducts(rows);for(const k of ['added','updated','skipped'])externalJob[k]+=report[k]||0}
   }
  }
  externalJob.phase='Завершено';externalJob.lastSuccess=new Date().toISOString();
  const supplier={website:target.origin,url,markup,products:externalJob.added+externalJob.updated,lastSync:externalJob.lastSuccess};
  const all=store.state.settings.supplierSources||[];
  store.state.settings.supplierSources=[supplier,...all.filter(x=>x.website!==target.origin)].slice(0,30);
  await store.save('settings');await store.logImport({method:'external-supplier',source:target.origin,markup,...{total:externalJob.total,added:externalJob.added,updated:externalJob.updated,skipped:externalJob.skipped,failed:externalJob.failed}});
 }catch(e){externalJob.phase='Ошибка';externalJob.error=String(e?.message||e).slice(0,250)}
 finally{externalJob.busy=false}
}
app.post('/api/admin/sources/preview',adminAccess,async(req,res)=>{
 try{if(externalJob.busy)return res.status(409).json({error:'IMPORT_IN_PROGRESS'});
  const {url,markup}=externalInput(req);if(/(?:^|\.)dedauto\.ro$/i.test(new URL(url).hostname))return res.status(400).json({error:'USE_DEDAUTO_IMPORT_SECTION'});let result;
  if(/\.(csv|xml)(?:\?|$)/i.test(url)&&!/sitemap/i.test(url)){
   const page=await safeFetchPage(url,{maxBytes:5_000_000,timeout:25000});
   const products=externalFeedProducts(page.body,url,{markup,rates:currentRates.rates});
   if(products.length)result={website:normalizePublicUrl(url).origin,sourceUrl:url,scannedPages:1,samples:products.slice(0,5),discovered:products.length,mode:'feed'};
  }
  if(!result){result=await previewSource(url,{markup,rates:currentRates.rates});result.discovered=result.discovered??result.links?.length??0;result.mode='website';}
  externalPreviews.set(url,{markup,at:Date.now(),mode:result.mode});
  res.json({ok:true,website:result.website,found:result.discovered,scannedPages:result.scannedPages,mode:result.mode,examples:result.samples.map(x=>({name:x.name,sku:x.sku,image:x.image,price_ron:x.price_ron,source_currency:x.supplier_currency})),issues:(result.issues||[]).slice(0,5),truncated:result.truncated||false,notice:'Для других сайтов подтверждайте право на использование их контента. Фотографии не изменяются.'});
 }catch(e){res.status(422).json({error:String(e?.message||e).slice(0,220)})}
});
app.post('/api/admin/sources/import',adminAccess,async(req,res)=>{
 try{if(externalJob.busy)return res.status(409).json({error:'IMPORT_IN_PROGRESS'});
  const {url,markup}=externalInput(req);const preview=externalPreviews.get(url);
  if(!preview||preview.markup!==markup||Date.now()-preview.at>20*60*1000)return res.status(400).json({error:'PREVIEW_REQUIRED'});
  if(req.body?.confirm!==true||req.body?.rightsConfirmed!==true)return res.status(400).json({error:'CONFIRM_AND_PERMISSION_REQUIRED'});
  externalPreviews.delete(url);executeExternalImport({url,markup}).catch(e=>{externalJob.error=String(e?.message||e)});
  res.status(202).json({ok:true,started:true,website:normalizePublicUrl(url).origin});
 }catch(e){res.status(400).json({error:String(e?.message||e).slice(0,220)})}
});
app.get('/api/admin/sources/status',adminAccess,(req,res)=>res.json({ok:true,job:externalJob,suppliers:store.state.settings.supplierSources||[]}));
// Administrator-uploaded supplier CSV/XML: preview first, then confirm with rights. The uploaded bytes are not stored on the public server.
app.post('/api/admin/sources/upload',adminAccess,express.text({type:'text/plain',limit:'12mb'}),async(req,res)=>{
 try{const url=normalizePublicUrl(req.query.site).href,markup=Number(req.query.markup??20);if(!Number.isFinite(markup)||markup<0||markup>100)throw Error('MARKUP_OUT_OF_RANGE');
  if(/dedauto\.ro$/i.test(new URL(url).hostname))throw Error('USE_DEDAUTO_IMPORT_SECTION');
  const products=externalFeedProducts(String(req.body||''),url,{markup,rates:currentRates.rates});if(!products.length)throw Error('NO_VALID_PRODUCTS_IN_FEED');
  if(req.query.preview==='true')return res.json({ok:true,found:products.length,examples:products.slice(0,5).map(x=>({name:x.name,sku:x.sku,price_ron:x.price_ron,image:x.image})),unpriced:products.filter(x=>x.price_ron==null).length});
  if(req.query.confirm!=='true'||req.query.rightsConfirmed!=='true')return res.status(400).json({error:'CONFIRM_AND_PERMISSION_REQUIRED'});
  const report=await store.importProducts(products);
  const host=new URL(url).origin,all=store.state.settings.supplierSources||[];
  store.state.settings.supplierSources=[{website:host,url,markup,products:products.length,lastSync:new Date().toISOString(),method:'upload'},...all.filter(x=>x.website!==host)].slice(0,30);
  await store.save('settings');await store.logImport({...report,source:host,method:'external-upload',markup});
  res.json({ok:true,report});
 }catch(e){res.status(400).json({error:String(e.message).slice(0,250)})}
});


app.post('/api/admin/rates',adminAccess,async(req,res)=>{const result=await updateRates();res.json({ok:!!result,rates:currentRates,error:rateSync.error})});

// Explicit, auditable price editing. Preview never mutates any catalog price.
app.post('/api/admin/prices/bulk',adminAccess,async(req,res)=>{
 const percent=Number(req.body?.percent),preview=req.body?.preview===true;
 if(!Number.isFinite(percent)||percent===0||percent< -50||percent>100)return res.status(400).json({error:'PERCENT_OUT_OF_RANGE'});
 const oldFactor=Number(store.state.settings.globalPriceFactor)||1,newFactor=Math.round(oldFactor*(1+percent/100)*1e8)/1e8;
 if(newFactor<.01||newFactor>100)return res.status(400).json({error:'FACTOR_OUT_OF_RANGE'});
 const examples=store.products().filter(p=>store.regularPrice(p)!=null).slice(0,5).map(p=>({name:p.name,before:store.customerPrice(p),after:Math.round(store.customerPrice(p)*(1+percent/100)*100)/100}));
 if(preview)return res.json({ok:true,preview:true,affected:store.products().filter(p=>store.regularPrice(p)!=null).length,oldFactor,newFactor,examples});
 if(req.body?.confirm!==true)return res.status(400).json({error:'CONFIRM_REQUIRED'});
 try{const change=await store.bulkAdjust(percent);res.json({ok:true,change})}catch(e){res.status(400).json({error:String(e.message)})}
});
app.post('/api/admin/prices/undo',adminAccess,async(req,res)=>{if(req.body?.confirm!==true)return res.status(400).json({error:'CONFIRM_REQUIRED'});try{const change=await store.undoLastPriceChange();res.json({ok:true,change})}catch(e){res.status(400).json({error:String(e.message)})}});

// Daily featured picks vary at 08:00 Europe/Chisinau; they are not fake price discounts.
const dayRotation=()=>{const now=dateInChisinau();const effective=now.hour>=8?now.day:new Date(Date.parse(now.day+'T00:00:00Z')-86400000).toISOString().slice(0,10);return effective};
app.get('/api/featured',(req,res)=>{const day=dayRotation();const products=store.products().filter(p=>store.customerPrice(p)!=null);const sortKey=p=>crypto.createHash('sha256').update(day+':'+p.id).digest('hex');const items=products.sort((a,b)=>sortKey(a).localeCompare(sortKey(b))).slice(0,8).map(publicItem);res.json({date:day,refresh:'08:00 Europe/Chisinau',items,disclaimer:'Featured selection, not a price discount unless discount_percent > 0'})});

// Genuine reviews only. Translation texts can be provided by the admin, or DeepL configured server-side.
const LANGS=new Set(['ro','ru','uk','en']);
async function deeplTranslation(text,target){if(!process.env.DEEPL_API_KEY)return null;const code={ro:'RO',ru:'RU',uk:'UK',en:'EN'}[target];if(!code)return null;try{const url=process.env.DEEPL_API_URL||'https://api-free.deepl.com/v2/translate';const response=await fetch(url,{method:'POST',headers:{Authorization:'DeepL-Auth-Key '+process.env.DEEPL_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({text:[text],target_lang:code}),signal:AbortSignal.timeout(9000)});if(!response.ok)return null;const result=await response.json();return result.translations?.[0]?.text||null}catch{return null}}
app.get('/api/reviews',(req,res)=>{const lang=LANGS.has(req.query.lang)?req.query.lang:'ro';const rows=store.state.reviews.filter(r=>r.published&&r.verified).map(r=>({id:r.id,name:r.name,rating:r.rating,date:r.date,language:lang,text:r.translations?.[lang]||r.text,translated:!!r.translations?.[lang],originalLanguage:r.language}));res.json({items:rows})});
app.get('/api/admin/reviews',adminAccess,(req,res)=>res.json({items:store.state.reviews}));
app.post('/api/admin/reviews',adminAccess,async(req,res)=>{const x=req.body||{};const text=s(x.text,1600),name=s(x.name,100),rating=Number(x.rating);
 if(!name||!text||!Number.isInteger(rating)||rating<1||rating>5||!LANGS.has(x.language)||!x.verified)return res.status(400).json({error:'VERIFIED_REVIEW_REQUIRED'});
 const tr=Object.fromEntries(Object.entries(x.translations||{}).filter(([lang,v])=>LANGS.has(lang)&&typeof v==='string'&&v.trim()).map(([lang,v])=>[lang,s(v,1600)]));
 tr[x.language]=text;if(x.translateAutomatically===true){for(const lang of LANGS)if(!tr[lang]){const t=await deeplTranslation(text,lang);if(t)tr[lang]=t}}
 const row={id:s(x.id,80)||crypto.randomUUID(),name,rating,text,language:x.language,translations:tr,date:s(x.date,10)||new Date().toISOString().slice(0,10),verified:true,published:!!x.published};
 if(x.id&&!store.state.reviews.some(r=>r.id===x.id))return res.status(404).json({error:'NOT_FOUND'});
 await store.upsertReview(row);res.json({ok:true,item:row,translationConfigured:!!process.env.DEEPL_API_KEY})
});
app.delete('/api/admin/reviews/:id',adminAccess,async(req,res)=>{await store.deleteReview(req.params.id);res.json({ok:true})});

// Server-rendered indexable pages with individual canonical + hreflang URLs.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BASE=process.env.PUBLIC_BASE_URL||'https://autopiese-moldova-full.onrender.com';
const SITE_BRANDS=['Audi','BMW','Chevrolet','Citroën','Dacia','Fiat','Ford','Honda','Hyundai','Kia','Mazda','Mercedes-Benz','Mitsubishi','Nissan','Opel','Peugeot','Renault','SEAT','Škoda','Toyota','Volkswagen','Volvo'];
const slug=x=>String(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const tx={ro:{parts:'Piese auto',brands:'Mărci auto',why:'De ce să comandați de la noi?',contact:'Contact și consultant',desc:'Solicitați rapid piese auto noi, folosite și recondiționate în Moldova. Se verifică fiecare comandă.',cta:'Cereți o piesă',guarantee:'Verificăm compatibilitatea după cod OEM sau VIN, discutăm opțiunile înainte de achiziție și confirmăm disponibilitatea. Livrarea și condițiile sunt stabilite împreună cu vânzătorul.'},ru:{parts:'Автозапчасти',brands:'Марки автомобилей',why:'Почему заказывать у нас?',contact:'Связь с консультантом',desc:'Поиск новых, б/у и восстановленных автозапчастей в Молдове. Уточнение по VIN и OEM.',cta:'Заказать запчасть',guarantee:'Помогаем проверить совместимость по VIN или OEM, уточняем наличие и состояние до заказа. Условия поставки согласовываются с продавцом.'},uk:{parts:'Автозапчастини',brands:'Марки авто',why:'Чому замовляти у нас?',contact:'Зв’язок з консультантом',desc:'Пошук нових, уживаних і відновлених автозапчастин у Молдові. Підбір за VIN та OEM.',cta:'Замовити запчастину',guarantee:'Перевіряємо сумісність за VIN або OEM, уточнюємо наявність і стан до замовлення.'},en:{parts:'Auto parts',brands:'Car brands',why:'Why order from us?',contact:'Contact a consultant',desc:'New, used and refurbished auto parts in Moldova. VIN and OEM part requests.',cta:'Request a part',guarantee:'We help verify part compatibility using VIN or OEM numbers, check stock and condition, and agree shipping details before your order.'}};
function makeSeoPage(req,res,{name='',heading='',description='',items=[],urlPath='',robots='index,follow'}){
 const lang=LANGS.has(req.query.lang)?req.query.lang:'ro',t=tx[lang];const pathx=urlPath||req.path;const canonical=BASE+pathx+'?lang='+lang;
 const cards=items.map(p=>`<article class="seo-card"><a href="/catalog?brand=${encodeURIComponent(p.brand||'')}&q=${encodeURIComponent(p.sku||'')}">${p.image?`<img loading="lazy" src="${esc(p.image)}" alt="${esc(p.name)}">`:''}<h2>${esc(localizeName(p.name,lang,p.name_translations))}</h2></a><p>${esc(p.sku||'')} · ${esc(p.condition||'')}</p><b>${p.price_ron!=null?Math.round(p.price_ron)+' RON':'Preț la cerere'}</b></article>`).join('');
 const links=SITE_BRANDS.map(b=>`<a href="/marci/${slug(b)}?lang=${lang}">${esc(b)}</a>`).join('');
 const others=['steering','powersteering','ac','other'].map(c=>`<a href="/categorii/${c}?lang=${lang}">${esc(c)}</a>`).join('');
 res.type('html').send(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(heading)} — AutoPiese Moldova</title><meta name="description" content="${esc(description||t.desc)}"><meta name="robots" content="${robots}"><link rel="canonical" href="${esc(canonical)}">${[...LANGS].map(l=>`<link rel="alternate" hreflang="${l==='uk'?'uk':l}" href="${esc(BASE+pathx+'?lang='+l)}">`).join('')}<link rel="alternate" hreflang="x-default" href="${esc(BASE+pathx+'?lang=ro')}"><meta name="theme-color" content="#190b12"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'WebPage',name:heading,url:canonical,description:description||t.desc})}</script></head><body><header class="seo-header"><a href="/?lang=${lang}">AUTOPIESE <strong>MOLDOVA</strong></a><nav><a href="/catalog?lang=${lang}">${esc(t.parts)}</a><a href="/marci?lang=${lang}">${esc(t.brands)}</a><a href="/contact?lang=${lang}">${esc(t.contact)}</a></nav></header><main class="seo-main"><p class="section-kicker">AutoPiese Moldova</p><h1>${esc(heading)}</h1><p>${esc(description||t.desc)}</p><p>${esc(t.guarantee)}</p><a class="btn btn-primary" href="/?lang=${lang}#request">${esc(t.cta)} ↗</a><div class="seo-cards">${cards}</div><h2>${esc(t.brands)}</h2><div class="seo-links">${links}</div><h2>${esc(t.parts)}</h2><div class="seo-links">${others}</div><h2>${esc(t.why)}</h2><p>${esc(t.guarantee)}</p><div class="seo-contact"><a href="tel:+37368712418">+373 687 12 418</a> <a href="https://wa.me/37368712418">WhatsApp</a> <a href="viber://chat?number=%2B37368712418">Viber</a></div></main><footer class="seo-header">© AutoPiese Moldova · ${esc(t.desc)}</footer></body></html>`);
}
app.get('/marci',(req,res)=>makeSeoPage(req,res,{heading:tx[LANGS.has(req.query.lang)?req.query.lang:'ro'].brands,urlPath:'/marci',items:store.products().slice(0,12).map(publicItem)}));
app.get('/marci/:brand',(req,res)=>{const make=SITE_BRANDS.find(b=>slug(b)===req.params.brand);if(!make)return res.status(404).send('Not found');const products=store.products().filter(p=>slug(p.brand)===slug(make)).map(publicItem).slice(0,40);makeSeoPage(req,res,{heading:make+' — '+tx[LANGS.has(req.query.lang)?req.query.lang:'ro'].parts,description:`${make}: ${tx[LANGS.has(req.query.lang)?req.query.lang:'ro'].desc}`,urlPath:'/marci/'+req.params.brand,items:products})});
app.get('/categorii/:category',(req,res)=>{const c=CATEGORIES.find(x=>x.id===req.params.category);if(!c)return res.status(404).send('Not found');makeSeoPage(req,res,{heading:c.name||req.params.category,description:tx[LANGS.has(req.query.lang)?req.query.lang:'ro'].desc,urlPath:'/categorii/'+req.params.category,items:store.products().filter(p=>p.category===c.id).map(publicItem).slice(0,60)})});
app.get('/catalog',(req,res)=>makeSeoPage(req,res,{heading:tx[LANGS.has(req.query.lang)?req.query.lang:'ro'].parts,urlPath:'/catalog',items:store.products().filter(p=>(!req.query.brand||String(p.brand).toLowerCase()===String(req.query.brand).toLowerCase())&&(!req.query.q||[p.name,p.sku,p.model].join(' ').toLowerCase().includes(String(req.query.q).toLowerCase()))).map(publicItem).slice(0,80)}));
app.get('/despre-noi',(req,res)=>makeSeoPage(req,res,{heading:tx[LANGS.has(req.query.lang)?req.query.lang:'ro'].why,urlPath:'/despre-noi'}));
app.get('/contact',(req,res)=>makeSeoPage(req,res,{heading:tx[LANGS.has(req.query.lang)?req.query.lang:'ro'].contact,urlPath:'/contact'}));
app.get('/recenzii',(req,res)=>makeSeoPage(req,res,{heading:{ro:'Recenzii ale clienților',ru:'Отзывы клиентов',uk:'Відгуки клієнтів',en:'Customer reviews'}[LANGS.has(req.query.lang)?req.query.lang:'ro'],description:'Only verified customer reviews, with translations when available.',urlPath:'/recenzii'}));
app.get('/p/:id',(req,res)=>{
 const p=store.find(req.params.id);if(!p||p.deleted||p.hidden||!p.name)return res.status(404).send('Not found');
 const lang=LANGS.has(req.query.lang)?req.query.lang:'ro',t=tx[lang],purl=BASE+'/p/'+encodeURIComponent(p.id);
 const price=store.customerPrice(p),image=p.image||p.images?.[0]||'';
 const tags=[...LANGS].map(l=>`<link rel="alternate" hreflang="${l}" href="${esc(purl+'?lang='+l)}">`).join('');
 const jsonLd={'@context':'https://schema.org','@type':'Product',name:localizeName(p.name,lang,p.name_translations),description:productSummary(p,lang),sku:p.sku||undefined,brand:p.brand?{'@type':'Brand',name:p.brand}:undefined,image:p.images?.length?p.images:(image?[image]:undefined),url:purl};
 if(price!=null&&p.stock==='available')jsonLd.offers={'@type':'Offer',price:Math.round(price),priceCurrency:'RON',availability:'https://schema.org/InStock',url:purl};
 const info=p.oem?.length?`<p>OEM: ${p.oem.slice(0,20).map(esc).join(', ')}</p>`:'';
 res.type('html').send(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#090909"><title>${esc(localizeName(p.name,lang,p.name_translations))} | AutoPiese Moldova</title><meta name="description" content="${esc((localizeName(p.name,lang,p.name_translations)+' '+productSummary(p,lang)+' · VIN OEM Moldova').slice(0,155))}"><meta name="robots" content="${p.sku&&image?'index,follow':'noindex,follow'}"><link rel="canonical" href="${esc(purl+'?lang='+lang)}">${tags}<link rel="stylesheet" href="/conversion.css"><style>body{background:#0a0a0a;color:white;font-family:Arial,sans-serif;padding:30px;margin:auto;max-width:1000px}a{color:#ff4362}main{display:grid;grid-template-columns:1fr 1fr;gap:28px}img{width:100%;height:420px;object-fit:contain;background:#fff;border-radius:16px;padding:16px;filter:none}h1{font-size:clamp(26px,4vw,44px)}button,.cta{display:inline-block;background:#d90429;border:0;border-radius:10px;color:white;font-weight:bold;padding:14px 22px;margin:12px 0}@media(max-width:700px){main{grid-template-columns:1fr}img{height:280px}}</style><script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g,'\u003c')}</script></head><body><header><a href="/?lang=${lang}">AutoPiese Moldova</a> · <a href="/catalog?lang=${lang}">${esc(t.parts)}</a></header><main><div>${image?`<img src="${esc(image)}" alt="${esc(p.name)}">`:''}</div><section><h1>${esc(localizeName(p.name,lang,p.name_translations))}</h1>${p.sku?`<p>OEM / SKU: ${esc(p.sku)}</p>`:''}<p>${esc(productSummary(p,lang))}</p>${info}<h2>${price===null?'Preț la cerere':Math.round(price)+' RON'}</h2><p>${esc(t.guarantee)}</p><a class="cta" href="/?lang=${lang}#request">${esc(t.cta)}</a><p><a href="tel:+37368712418">+373 687 12 418</a> · <a href="https://wa.me/37368712418">WhatsApp</a> · <a href="viber://chat?number=%2B37368712418">Viber</a></p></section></main></body></html>`);
});
app.get('/llms.txt',(req,res)=>res.type('text/plain').send(`# AutoPiese Moldova
Independent auto parts store for Moldova. Languages: Romanian, Russian, Ukrainian, English. Categories: steering racks, power steering pumps, AC compressors, accessories. New, used and refurbished parts. Contact +373 687 12 418.
Browse: ${BASE}/catalog
Brands: ${BASE}/marci
Sitemap: ${BASE}/sitemap.xml
Contact: ${BASE}/contact
Prices are indicative based on authorised supplier data and BNM exchange rates; availability and fitment are confirmed by consultant.
`));
app.get('/robots.txt',(req,res)=>res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/admin\nSitemap: ${BASE}/sitemap.xml\n`));
app.get('/sitemap.xml',(req,res)=>{let paths=['/','/catalog','/marci','/despre-noi','/contact','/recenzii',...CATEGORIES.map(c=>'/categorii/'+c.id),...SITE_BRANDS.map(b=>'/marci/'+slug(b)),...store.products().filter(p=>p.sku&&p.image).map(p=>'/p/'+p.id)];res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.flatMap(p=>[...LANGS].map(lang=>`<url><loc>${esc(BASE+p+'?lang='+lang)}</loc></url>`)).join('')+'</urlset>')});
app.get('/health',(req,res)=>res.json({status:'ok',storage:store.mode}));
const port=Number(process.env.PORT)||10000;app.listen(port,'0.0.0.0',()=>console.log(`AutoPiese Moldova v2 on port ${port}; ${store.mode}`));
setTimeout(async()=>{await updateRates();if(process.env.ENABLE_SUPPLIER_SYNC!=='false')syncCatalog().catch(console.error)},3500).unref();
setInterval(()=>{checkRateSchedule().catch(console.error)},30*1000).unref();
setInterval(()=>{if(process.env.ENABLE_SUPPLIER_SYNC!=='false')syncCatalog().catch(console.error)},24*60*60*1000).unref();
