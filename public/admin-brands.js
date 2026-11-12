/* AutoPiese Moldova — admin vehicle make picker. Uses actual catalog brands. */
(()=>{
'use strict';
const input=document.getElementById('prodBrand');
const title=document.getElementById('prodName');
const dropdown=document.getElementById('brandSuggestions');
const toggle=document.getElementById('brandToggle');
const status=document.getElementById('brandAutoStatus');
if(!input||!title||!dropdown||!toggle) return;
const standard=['Abarth','Acura','Alfa Romeo','Aston Martin','Audi','Bentley','BMW','Buick','BYD','Cadillac','Chevrolet','Chrysler','Citroën','Cupra','Dacia','Daewoo','Daihatsu','Dodge','DS','Fiat','Ford','Geely','Genesis','GMC','Great Wall','Honda','Hummer','Hyundai','Infiniti','Isuzu','Iveco','Jaguar','Jeep','Kia','Lada','Lancia','Land Rover','Lexus','Lincoln','Mazda','Mercedes-Benz','MG','Mini','Mitsubishi','Nissan','Opel','Peugeot','Polestar','Pontiac','Porsche','RAM','Renault','Rolls-Royce','Rover','Saab','SEAT','Škoda','Smart','SsangYong','Subaru','Suzuki','Tesla','Toyota','Volkswagen','Volvo'];
const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
let catalog=new Set(),all=[...standard],highlight=-1,autoFilled=false,manual=false;
const aliases=new Map([
 ['vw','Volkswagen'],['volkswagen','Volkswagen'],['v w','Volkswagen'],
 ['mercedes benz','Mercedes-Benz'],['mercedes','Mercedes-Benz'],['mb','Mercedes-Benz'],
 ['skoda','Škoda'],['škoda','Škoda'],['seat','SEAT'],['citroen','Citroën'],['landrover','Land Rover'],['land rover','Land Rover'],
 ['bmw','BMW'],['audi','Audi'],['toyota','Toyota'],['nissan','Nissan'],['hyundai','Hyundai'],['kia','Kia'],
 ['renault','Renault'],['dacia','Dacia'],['volvo','Volvo'],['opel','Opel'],['ford','Ford'],['peugeot','Peugeot'],
 ['chevrolet','Chevrolet'],['porsche','Porsche'],['mitsubishi','Mitsubishi'],['mazda','Mazda'],['honda','Honda'],
 ['fiat','Fiat'],['subaru','Subaru'],['suzuki','Suzuki'],['iveco','Iveco'],['jeep','Jeep'],['mini','Mini']
]);
function refreshBrands(){
 const m=new Map();
 for(const x of [...catalog,...standard]){
  const name=String(x||'').trim();if(!name)continue;
  const key=normalize(name);
  if(!m.has(key)||catalog.has(name)) m.set(key,name);
 }
 all=[...m.values()].sort((a,b)=>{
  const ac=catalog.has(a),bc=catalog.has(b);return ac!==bc?(ac?-1:1):a.localeCompare(b,'ru');
 });
}
function canonical(value){const key=normalize(value);const exact=all.find(x=>normalize(x)===key);return exact||aliases.get(key)||value}
function inferFromName(name){
 const clean=normalize(name);
 if(!clean)return '';
 const found=[];
 const tests=[...all.map(x=>[normalize(x),x]),...aliases];
 for(const [key,b] of tests){
  if(!key)continue;
  const re=new RegExp('(?:^|\\s)'+key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:\\s|$)','i');
  const m=re.exec(clean);
  if(m)found.push({index:m.index,length:key.length,brand:canonical(b)});
 }
 found.sort((a,b)=>a.index-b.index||b.length-a.length);
 return found[0]?.brand||'';
}
function options(filter=''){
 const needle=normalize(filter);
 return all.filter(x=>!needle||normalize(x).includes(needle)).slice(0,35);
}
function opened(){return !dropdown.hidden}
function close(){dropdown.hidden=true;input.setAttribute('aria-expanded','false');highlight=-1}
function draw(filter='',showAll=false){
 const list=options(showAll?'':filter);
 dropdown.replaceChildren();highlight=-1;
 if(!list.length){const e=document.createElement('div');e.className='brand-no-match';e.textContent='Марка не найдена. Можно ввести новое название вручную.';dropdown.append(e)}
 for(const name of list){
  const btn=document.createElement('button');btn.type='button';btn.className='brand-option';btn.setAttribute('role','option');btn.setAttribute('aria-selected','false');
  const label=document.createElement('span');label.textContent=name;
  const meta=document.createElement('small');meta.textContent=catalog.has(name)?'Из каталога':'Другая марка';
  btn.append(label,meta);btn.addEventListener('mousedown',e=>e.preventDefault());btn.addEventListener('click',()=>choose(name));dropdown.append(btn);
 }
 dropdown.hidden=false;input.setAttribute('aria-expanded','true');
}
function choose(name){input.value=name;manual=true;autoFilled=false;status.textContent='';close();input.dispatchEvent(new Event('change',{bubbles:true}));input.focus()}
function maybeAutofill(){
 if(manual&&input.value.trim())return;
 if(input.value.trim()&&!autoFilled)return;
 const inferred=inferFromName(title.value);
 if(!inferred)return;
 input.value=inferred;autoFilled=true;status.textContent='Марка определена по названию: '+inferred;
 if(opened())draw(input.value);
}
function clearAuto(){autoFilled=false;manual=false;status.textContent=''}
input.addEventListener('focus',()=>draw(input.value));
input.addEventListener('input',()=>{manual=!!input.value.trim();autoFilled=false;status.textContent='';draw(input.value)});
input.addEventListener('blur',()=>{
 if(input.value.trim()) input.value=canonical(input.value.trim());
 setTimeout(()=>{if(!dropdown.contains(document.activeElement))close()},170);
});
toggle.addEventListener('click',()=>{if(opened()){close()}else{input.focus();draw('',true)}});
input.addEventListener('keydown',e=>{
 if(e.key==='Escape'){close();return}
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){
  if(!opened())draw(input.value);
  const buttons=[...dropdown.querySelectorAll('.brand-option')];if(!buttons.length)return;
  e.preventDefault();highlight=(highlight+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
  buttons.forEach((b,i)=>b.setAttribute('aria-selected',i===highlight?'true':'false'));
  buttons[highlight].scrollIntoView({block:'nearest'});
 }
 if(e.key==='Enter'&&opened()&&highlight>=0){e.preventDefault();const name=dropdown.querySelectorAll('.brand-option')[highlight]?.querySelector('span')?.textContent;if(name)choose(name)}
});
title.addEventListener('input',maybeAutofill);
// When editing an existing item, preserve its stored brand; only infer if missing.
document.getElementById('adminProducts')?.addEventListener('click',e=>{
 if(!e.target.closest('[data-edit]'))return;
 clearAuto();setTimeout(()=>{if(!input.value.trim())maybeAutofill();else input.value=canonical(input.value)},0);
});
document.getElementById('productReset')?.addEventListener('click',()=>{clearAuto();close()});
document.getElementById('productForm')?.addEventListener('submit',()=>{
 if(!input.value.trim())maybeAutofill();
 if(input.value.trim())input.value=canonical(input.value.trim());
},true);
document.addEventListener('pointerdown',e=>{if(!document.getElementById('brandCombobox').contains(e.target))close()});
async function loadCatalogBrands(){
 try{
  const response=await fetch('/api/categories',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const json=await response.json();
  if(Array.isArray(json.brands)) for(const name of json.brands){if(name&&String(name).trim().length<=100)catalog.add(String(name).trim())}
  refreshBrands();if(opened())draw(input.value);
 }catch{refreshBrands()}
}
refreshBrands();loadCatalogBrands();
})();
