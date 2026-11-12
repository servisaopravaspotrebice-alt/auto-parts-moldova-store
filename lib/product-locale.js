/**
 * Technical names supplied by DED Auto are Romanian. Localize terminology without
 * modifying make/model/OEM codes or relying on a translation service at render time.
 * Human translations stored by admins in product.name_translations override this glossary.
 */
export const LOCALES=['ro','ru','uk','en'];
const replacementRules={
  ru:[
    [/\b(?:Caset(?:a|e)|Casteta)\s+de\s+(?:direc(?:t|ț)ie|directe|diretie|dorectie)\b/gi,'Рулевая рейка'],
    [/\bCaset(?:a|e)\s+(?:electrice?|hidraulice?|mecanice?)\b/gi,'Рулевая рейка'],
    [/\bPompa\s+servodirec(?:t|ț)ie\b/gi,'Насос гидроусилителя руля'],
    [/\bPompa\s+servo\b/gi,'Насос ГУР'],
    [/\bCompresor(?:ul)?\s+(?:de\s+)?aer\s+condi(?:t|ț)ionat\b/gi,'Компрессор кондиционера'],
    [/\bCompresor\s+AC\b/gi,'Компрессор кондиционера'],
    [/Curea\s+servodirec(?:t|ț)ie\s+electric(?:a|ă)(?=$|[^\p{L}])/giu,'Ремень электроусилителя руля'],
    [/\bCurea\b/gi,'Ремень'],[/\bBurduf\b/gi,'Пыльник'],
    [/\bKit\s+repara(?:t|ț)ie\b/gi,'Ремкомплект'],
    [/\bAccesorii\b/gi,'Аксессуары'],
    [/produs\s+recondi(?:t|ț)ionat\s+de\s+uzin(?:a|ă)(?=$|[^\p{L}])/giu,'восстановленная на заводе'],
    [/\bprodus\s+recondi(?:t|ț)ionat\b/gi,'восстановленная'],
    [/\bpies(?:a|ă)\s+la\s+schimb\b/gi,'обменная деталь'],
    [/produs\s+nou(?=$|[^\p{L}])/giu,'новая'],[/produs\s+folosit(?=$|[^\p{L}])/giu,'б/у'],
    [/\bservodirec(?:t|ț)ie\b/gi,'гидроусилитель руля'],
    [/hidraulic(?:a|ă)?(?=$|[^\p{L}])/giu,'гидравлическая'],[/electric(?:a|ă)?(?=$|[^\p{L}])/giu,'электрическая'],
  ],
  uk:[
    [/\b(?:Caset(?:a|e)|Casteta)\s+de\s+(?:direc(?:t|ț)ie|directe|diretie|dorectie)\b/gi,'Рульова рейка'],
    [/\bCaset(?:a|e)\s+(?:electrice?|hidraulice?|mecanice?)\b/gi,'Рульова рейка'],
    [/\bPompa\s+servodirec(?:t|ț)ie\b/gi,'Насос гідропідсилювача керма'],
    [/\bPompa\s+servo\b/gi,'Насос ГПК'],
    [/\bCompresor(?:ul)?\s+(?:de\s+)?aer\s+condi(?:t|ț)ionat\b/gi,'Компресор кондиціонера'],
    [/\bCompresor\s+AC\b/gi,'Компресор кондиціонера'],
    [/Curea\s+servodirec(?:t|ț)ie\s+electric(?:a|ă)(?=$|[^\p{L}])/giu,'Ремінь електропідсилювача керма'],
    [/\bCurea\b/gi,'Ремінь'],[/\bBurduf\b/gi,'Пильовик'],
    [/\bKit\s+repara(?:t|ț)ie\b/gi,'Ремкомплект'],
    [/\bAccesorii\b/gi,'Аксесуари'],
    [/produs\s+recondi(?:t|ț)ionat\s+de\s+uzin(?:a|ă)(?=$|[^\p{L}])/giu,'відновлена на заводі'],
    [/\bprodus\s+recondi(?:t|ț)ionat\b/gi,'відновлена'],
    [/\bpies(?:a|ă)\s+la\s+schimb\b/gi,'обмінна деталь'],
    [/produs\s+nou(?=$|[^\p{L}])/giu,'нова'],[/produs\s+folosit(?=$|[^\p{L}])/giu,'вживана'],
    [/\bservodirec(?:t|ț)ie\b/gi,'гідропідсилювач керма'],
    [/hidraulic(?:a|ă)?(?=$|[^\p{L}])/giu,'гідравлічна'],[/electric(?:a|ă)?(?=$|[^\p{L}])/giu,'електрична'],
  ],
  en:[
    [/\b(?:Caset(?:a|e)|Casteta)\s+de\s+(?:direc(?:t|ț)ie|directe|diretie|dorectie)\b/gi,'Steering rack'],
    [/\bCaset(?:a|e)\s+(?:electrice?|hidraulice?|mecanice?)\b/gi,'Steering rack'],
    [/\bPompa\s+servodirec(?:t|ț)ie\b/gi,'Power steering pump'],
    [/\bPompa\s+servo\b/gi,'Power steering pump'],
    [/\bCompresor(?:ul)?\s+(?:de\s+)?aer\s+condi(?:t|ț)ionat\b/gi,'A/C compressor'],
    [/\bCompresor\s+AC\b/gi,'A/C compressor'],
    [/Curea\s+servodirec(?:t|ț)ie\s+electric(?:a|ă)(?=$|[^\p{L}])/giu,'Electric power steering belt'],
    [/\bCurea\b/gi,'Belt'],[/\bBurduf\b/gi,'Dust boot'],
    [/\bKit\s+repara(?:t|ț)ie\b/gi,'Repair kit'],
    [/\bAccesorii\b/gi,'Accessories'],
    [/produs\s+recondi(?:t|ț)ionat\s+de\s+uzin(?:a|ă)(?=$|[^\p{L}])/giu,'factory refurbished'],
    [/\bprodus\s+recondi(?:t|ț)ionat\b/gi,'refurbished'],
    [/\bpies(?:a|ă)\s+la\s+schimb\b/gi,'exchange part'],
    [/produs\s+nou(?=$|[^\p{L}])/giu,'new'],[/produs\s+folosit(?=$|[^\p{L}])/giu,'used'],
    [/\bservodirec(?:t|ț)ie\b/gi,'power steering'],
    [/hidraulic(?:a|ă)?(?=$|[^\p{L}])/giu,'hydraulic'],[/electric(?:a|ă)?(?=$|[^\p{L}])/giu,'electric'],
  ]
};
const detailRules={
 ru:[[/\bMod\s+operare\b/gi,'Тип привода'],[/\bTip\s+cremalier(?:a|ă)\b/gi,'Тип рулевого механизма'],[/\bGreutate\b/gi,'Вес'],[/\bVehicul\s+cu\s+volan\s+pe\s+partea\b/gi,'Расположение руля'],[/\bPartea\s+stanga\b/gi,'Левый руль'],[/\bEchivalente\s+cu\s+numerele\s+OE\b/gi,'Эквивалентные номера OE']],
 uk:[[/\bMod\s+operare\b/gi,'Тип приводу'],[/\bTip\s+cremalier(?:a|ă)\b/gi,'Тип кермового механізму'],[/\bGreutate\b/gi,'Вага'],[/\bVehicul\s+cu\s+volan\s+pe\s+partea\b/gi,'Розташування керма'],[/\bPartea\s+stanga\b/gi,'Ліве кермо'],[/\bEchivalente\s+cu\s+numerele\s+OE\b/gi,'Еквівалентні номери OE']],
 en:[[/\bMod\s+operare\b/gi,'Operating mode'],[/\bTip\s+cremalier(?:a|ă)\b/gi,'Steering rack type'],[/\bGreutate\b/gi,'Weight'],[/\bVehicul\s+cu\s+volan\s+pe\s+partea\b/gi,'Steering wheel side'],[/\bPartea\s+stanga\b/gi,'Left-hand drive'],[/\bEchivalente\s+cu\s+numerele\s+OE\b/gi,'Equivalent OE part numbers']],
};
export function localizeName(original,language='ro',overrides){
  const lang=LOCALES.includes(language)?language:'ro';
  const specific=overrides?.[lang];
  if(typeof specific==='string'&&specific.trim())return specific.trim();
  if(lang==='ro')return String(original||'');
  let result=String(original||'');
  for(const [re,replacement] of replacementRules[lang])result=result.replace(re,replacement);
  // Keep every brand, model, engine code and OEM number intact.
  return result.replace(/\s+/g,' ').trim();
}
export function localizeDescription(original,language='ro',overrides){
  const lang=LOCALES.includes(language)?language:'ro';
  const specific=overrides?.[lang];
  if(typeof specific==='string'&&specific.trim())return specific.trim();
  if(lang==='ro')return String(original||'');
  let result=String(original||'');
  for(const [re,replacement] of replacementRules[lang])result=result.replace(re,replacement);
  for(const [re,replacement] of detailRules[lang])result=result.replace(re,replacement);
  return result;
}
export function productLanguages(p){return Object.fromEntries(LOCALES.map(lang=>[lang,localizeName(p.name,lang,p.name_translations)]))}

