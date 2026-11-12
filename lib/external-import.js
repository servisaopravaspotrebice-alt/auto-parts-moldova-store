/** Authorized, public-Internet-only importer for independent automotive parts suppliers.
 * Supports XML sitemaps (including indexes), HTML catalog/listing pages, JSON-LD products,
 * microdata and RSS/Google-Merchant-like CSV/XML feeds. No credentials, bypassing, or scraping login pages.
 */
import * as cheerio from 'cheerio';
import crypto from 'node:crypto';
import https from 'node:https';
import dns from 'node:dns/promises';
import net from 'node:net';
import {clean,parseRon,brandOf,categoryOf,subcategoryOf,conditionOf} from './catalog.js';

const UA='AutoPieseMoldova/1.0 (authorized supplier catalog importer; contact shop operator)';
const REJECT_SUFFIXES=['.local','.internal','.localhost','.test','.invalid','.onion'];
const RON_CURRENCIES=new Set(['RON','EUR','USD','MDL']);
function inRange(ip,block,mask){const parts=ip.split('.').map(Number);if(parts.length!==4||parts.some(x=>x<0||x>255))return false;const num=parts.reduce((v,p)=>((v<<8)>>>0)|p,0)>>>0;return ((num & (0xffffffff<<(32-mask)))>>>0)===((block & (0xffffffff<<(32-mask)))>>>0)}
function numericIPv4(ip){const p=ip.split('.').map(Number);return p.length===4?p.reduce((v,x)=>((v<<8)>>>0)|x,0)>>>0:0}
export function publicIPv4(ip){if(net.isIP(ip)!==4)return false;
 for(const [str,mask] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]])if(inRange(ip,numericIPv4(str),mask))return false;
 return true}
export function normalizePublicUrl(input){let u;try{u=new URL(String(input||'').trim())}catch{throw Error('URL_INVALID')}
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||u.hostname.length>253||!u.hostname.includes('.')||REJECT_SUFFIXES.some(x=>u.hostname.endsWith(x))||net.isIP(u.hostname)||u.hostname==='localhost')throw Error('PUBLIC_HTTPS_URL_REQUIRED');
 if(u.href.length>2000)throw Error('URL_TOO_LONG');u.hash='';return u;
}
async function resolvePublic(host){const addresses=await dns.lookup(host,{family:4,all:true,verbatim:true});if(!addresses.length||addresses.some(x=>!publicIPv4(x.address)))throw Error('HOST_NOT_PUBLIC');return addresses[0].address}
export async function safeFetchPage(input,{maxBytes=3_000_000,timeout=16000,expectedHostname,redirects=0}={}){
 const u=normalizePublicUrl(input);
 if(expectedHostname&&u.hostname!==expectedHostname)throw Error('CROSS_DOMAIN_REDIRECT_BLOCKED');
 const ip=await resolvePublic(u.hostname);
 return new Promise((resolve,reject)=>{
  let done=false;const req=https.request({hostname:u.hostname,port:443,path:u.pathname+u.search,method:'GET',timeout,servername:u.hostname,headers:{'user-agent':UA,accept:'text/html,application/xhtml+xml,application/xml,text/xml,text/csv,text/plain;q=.7,*/*;q=.1'},lookup:(host,opts,cb)=>cb(null,ip,4)},res=>{
   const status=res.statusCode||0;
   if(status>=300&&status<400){if(redirects>=3){res.resume();return reject(Error('TOO_MANY_REDIRECTS'))}const loc=res.headers.location;res.resume();if(!loc)return reject(Error('REDIRECT_WITHOUT_LOCATION'));let redirect;try{redirect=new URL(loc,u.href)}catch{return reject(Error('BAD_REDIRECT'))}if(redirect.hostname!==u.hostname)return reject(Error('CROSS_DOMAIN_REDIRECT_BLOCKED'));return safeFetchPage(redirect.href,{maxBytes,timeout,expectedHostname:u.hostname,redirects:redirects+1}).then(resolve,reject)}
   if(status<200||status>299){res.resume();return reject(Error(`SOURCE_HTTP_${status}`))}
   const ct=String(res.headers['content-type']||'').toLowerCase();if(ct&&!(ct.includes('text/')||ct.includes('xml')||ct.includes('json')||ct.includes('octet-stream'))) {res.resume();return reject(Error('NOT_TEXT_RESOURCE'))}
   let size=0,buffers=[];res.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){req.destroy(Error('SOURCE_PAGE_TOO_LARGE'));return}buffers.push(chunk)});res.on('end',()=>resolve({url:u.href,body:Buffer.concat(buffers).toString('utf8'),contentType:ct}));res.on('error',reject);
  });req.once('error',reject);req.on('timeout',()=>req.destroy(Error('SOURCE_TIMEOUT')));req.end();
 });
}
function normalizeLink(href,base,domain){try{let u=new URL(href,base);if(u.protocol!=='https:'||u.hostname!==domain||u.port||u.username||u.password)return null;u.hash='';return u.href}catch{return null}}
function imageLink(href,base){try{let u=new URL(href,base);if(u.protocol!=='https:'||u.username||u.password)return null;return u.href}catch{return null}}
function extractLdProducts(node,out=[]){if(!node)return out;if(Array.isArray(node)){node.forEach(x=>extractLdProducts(x,out));return out}if(typeof node==='object'){
  const types=[].concat(node['@type']||[]).map(x=>String(x).toLowerCase());if(types.includes('product'))out.push(node);
  for(const [k,v] of Object.entries(node))if(k==='@graph'||k==='mainEntity'||k==='itemListElement'||k==='item')extractLdProducts(v,out);
 }return out}
