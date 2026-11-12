// Repack the exact deployment bundle with the repository's tested safety and SEO patches.
// Intended for a review branch: this script does not deploy or touch production data.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(repo,'deploy','store-v7.b64');
const work=fs.mkdtempSync(path.join(os.tmpdir(),'autopiese-bundle-'));
const bundle=path.join(work,'original.zip');
const extracted=path.join(work,'app');
const outputZip=path.join(work,'seo-bundle.zip');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const protectedFiles=['data/products.json'];
try{
 fs.mkdirSync(extracted);
 fs.writeFileSync(bundle,Buffer.from(fs.readFileSync(source,'utf8').trim(),'base64'));
 execFileSync('unzip',['-q',bundle,'-d',extracted]);
 const before=Object.fromEntries(protectedFiles.map(p=>[p,hash(path.join(extracted,p))]));
 execFileSync(process.execPath,[path.join(repo,'deploy','hotfix.mjs')],{cwd:extracted,stdio:'inherit'});
 execFileSync(process.execPath,['--check',path.join(extracted,'server.js')],{stdio:'inherit'});
 for(const p of protectedFiles){
  if(hash(path.join(extracted,p))!==before[p])throw new Error('Protected data was modified: '+p);
 }
 const app=fs.readFileSync(path.join(extracted,'server.js'),'utf8');
 const index=fs.readFileSync(path.join(extracted,'public','index.html'),'utf8');
 if(!app.includes('SEO_HOME_20261112')||!app.includes('SEO_SITEMAP_20261112'))
  throw new Error('SEO routes missing after patch');
 if(!index.includes('AMo-BjLLFaVKgAVXzEhdLAdXKRxvqSPcepXkkwLssW0'))
  throw new Error('Google verification tag missing');
 // Normalize times for reproducible ZIP output.
 execFileSync('find',['.','-exec','touch','-t','202001010000','{}','+'],{cwd:extracted});
 execFileSync('zip',['-q','-X','-r',outputZip,'.'],{cwd:extracted});
 execFileSync('unzip',['-tq',outputZip],{stdio:'pipe'});
 const bytes=fs.readFileSync(outputZip),newEncoded=bytes.toString('base64');
 fs.writeFileSync(source,newEncoded+'\n');
 console.log('[SEO bundle] Ready:',bytes.length,'bytes, original customer/order files untouched');
} finally {
 fs.rmSync(work,{recursive:true,force:true});
}