const categoryTitles={
 ro:{steering:'casetă de direcție',powersteering:'pompă servodirecție',ac:'compresor aer condiționat',accessories:'accesoriu auto',other:'piesă auto'},
 ru:{steering:'рулевая рейка',powersteering:'насос ГУР',ac:'компрессор кондиционера',accessories:'аксессуар для автомобиля',other:'автозапчасть'},
 uk:{steering:'рульова рейка',powersteering:'насос ГПК',ac:'компресор кондиціонера',accessories:'автомобільний аксесуар',other:'автозапчастина'},
 en:{steering:'steering rack',powersteering:'power steering pump',ac:'A/C compressor',accessories:'car accessory',other:'auto part'}
};
const conditionTitles={
 ro:{new:'nouă',refurbished:'recondiționată',used:'second-hand',unknown:'de confirmat'},
 ru:{new:'новая',refurbished:'восстановленная',used:'б/у',unknown:'уточняется'},
 uk:{new:'нова',refurbished:'відновлена',used:'вживана',unknown:'уточнюється'},
 en:{new:'new',refurbished:'refurbished',used:'used',unknown:'to be confirmed'}
};
export function productSummary(product,language='ro') {
 const lang=LOCALES.includes(language)?language:'ro';
 const custom=product?.description_translations?.[lang];
 if(typeof custom==='string'&&custom.trim())return custom.trim();
 const name=localizeName(product?.name,lang,product?.name_translations);
 const state=(conditionTitles[lang][product?.condition]||conditionTitles[lang].unknown);
 const sku=product?.sku||'';
 const suffix={
  ro:`Stare: ${state}. ${sku?'Cod: '+sku+'. ':''}Verificați compatibilitatea după VIN sau codul OEM înainte de comandă.`,
  ru:`Состояние: ${state}. ${sku?'Артикул: '+sku+'. ':''}Перед заказом уточните совместимость по VIN или OEM-коду.`,
  uk:`Стан: ${state}. ${sku?'Артикул: '+sku+'. ':''}Перед замовленням перевірте сумісність за VIN або OEM-кодом.`,
  en:`Condition: ${state}. ${sku?'Part number: '+sku+'. ':''}Confirm fitment using the VIN or OEM number before ordering.`
 };
 return `${name}. ${suffix[lang]}`;
}
