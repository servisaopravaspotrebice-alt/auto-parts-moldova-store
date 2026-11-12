// SEO upgrade for bundled store. Safe to rerun; does not alter customer or product data.
import fs from 'node:fs';
import path from 'node:path';
const target=path.join(process.cwd(),'server.js');
const locales={
ro:['Piese auto noi și second-hand în Moldova | AutoPiese Moldova','Piese auto noi, folosite și recondiționate în Moldova. Solicitați piese după VIN, cod OEM, marcă sau model. Compatibilitatea se verifică înainte de comandă.'],
ru:['Автозапчасти в Молдове — подбор по VIN и OEM | AutoPiese Moldova','Новые, б/у и восстановленные автозапчасти в Молдове. Подбор по VIN, OEM-коду или модели авто. Наличие и совместимость уточняются перед заказом.'],
uk:['Автозапчастини в Молдові — пошук за VIN та OEM | AutoPiese Moldova','Нові, вживані й відновлені автозапчастини у Молдові. Пошук за VIN, OEM-кодом або моделлю авто. Сумісність перевіряємо перед замовленням.'],
en:['New and Used Car Parts in Moldova | VIN & OEM | AutoPiese Moldova','New, used and refurbished car parts in Moldova. Request parts by VIN, OEM code or vehicle model. We verify fitment and availability before an order.']
};
const names={
steering:['Casete de direcție în Moldova','Рулевые рейки в Молдове','Рульові рейки в Молдові','Steering racks in Moldova'],
powersteering:['Pompe servodirecție în Moldova','Насосы ГУР в Молдове','Насоси гідропідсилювача в Молдові','Power steering pumps in Moldova'],
ac:['Compresoare A/C auto','Компрессоры автокондиционеров','Компресори автокондиціонера','Car A/C compressors'],
accessories:['Accesorii și kituri de reparație','Ремкомплекты и аксессуары','Ремкомплекти й аксесуари','Repair kits and accessories'],
engine:['Piese pentru motor','Запчасти двигателя','Запчастини двигуна','Engine parts'],
transmission:['Piese pentru transmisie','Запчасти трансмиссии','Запчастини трансмісії','Transmission parts'],
brakes:['Piese pentru frâne','Запчасти тормозной системы','Запчастини гальмівної системи','Brake parts'],
suspension:['Piese pentru suspensie','Запчасти подвески','Запчастини підвіски','Suspension parts'],
electrical:['Piese electrice auto','Автоэлектрика','Автоелектрика','Electrical parts'],
cooling:['Piese pentru răcire','Система охлаждения авто','Система охолодження авто','Cooling parts'],
filters:['Filtre auto','Автомобильные фильтры','Автомобільні фільтри','Car filters'],
exhaust:['Piese pentru evacuare','Выхлопная система авто','Вихлопна система авто','Exhaust parts'],
body:['Piese de caroserie','Кузовные запчасти','Кузовні запчастини','Body parts'],
other:['Alte piese auto','Другие автозапчасти','Інші автозапчастини','Other car parts']
};
const guidance={
steering:['Alegeți caseta de direcție după codul OEM, tipul servodirecției, anul și modelul exact. Verificați dacă piesa este nouă sau recondiționată și dacă se solicită piesa veche la schimb. Compatibilitatea se confirmă după VIN.','Для выбора рулевой рейки сравните OEM, тип усилителя и год выпуска автомобиля. Уточните, новая ли деталь или восстановленная и требуется ли обмен. Подбор обязательно подтвердите по VIN.','Для вибору рульової рейки звірте OEM, тип підсилювача й рік випуску. Уточніть стан деталі та можливість обміну. Перевірте сумісність за VIN.','Choose steering racks by OEM, power steering type and exact model year. Check new versus refurbished condition, exchange terms and VIN fitment.'],
powersteering:['Pompele servodirecției diferă după cod OEM, racorduri și tip de acționare. Confirmați configurația exactă a automobilului înainte de comandă.','Насосы ГУР различаются OEM-кодом, соединениями и типом привода. Проверьте комплектацию автомобиля и совместимость по VIN перед заказом.','Насоси гідропідсилювача відрізняються OEM-кодом, з’єднаннями та приводом. Перевірте комплектацію й VIN.','Power steering pumps vary by OEM, connections and drive type. Check vehicle configuration and VIN before ordering.'],
ac:['Comparați codul OEM, fulia, conectorii și tipul compresorului A/C. Verificați cauza defectării sistemului înainte de montaj și confirmați compatibilitatea după VIN.','Компрессоры кондиционера отличаются OEM-кодом, шкивом, разъёмами и типом управления. Сначала выясните причину поломки, затем подтвердите подбор по VIN.','Компресори кондиціонера відрізняються OEM, шківом, роз’ємами та керуванням. Знайдіть причину поломки й звірте VIN.','Compare A/C compressor OEM numbers, pulley, connectors and control type. Diagnose system failure and confirm VIN fitment.'],
accessories:['La alegerea unui kit de reparație verificați codul piesei principale, dimensiunile și componentele incluse. Confirmați compatibilitatea înainte de cumpărare.','При выборе ремкомплекта сравните номер детали, размеры и состав набора. Уточните совместимость перед покупкой.','Порівняйте номер деталі, розміри й склад ремкомплекту. Перевірте сумісність до покупки.','For repair kits, verify the primary part number, dimensions, included pieces and compatibility.'],
other:['Dacă nu cunoașteți numele exact al piesei, trimiteți codul OEM, VIN-ul sau o fotografie. Un consultant poate clarifica denumirea înainte de ofertă.','Если название детали неизвестно, отправьте OEM-код, VIN или фотографию. Консультант поможет уточнить наименование до предложения цены.','Якщо назва деталі невідома, надішліть OEM, VIN або фото. Консультант допоможе з назвою та сумісністю.','If a part name is unknown, send an OEM code, VIN or photo to identify the part before quoting.']
};
function homeRoute(req,res,next){
 const lang=Object.hasOwn(SEO_HOME_20261112,req.query.lang)?req.query.lang:'ro';
 const meta=SEO_HOME_20261112[lang];
 const base=(process.env.PUBLIC_BASE_URL||'https://autopiese-moldova-full.onrender.com').replace(/\/+$/,'');
 const escAttr=s=>String(s).replace(/[&"<]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;'}[c]));
 const href=l=>base+'/?lang='+l;
 fs.readFile(path.join(ROOT,'public','index.html'),'utf8').then(html=>{
  html=html.replace(/<html\b[^>]*>/i,'<html lang="'+lang+'">')
   .replace(/<title>[\s\S]*?<\/title>/i,'<title>'+escAttr(meta[0])+'</title>')
   .replace(/<meta\b[^>]*name=["']description["'][^>]*>/gi,'')
   .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi,'')
   .replace(/<link\b[^>]*hreflang=["'][^"']+["'][^>]*>/gi,'')
   .replace(/<meta\b[^>]*property=["']og:(title|description|url)["'][^>]*>/gi,'');
  const alt=['ro','ru','uk','en'].map(l=>'<link rel="alternate" hreflang="'+l+'" href="'+escAttr(href(l))+'">').join('');
  const schema={'@context':'https://schema.org','@type':'WebSite',name:'AutoPiese Moldova',url:base+'/',inLanguage:['ro','ru','uk','en']};
  const tags='<meta name="description" content="'+escAttr(meta[1])+'"><link rel="canonical" href="'+escAttr(href(lang))+'">'+alt+
   '<link rel="alternate" hreflang="x-default" href="'+escAttr(href('ro'))+'">'+
   '<meta property="og:title" content="'+escAttr(meta[0])+'"><meta property="og:description" content="'+escAttr(meta[1])+'">'+
   '<meta property="og:url" content="'+escAttr(href(lang))+'"><script type="application/ld+json">'+JSON.stringify(schema)+'</script>';
  res.type('html').send(html.replace(/<\/head>/i,tags+'</head>'));
 }).catch(next);
}
function sitemapRoute(req,res){
 const items=store.products().filter(p=>p.name&&!p.deleted&&!p.hidden);
 const paths=['/','/catalog','/marci','/despre-noi','/contact',
  ...CATEGORIES.filter(c=>items.some(p=>p.category===c.id)).map(c=>'/categorii/'+c.id),
  ...SITE_BRANDS.filter(b=>items.some(p=>slug(p.brand)===slug(b))).map(b=>'/marci/'+slug(b)),
  ...items.filter(p=>p.sku&&(p.image||p.images?.[0])).map(p=>'/p/'+encodeURIComponent(p.id))];
 const e=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const xml=[...new Set(paths)].flatMap(p=>[...LANGS].map(l=>{
  const href=x=>BASE.replace(/\/+$/,'')+p+'?lang='+x;
  const links=[...LANGS].map(x=>'<xhtml:link rel="alternate" hreflang="'+x+'" href="'+e(href(x))+'"/>').join('');
  return '<url><loc>'+e(href(l))+'</loc>'+links+'<xhtml:link rel="alternate" hreflang="x-default" href="'+e(href('ro'))+'"/></url>';
 })).join('');
 res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'+xml+'</urlset>');
}
if(fs.existsSync(target)){
 let source=fs.readFileSync(target,'utf8'),old=source;
 const staticAnchor="app.use(express.static(path.join(ROOT,'public'),{extensions:['html'],maxAge:'2m'}));";
 if(!source.includes('SEO_HOME_20261112')&&source.includes(staticAnchor))
  source=source.replace(staticAnchor,'const SEO_HOME_20261112='+JSON.stringify(locales)+';\napp.get("/",'+homeRoute.toString()+');\n'+staticAnchor);
 if(!source.includes('SEO_CATEGORY_NAMES_20261112')&&source.includes('function makeSeoPage('))
  source=source.replace('function makeSeoPage(',
  'const SEO_CATEGORY_NAMES_20261112='+JSON.stringify(names)+';\nconst SEO_CATEGORY_TEXT_20261112='+JSON.stringify(guidance)+';\nfunction makeSeoPage(');
 const linkAnchor='const links=SITE_BRANDS.map(b=>';
 if(!source.includes('seoGuide20261112=')&&source.includes(linkAnchor)){
  source=source.replace(linkAnchor,
   "const catSeo20261112=pathx.startsWith('/categorii/')?pathx.split('/').pop():'';"+
   "const seoGuide20261112=(SEO_CATEGORY_TEXT_20261112[catSeo20261112]||{})[lang]||'';"+
   "const seoExtra20261112=seoGuide20261112?'<section><h2>'+esc(heading)+'</h2><p>'+esc(seoGuide20261112)+'</p></section>':'';\n "+linkAnchor);
  source=source.replace('<div class="seo-cards">','$'+'{seoExtra20261112}<div class="seo-cards">');
 }
 // Convert arrays to per-language keyed objects in generated server code.
 const keys=['ro','ru','uk','en'];
 const keyed=ob=>Object.fromEntries(Object.entries(ob).map(([k,a])=>[k,Object.fromEntries(keys.map((l,i)=>[l,a[i]]))]));
 source=source.replace('const SEO_CATEGORY_NAMES_20261112='+JSON.stringify(names),
  'const SEO_CATEGORY_NAMES_20261112='+JSON.stringify(keyed(names)));
 source=source.replace('const SEO_CATEGORY_TEXT_20261112='+JSON.stringify(guidance),
  'const SEO_CATEGORY_TEXT_20261112='+JSON.stringify(keyed(guidance)));
 source=source.replace('heading:c.name||req.params.category',
  "heading:(SEO_CATEGORY_NAMES_20261112[c.id]||{})[LANGS.has(req.query.lang)?req.query.lang:'ro']||c.name||req.params.category");
 source=source.replace("description:tx[LANGS.has(req.query.lang)?req.query.lang:'ro'].desc,urlPath:'/categorii/'+req.params.category",
  "description:(SEO_CATEGORY_TEXT_20261112[c.id]||{})[LANGS.has(req.query.lang)?req.query.lang:'ro']||tx[LANGS.has(req.query.lang)?req.query.lang:'ro'].desc,robots:store.products().some(p=>p.category===c.id)?'index,follow':'noindex,follow',urlPath:'/categorii/'+req.params.category");
 source=source.replace("urlPath:'/marci/'+req.params.brand,items:products})",
  "urlPath:'/marci/'+req.params.brand,items:products,robots:products.length?'index,follow':'noindex,follow'})");
 source=source.replace("urlPath:'/recenzii'}));","urlPath:'/recenzii',robots:'noindex,follow'}));");
 const begin=source.indexOf('href="/catalog?brand=');
 if(begin>=0){const end=source.indexOf('">',begin);if(end>begin&&end-begin<300)
  source=source.slice(0,begin)+'href="/p/'+'$'+'{encodeURIComponent(p.id)}?lang='+'$'+'{lang}'+source.slice(end);
 }
 const start=source.indexOf("app.get('/sitemap.xml'"),end=start<0?-1:source.indexOf("app.get('/health'",start);
 if(start>=0&&end>start&&!source.slice(start,end).includes('SEO_SITEMAP_20261112'))
  source=source.slice(0,start)+'// SEO_SITEMAP_20261112\napp.get("/sitemap.xml",'+sitemapRoute.toString()+');\n'+source.slice(end);
 if(source!==old){fs.writeFileSync(target,source);console.log('[seo] metadata, categories, sitemap updated');}
}
