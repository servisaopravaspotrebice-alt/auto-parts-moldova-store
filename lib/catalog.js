import * as cheerio from 'cheerio';
import crypto from 'node:crypto';

export const SUPPLIER_ORIGIN='https://www.dedauto.ro';
export const MARKUP_PERCENT=20;
export const CATEGORIES=[
  {id:'steering',label:'Casete de direcție'},
  {id:'powersteering',label:'Pompe servodirecție'},
  {id:'ac',label:'Compresoare A/C'},
  {id:'accessories',label:'Accesorii direcție'},
  {id:'engine',label:'Motor și componente'},
  {id:'transmission',label:'Transmisie și ambreiaj'},
  {id:'brakes',label:'Frâne'},
  {id:'suspension',label:'Suspensie'},
  {id:'electrical',label:'Electrice și senzori'},
  {id:'cooling',label:'Răcire motor'},
  {id:'filters',label:'Filtre'},
  {id:'exhaust',label:'Evacuare'},
  {id:'body',label:'Caroserie și iluminat'},
  {id:'other',label:'Alte piese'}
];
export const SUBCATEGORIES=[{id:'electrical',category:'steering',label:'Casete electrice'},{id:'hydraulic',category:'steering',label:'Casete hidraulice'},{id:'mechanical',category:'steering',label:'Casete mecanice'}];
export function clean(s){return String(s??'').replace(/\s+/g,' ').trim()}
export function parseRon(raw){
  let s=clean(raw).replace(/[\u00a0\s]|(?:RON|lei|LEI|EUR|€)/g,'').replace(/[^\d.,-]/g,'');
  if(!s)return null;
  if(s.includes(',')&&s.includes('.')){s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'')}
  else if(s.includes(',')){s=/,\d{1,2}$/.test(s)?s.replace(',','.'):s.replace(/,/g,'')}
  else if(/^\d{1,3}(?:\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
  const n=Number(s);return Number.isFinite(n)&&n>=0&&n<=1e8?n:null;
}
export function retailRon(supplierPrice){return Math.round((Number(supplierPrice)||0)*1.2*100)/100}
export function displayPrice(value){return Number.isFinite(Number(value))?Math.round(Number(value)):null}
export function conditionOf(t){const s=clean(t).toLowerCase();return /reconditionat|recondiționat|refurbished|remanufactured|refabricat/.test(s)?'refurbished':/\b(prod(us)? nou|nouă|nou|new)\b/.test(s)?'new':/second.hand|folosit|secondhand|\bsh\b|used|utilizat/.test(s)?'used':'unknown'}
export function categoryOf(t){const s=clean(t).toLowerCase();if(/accesorii|burduf|kit reparatie|accesoriu|curea|curele/.test(s))return 'accessories';if(/pomp[eaă]|servo(directie|direcție)/.test(s)&&!/caset/.test(s))return 'powersteering';if(/caset[aăe]|cremalier|direcție|directie|directe/.test(s))return 'steering';if(/compresor|aer\s+condi[țt]ionat|air condition/.test(s))return 'ac';if(/fran[ăa]|brake|discuri|disc de fr|placute|plăcuțe|etrier|caliper/.test(s))return 'brakes';if(/amortizor|suspens|shock absorber|brat suspensie|bieleta|arc elicoidal/.test(s))return 'suspension';if(/ambreiaj|cutie viteze|transmis|clutch|gearbox|volant[ăa]/.test(s))return 'transmission';if(/alternator|demaror|senzor|sensor|electr|starter|baterie|bobina/.test(s))return 'electrical';if(/radiator|termostat|antigel|racire|răcire|coolant|pompa de apa|pompă de apă/.test(s))return 'cooling';if(/filtru|filter|ulei motor|oil filter/.test(s))return 'filters';if(/evacuare|catalizator|toba|esapament|eșapament|exhaust|dpf/.test(s))return 'exhaust';if(/far|stop auto|bara fa[tț]a|arip[ăa]|caroser|body part|oglinda|mirror|grila/.test(s))return 'body';if(/motor|engine|piston|chiulas[ăa]|turbo|injector|distribu[tț]ie/.test(s))return 'engine';return 'other'}
export function subcategoryOf(t){const s=clean(t).toLowerCase();if(/electr(ic|ic[ăa]|on)/.test(s))return 'electrical';if(/hidraul|hydraul/.test(s))return 'hydraulic';if(/mecanic/.test(s))return 'mechanical';return ''}
export function brandOf(title){let s=' '+clean(title).toLowerCase()+' ';const d={volkswagen:'Volkswagen',vw:'Volkswagen',audi:'Audi',mercedes:'Mercedes-Benz',skoda:'Škoda',škoda:'Škoda',seat:'SEAT',bmw:'BMW',opel:'Opel',ford:'Ford',renault:'Renault',dacia:'Dacia',peugeot:'Peugeot',citroen:'Citroën',citroën:'Citroën',fiat:'Fiat',toyota:'Toyota',porsche:'Porsche',volvo:'Volvo',mazda:'Mazda',mitsubishi:'Mitsubishi',nissan:'Nissan',honda:'Honda',hyundai:'Hyundai',kia:'Kia',chevrolet:'Chevrolet'};for(const [key,v] of Object.entries(d))if(new RegExp('(^|[^a-z])'+key+'([^a-z]|$)','i').test(s))return v;return ''}
export function validUrl(raw){try{const u=new URL(raw,SUPPLIER_ORIGIN);return u.protocol==='https:'&&['www.dedauto.ro','dedauto.ro'].includes(u.hostname)?u.href:null}catch{return null}}
export function idFor(url){return 'dedauto-'+crypto.createHash('sha256').update(String(url)).digest('hex').slice(0,18)}
export function inferProductName(url){let s=new URL(url).pathname.split('/').pop().replace(/\.html$/,'');return s.replace(/-/g,' ').replace(/\b\w/g,x=>x.toUpperCase())}
export function fromSupplier(fields){const url=validUrl(fields.url||fields.link);if(!url)return null;const name=clean(fields.name||fields.title)||inferProductName(url),sp=fields.supplier_price_ron!=null?parseRon(fields.supplier_price_ron):parseRon(fields.price);
  return {id:idFor(url),source:'dedauto',name,brand:clean(fields.brand)||brandOf(name),model:clean(fields.model),category:fields.category||categoryOf(name),subcategory:fields.subcategory||subcategoryOf(name),condition:fields.condition||conditionOf(name),sku:clean(fields.sku),supplier_code:clean(fields.supplier_code),description:clean(fields.description).slice(0,10000),oem:Array.isArray(fields.oem)?fields.oem.slice(0,100).map(clean):[],images:(fields.images||[fields.image]).filter(Boolean).map(clean).slice(0,15),image:clean(fields.image||fields.images?.[0]),url,supplier_price_ron:sp,price_ron:sp===null?null:retailRon(sp),stock:fields.stock||'unknown',hidden:false,deleted:false,verified_at:new Date().toISOString().slice(0,10)};
}
export function parseSupplierHtml(html,url){const $=cheerio.load(html);const name=clean($('h1').first().text());if(!name)return null;
  let supplierPrice=null;for(const [selector,attribute] of [['meta[property="product:price:amount"]','content'],['meta[property="og:price:amount"]','content'],['[itemprop="price"]','content']]){let n=parseRon($(selector).first().attr(attribute));if(n!==null){supplierPrice=n;break}}
  if(supplierPrice===null){let m=$('body').text().match(/(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?)\s*(?:Lei|RON)/i);if(m)supplierPrice=parseRon(m[1]);}
  const body=clean($('body').text());const sku=clean($('[itemprop="sku"]').first().text())||body.match(/Cod Produs:\s*([\w-]+)/i)?.[1]||'';const supplier_code=body.match(/Cod DED AUTO:\s*([\w-]+)/i)?.[1]||'';
  let images=$('img[src*="/files/product/"]').map((_,el)=>$(el).attr('src')).get().filter(Boolean).map(x=>{try{return new URL(x,SUPPLIER_ORIGIN).href}catch{return''}}).filter(x=>/^https:\/\/(gomagcdn\.ro|www\.dedauto\.ro)\//.test(x));images=[...new Set(images)].slice(0,12);
  if(!images.length){const img=$('meta[property="og:image"]').attr('content');if(img){try{images=[new URL(img,SUPPLIER_ORIGIN).href]}catch{}}}
  const oem=[];$('table tr').each((_,el)=>{const t=clean($(el).find('td:first-child').text());if(t&&/^[A-Z0-9 .-]{5,30}$/i.test(t)&&!oem.includes(t))oem.push(t)});
  const description=clean($('.tab-content,.product-description,[itemprop="description"]').first().text()).slice(0,10000);
  return fromSupplier({url,name,supplier_price_ron:supplierPrice,sku,supplier_code,images,image:images[0],description,oem,stock:/\bIn stoc\b/i.test(body)?'available':/Stoc epuizat/i.test(body)?'unavailable':'unknown'});
}
export function parseCatalogPage(html){const $=cheerio.load(html);const list=[];const seen=new Set();
  $('a[href]').each((_,el)=>{const href=validUrl($(el).attr('href'));if(!href||!href.endsWith('.html')||seen.has(href)||/\/(blog|politica|despre|termeni|garantia)\b/.test(href))return;
    let node=$(el).closest('article,li,[class*="product-item"],[class*="product-box"],[class*="product-card"]');
    if(!node.length)node=$(el).parent().parent();
    let title=clean($(el).attr('title')||$(el).find('h2,h3,h4').first().text()||node.find('h2,h3,h4').first().text()||$(el).text());
    if(!title||title.length<8)title=inferProductName(href);
    const img=node.find('img[src*="/files/product/"]').first().attr('src')||'';
    let pr=null;const m=clean(node.text()).match(/(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?)\s*(?:Lei|RON)/i);if(m)pr=parseRon(m[1]);
    const p=fromSupplier({url:href,name:title,image:img?new URL(img,SUPPLIER_ORIGIN).href:'',supplier_price_ron:pr});if(p){seen.add(href);list.push(p)}
  });return list;
}
export function parseCsv(csv){const lines=[];let cells=[],cell='',quoted=false;for(let i=0;i<csv.length;i++){const c=csv[i];if(c==='"'){if(quoted&&csv[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(!quoted&&(c===','||c===';'||c==='\t')){cells.push(cell);cell=''}else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&csv[i+1]==='\n')i++;cells.push(cell);if(cells.some(x=>clean(x)))lines.push(cells);cell='';cells=[]}else cell+=c}cells.push(cell);if(cells.some(x=>clean(x)))lines.push(cells);
  const head=lines.shift();if(!head)return[];const keys=head.map(x=>clean(x).toLowerCase().replace(/[ _-]/g,''));return lines.map(values=>Object.fromEntries(keys.map((k,i)=>[k,values[i]||''])));
}
export function parseFeed(raw,format){const products=[];if(format==='csv'||(!format&&/^(?:[^<>\n]+[;,\t]){2}/.test(raw))){for(const row of parseCsv(raw)){
    const g=(...keys)=>{for(const key of keys){let v=row[key.replace(/[ _-]/g,'').toLowerCase()];if(v!==undefined)return v}return ''};
    const url=g('url','link','producturl','productlink');let p=fromSupplier({url,name:g('name','title','denumire','nume','productname'),supplier_price_ron:g('price','pret','purchaseprice','supplierprice','price_ron','pretfurnizor'),sku:g('sku','code','cod','id'),image:g('image','imagelink','imageurl','picture'),category:g('category','categorie')||undefined,stock:/stoc|stock|available/i.test(g('availability','stock','stoc'))?'available':'unknown',description:g('description','descriere')});if(p)products.push(p)
  }}else{const $=cheerio.load(raw,{xmlMode:true});$('item,product,produs,entry').each((_,el)=>{const node=$(el);const g=(...names)=>{for(let name of names){const v=node.children().filter((_,e)=>{let tag=String(e.name||'').toLowerCase().split(':').pop();return tag===name}).first().text();if(clean(v))return clean(v)}return ''};
    const img=g('image_link','image','picture','imagelink');const p=fromSupplier({url:g('link','url','product_url'),name:g('title','name','denumire'),supplier_price_ron:g('price','pret','sale_price'),image:img,sku:g('id','sku','code','mpn'),description:g('description','descriere'),category:g('product_type','category')||undefined,stock:/in.stock|available/i.test(g('availability','stock'))?'available':'unknown'});if(p)products.push(p)
  });}return [...new Map(products.map(p=>[p.id,p])).values()];
}
export function parseBnmXml(xml){const $=cheerio.load(xml,{xmlMode:true});const rates={MDL:1};$('Valute,valute').each((_,el)=>{const o=$(el),code=clean(o.find('CharCode,charcode').first().text()),val=parseRon(o.find('Value,value').first().text()),nom=Number(clean(o.find('Nominal,nominal').first().text())||'1');if(['RON','USD','EUR'].includes(code)&&val!==null&&nom>0)rates[code]=val/nom});if(!['RON','USD','EUR'].every(x=>rates[x]>0))throw Error('BNM_XML_INCOMPLETE');return {date:$('ValCurs,valcurs').first().attr('Date')||$('ValCurs,valcurs').first().attr('date')||new Date().toISOString().slice(0,10),rates,updatedAt:new Date().toISOString(),fallback:false}}
