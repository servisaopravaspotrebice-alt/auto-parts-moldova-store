// AutoPiese Moldova v8 supplier data safety hotfix, executed before the bundled app starts.
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const catalogFile=path.join(root,'lib','catalog.js');
const serverFile=path.join(root,'server.js');
if(fs.existsSync(catalogFile)){
 let c=fs.readFileSync(catalogFile,'utf8');
 const before="export function categoryOf(t){let s=clean(t).toLowerCase();if(/accesorii|burduf|kit reparatie|accesoriu/.test(s))return 'accessories';if(/compresor|conditionat|condiționat|air condition/.test(s))return 'ac';if(/pomp[ea]|servodirectie|servodirecție/.test(s))return 'powersteering';if(/caseta|casete|directie|direcție|cremalier/.test(s))return 'steering';return 'other'}";
 const after="export function categoryOf(t){const s=clean(t).toLowerCase();if(/accesorii|burduf|kit reparatie|accesoriu|curea|curele/.test(s))return 'accessories';if(/pomp[eaă]|servo(directie|direcție)/.test(s)&&!/caset/.test(s))return 'powersteering';if(/caset[aăe]|cremalier|direcție|directie|directe/.test(s))return 'steering';if(/compresor|aer\\s+condi[țt]ionat|air condition/.test(s))return 'ac';return 'other'}";
 if(c.includes(before)){c=c.replace(before,after);fs.writeFileSync(catalogFile,c);}
}
if(fs.existsSync(serverFile)){
 let t=fs.readFileSync(serverFile,'utf8');
 if(!t.includes('function sanitizedSupplierTechnicalText')){
  const helper="function sanitizedSupplierTechnicalText(raw){const t=String(raw||'');let d=t.includes('**Mod operare:**')?t.slice(t.indexOf('**Mod operare:**')):t.includes('**Tip cremaliera:**')?t.slice(t.indexOf('**Tip cremaliera:**')):'';d=d.split(/Informatii conformitate produs|Review-ul a fost trimis|Daca doresti|Produse similare/i)[0];return d.replace(/\\*\\*/g,'').replace(/\\+40[\\d ()-]{7,25}/g,'').replace(/\\s+/g,' ').slice(0,1100).trim()}\n";
  t=t.replace('const SNAPSHOT_SEEDS=SNAPSHOT_ROWS.map',helper+'const SNAPSHOT_SEEDS=SNAPSHOT_ROWS.map');
  t=t.replace('const p=fromSupplier(row);return p?{...p,last_import_success:',"const p=fromSupplier({...row,description:sanitizedSupplierTechnicalText(row.description)});return p?{...p,last_import_success:");
  t=t.replace("const store=await new Store(ROOT).init([...SNAPSHOT_SEEDS,...SUPPLIER_SEEDS,...SEED]);","const SEED_CLEAN=SEED.filter(item=>!SNAPSHOT_SEEDS.some(p=>item.sku&&p.sku&&item.sku===p.sku));\nconst store=await new Store(ROOT).init([...SNAPSHOT_SEEDS,...SUPPLIER_SEEDS,...SEED_CLEAN]);");
  t=t.replace('id:p.id,source:p.source,name:p.name,brand:', 'id:p.id,name:p.name,brand:');
  t=t.replace('supplier_code:p.supplier_code,description:p.description,','description:sanitizedSupplierTechnicalText(p.description),');
  t=t.replace('view360:!!p.view360&&Array.isArray(p.images)&&p.images.length>=8,url:p.url,price_ron:', 'view360:!!p.view360&&Array.isArray(p.images)&&p.images.length>=8,price_ron:');
  fs.writeFileSync(serverFile,t);
 }
}