function extractLd($){let products=[];$('script[type="application/ld+json"]').each((_,e)=>{try{extractLdProducts(JSON.parse($(e).html()||''),products)}catch{}});return products}
function getLdPrice(ld){let offers=Array.isArray(ld?.offers)?ld.offers[0]:ld?.offers||{};return {raw:offers?.price??offers?.priceSpecification?.price??null,currency:String(offers?.priceCurrency||offers?.priceSpecification?.priceCurrency||'').toUpperCase(),availability:String(offers?.availability||'')}}
function findName($,ld){return clean(ld?.name||$('h1').first().text()||$('meta[property="og:title"]').attr('content'))}
function basicPrice($,ld){const o=getLdPrice(ld),raw=o.raw??$('meta[property="product:price:amount"]').attr('content')??$('[itemprop="price"]').first().attr('content')??$('[itemprop="price"]').first().text(),currency=o.currency||String($('meta[property="product:price:currency"]').attr('content')||'').toUpperCase();let amount=parseRon(raw);if(amount===null){let m=clean($('body').text().slice(0,7000)).match(/(?:pre[țt]|price|cost|pret|€|RON|lei)\s*[:\-]?\s*([\d.,\s]+)|([\d.,\s]+)\s*(RON|lei|EUR|€|MDL|USD)/i);amount=m?parseRon(m[1]||m[2]):null}return {amount,currency};}
export function sourceProductFromHtml(html,url,{markup=20,rates}={}){
 const u=normalizePublicUrl(url),$=cheerio.load(html),ld=extractLd($)[0]||{};
 const name=findName($,ld);if(!name||name.length<5)return null;
 const {amount,currency}=basicPrice($,ld);const bodyHead=clean($('body').text().slice(0,5500));const detectedCurrency=/\b(?:MDL|RON|EUR|USD)\b/i.exec(bodyHead)?.[0]?.toUpperCase()||(/€/.test(bodyHead)?'EUR':null);const assumedCurrency=u.hostname.endsWith('.ro')?'RON':u.hostname.endsWith('.md')?'MDL':null;const selectedCurrency=RON_CURRENCIES.has(currency)?currency:RON_CURRENCIES.has(detectedCurrency)?detectedCurrency:assumedCurrency;
 let priceRon=null;if(amount!==null&&selectedCurrency){const c=rates?.[selectedCurrency],ron=rates?.RON;if(c&&ron)priceRon=Math.round(amount*c/ron*100)/100;else if(selectedCurrency==='RON')priceRon=amount;}
 let images=[...new Set([].concat(ld.image||[]).map(x=>typeof x==='string'?x:x?.url).concat([
 $('meta[property="og:image"]').attr('content'),$('[itemprop="image"]').first().attr('src'),$('.product-image img,.product-images img,.gallery img,.product-gallery img').first().attr('src'),
 ...$('img[src],img[data-src]').slice(0,25).map((_,el)=>$(el).attr('data-src')||$(el).attr('src')).get()
 ]).filter(Boolean).map(x=>imageLink(x,url)).filter(Boolean))].filter(x=>!/(?:logo|icon|sprite|favicon|banner|placeholder)/i.test(x)).slice(0,15);
 const sku=clean(ld.sku||ld.mpn||$('[itemprop="sku"]').first().text()||$('meta[property="product:retailer_item_id"]').attr('content')||$('body').text().match(/(?:SKU|Cod Produs|Артикул|Cod OEM)\s*[:#]\s*([A-Za-z0-9\-_]+)/i)?.[1]||'').slice(0,120);
 const description=clean(ld.description||$('meta[name="description"]').attr('content')||$('.product-description,[itemprop="description"]').first().text()).slice(0,2400);
 const availability=getLdPrice(ld).availability;
 const brand=clean(typeof ld.brand==='string'?ld.brand:ld.brand?.name||brandOf(name)).slice(0,100);
 const id='external-'+crypto.createHash('sha256').update(u.href).digest('hex').slice(0,18);
 return {id,source:'external:'+u.hostname,source_site:u.origin,url:u.href,name,brand,model:'',category:categoryOf(name),subcategory:subcategoryOf(name),condition:conditionOf(name),sku,description,images,image:images[0]||'',oem:[],stock:/InStock/i.test(availability)?'available':/OutOfStock/i.test(availability)?'unavailable':'unknown',supplier_currency:selectedCurrency||'unknown',supplier_original_price:amount,supplier_price_ron:priceRon,supplier_markup_percent:markup,price_ron:priceRon===null?null:Math.round(priceRon*(1+markup/100)*100)/100,hidden:false,deleted:false,verified_at:new Date().toISOString().slice(0,10),last_import_success:new Date().toISOString()};
}
function likelyProduct(href,title){const s=(href+' '+title).toLowerCase();return /\.html(?:\?|$)|\/product\/|\/produs\/|\/p\/|\/products\/|\/item\/|\/articol\/|\/detail\//.test(s)&&!/\/blog\/|\/category\/|\/categorii\/|\/terms|\/shipping|\/contact|\/login|\/register|\/checkout|\/privacy/.test(s)}
export function listingProductLinks(html,base,host){const $=cheerio.load(html),links=[];$('a[href]').each((_,el)=>{const href=normalizeLink($(el).attr('href'),base,host);if(href&&likelyProduct(href,clean($(el).text()))&&href!==base)links.push(href)});return [...new Set(links)];}
export function extractSitemapLinks(xml,base,hostname){const $=cheerio.load(xml,{xmlMode:true});const lists=[];const pages=[];$('sitemap loc').each((_,e)=>{const x=normalizeLink($(e).text(),base,hostname);if(x&&/\.xml(?:\?|$)/i.test(x))lists.push(x)});$('url loc').each((_,e)=>{const x=normalizeLink($(e).text(),base,hostname);if(x)pages.push(x)});return {sitemaps:[...new Set(lists)],pages:[...new Set(pages)]};}
export async function discoverCatalog(site,{limit=600,lookup=safeFetchPage,onProgress=()=>{}}={}){
 const target=normalizePublicUrl(site),host=target.hostname,home=target.origin+'/',queue=[target.href],visited=new Set(),sitemaps=[],products=[];const pushProduct=url=>{if(!products.includes(url)&&products.length<limit)products.push(url)};
 // sitemap.xml is the most dependable source for a complete catalog; robots.txt may mention others but should not override authorization.
 queue.push(target.origin+'/sitemap.xml');if(/\.xml(?:\?|$)/.test(target.pathname))queue.unshift(target.href);
 let sitemapFiles=0;const scanFailures=[];let pagesRead=0;
 while(queue.length&&visited.size<18&&products.length<limit){let url=queue.shift();if(visited.has(url))continue;visited.add(url);let page;try{page=await lookup(url,{maxBytes:3_000_000,timeout:17000,expectedHostname:host})}catch(e){scanFailures.push(String(e?.message||e));if(visited.size===1)onProgress({error:String(e.message)});continue}pagesRead++;
  if(/\.xml(?:\?|$)|\.xml\?/i.test(url)||page.contentType?.includes('xml')||/^\s*<\?xml/.test(page.body)){
   const map=extractSitemapLinks(page.body,url,host);
   for(const link of map.sitemaps)if(!visited.has(link)&&queue.length<50)queue.push(link);
   for(const link of map.pages)if(likelyProduct(link,'')||/products|produse|offer|part/i.test(url))pushProduct(link);
   sitemaps.push(url);sitemapFiles++;
  }else{
   const ld=extractLd(cheerio.load(page.body));if(ld.length)pushProduct(url);
   for(const link of listingProductLinks(page.body,url,host))pushProduct(link);
   const $=cheerio.load(page.body);let next=$('link[rel="next"]').first().attr('href')||$('a[rel="next"]').first().attr('href');if(next){const n=normalizeLink(next,url,host);if(n&&!visited.has(n))queue.push(n)}
  }
  onProgress({pagesScanned:visited.size,found:products.length});
 }
 if(!products.length){
  // Only diagnose an access block when no scanned page yielded readable HTML/XML.
  // A successful page without identifiable product URLs is a different issue.
  if(!pagesRead&&scanFailures.some(x=>/SOURCE_HTTP_(?:401|403|429)|SOURCE_ACCESS_RESTRICTED/.test(x)))throw Error('SOURCE_ACCESS_RESTRICTED');
  if(!pagesRead&&scanFailures.some(x=>/SOURCE_TIMEOUT|ETIMEDOUT|ESOCKETTIMEDOUT/.test(x)))throw Error('SOURCE_TIMEOUT');
  if(!pagesRead&&scanFailures.some(x=>/ENOTFOUND|EAI_AGAIN|getaddrinfo/.test(x)))throw Error('SITE_DNS_ERROR');
  if(!pagesRead&&scanFailures.length)throw Error('SOURCE_SCAN_UNAVAILABLE');
  throw Error('NO_PRODUCT_LINKS_FOUND');
 }
 return {website:target.origin,host,sourceUrl:target.href,links:products.slice(0,limit),sitemaps,scannedPages:visited.size,truncated:products.length>=limit||queue.length>0};
}
export async function previewSource(site,{markup=20,rates,lookup=safeFetchPage}={}){
 const map=await discoverCatalog(site,{limit:750,lookup});let samples=[],issues=[];
 for(const url of map.links.slice(0,5))try{const p=await lookup(url,{maxBytes:2_000_000,timeout:14000,expectedHostname:map.host});const prod=sourceProductFromHtml(p.body,url,{markup,rates});if(prod)samples.push(prod)}catch(e){issues.push({url,error:String(e.message)})}
 return {...map,discovered:map.links.length,links:undefined,samples,issues,requiresConfirmation:true};
}


/** Parse a public CSV/XML offer feed from an external provider. Prices are explicitly converted to RON once. */
export function externalFeedProducts(body,feedUrl,{markup=20,rates}={}){
 const $=cheerio.load(body,{xmlMode:true}),u=normalizePublicUrl(feedUrl),records=[];
 const toRow=(r)=>{
  const name=clean(r.name||r.title||r.denumire);if(!name)return;
  const url=normalizeLink(r.url||r.link||r.product_url||'',u.href,u.hostname);if(!url)return;
  const rawAmount=clean(r.price||r.pret||r.sale_price||r.amount),explicit=rawAmount.match(/\b(RON|EUR|USD|MDL)\b/i)?.[1]?.toUpperCase()||(/€/.test(rawAmount)?'EUR':null),c=clean(r.currency||r.price_currency||r.valuta||explicit||'').toUpperCase(),currency=RON_CURRENCIES.has(c)?c:u.hostname.endsWith('.ro')?'RON':u.hostname.endsWith('.md')?'MDL':null;
  const amount=parseRon(r.price||r.pret||r.sale_price||r.amount),rate=rates?.[currency],ron=rates?.RON;
  const supplierRon=amount==null||!currency?null:currency==='RON'?amount:rate&&ron?Math.round(amount*rate/ron*100)/100:null;
  const image=imageLink(r.image||r.image_link||r.picture||'',u.href);
  records.push({id:'external-'+crypto.createHash('sha256').update(url).digest('hex').slice(0,18),source:'external:'+u.hostname,source_site:u.origin,url,name,brand:brandOf(name),model:'',category:categoryOf(name),subcategory:subcategoryOf(name),condition:conditionOf(name),sku:clean(r.sku||r.id||r.mpn||r.cod||'').slice(0,120),description:clean(r.description||r.descriere||'').slice(0,2400),images:image?[image]:[],image:image||'',oem:[],stock:'unknown',supplier_currency:currency||'unknown',supplier_original_price:amount,supplier_price_ron:supplierRon,supplier_markup_percent:markup,price_ron:supplierRon===null?null:Math.round(supplierRon*(1+markup/100)*100)/100,hidden:false,deleted:false,verified_at:new Date().toISOString().slice(0,10),last_import_success:new Date().toISOString()});
 };
 if(/^\s*</.test(body)){
  $('product,item,entry,produs').each((_,el)=>{const o=$(el),data={};o.children().each((_,ch)=>{let tag=String(ch.name||'').toLowerCase().split(':').pop();data[tag]=clean($(ch).text())});toRow(data)});
 } else {
  const lines=body.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);if(lines.length<2)return [];
  const sep=[';',',','\t'].sort((a,b)=>lines[0].split(b).length-lines[0].split(a).length)[0];
  const parseLine=line=>{const arr=[];let v='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){v+='"';i++}else q=!q}else if(c===sep&&!q){arr.push(v);v=''}else v+=c}arr.push(v);return arr};
  const head=parseLine(lines.shift()).map(x=>clean(x).toLowerCase().replace(/[ \-]/g,'_'));
  for(const line of lines.slice(0,15000)){const values=parseLine(line);const data=Object.fromEntries(head.map((k,i)=>[k,values[i]||'']));toRow(data)};
 }
 return [...new Map(records.map(x=>[x.id,x])).values()];
}
