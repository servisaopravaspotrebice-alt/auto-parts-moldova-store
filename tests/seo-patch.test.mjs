import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inflateRawSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import test from 'node:test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const zip=Buffer.from(readFileSync(path.join(root,'deploy','store-v7.b64'),'utf8').trim(),'base64');
function extract(filename) {
 const marker=Buffer.from([0x50,0x4b,0x01,0x02]);
 let offset=0;
 while((offset=zip.indexOf(marker,offset))>=0){
  const n=zip.readUInt16LE(offset+28),extra=zip.readUInt16LE(offset+30),comment=zip.readUInt16LE(offset+32);
  const name=zip.subarray(offset+46,offset+46+n).toString('utf8');
  if(name===filename){
   const local=zip.readUInt32LE(offset+42),dataStart=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28);
   const compressed=zip.subarray(dataStart,dataStart+zip.readUInt32LE(offset+20));
   return zip.readUInt16LE(offset+10)===0?compressed:inflateRawSync(compressed);
  }
  offset+=46+n+extra+comment;
 }
 throw new Error('Missing ZIP file '+filename);
}
test('multilingual SEO patch generates valid, idempotent server code',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'autopiese-seo-'));
 try{
  const app=path.join(dir,'server.js');
  writeFileSync(app,extract('server.js'));
  const run=()=>execFileSync(process.execPath,[path.join(root,'deploy','seo-patch.mjs')],{cwd:dir,stdio:'pipe'});
  run();
  const output=readFileSync(app,'utf8');
  assert.match(output,/SEO_HOME_20261112/);
  assert.match(output,/SEO_SITEMAP_20261112/);
  assert.match(output,/xhtml:link/);
  assert.match(output,/robots:store\.products\(\)\.some/);
  assert.match(output,/href="\/p\/\$\{encodeURIComponent\(p\.id\)\}\?lang=\$\{lang\}"/);
  execFileSync(process.execPath,['--check',app],{stdio:'pipe'});
  run();
  assert.equal(readFileSync(app,'utf8'),output,'patch must be idempotent');
 } finally{rmSync(dir,{recursive:true,force:true});}
});
