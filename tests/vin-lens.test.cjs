const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/vin-lens-core.js'),'utf8'),ctx);
const C=ctx.window.VinLensCore;
test('real VIN detected from OCR text without I, O or Q',()=>{
 const vin='WVWZZZ1KZ7W000001';
 assert.deepEqual(Array.from(C.vinCandidates('VIN:\n '+vin+'\nPart number: 7H1422061J')),[vin]);
});
test('OCR recognizes spaced VIN after combining characters',()=>{
 assert.ok(C.vinCandidates('WVW ZZZ1K Z7W 000001').includes('WVWZZZ1KZ7W000001'));
});
test('flattens OCR boxes and sorts words in reading order',()=>{
 const data={blocks:[{paragraphs:[{lines:[{words:[{text:'RIGHT',bbox:{x0:130,y0:30,x1:190,y1:46}},{text:'LEFT',bbox:{x0:5,y0:30,x1:90,y1:46}}]}]}]}]};
 const words=C.flattenWords(data);
 assert.deepEqual(Array.from(words.map(x=>x.text)),['LEFT','RIGHT']);
 assert.deepEqual({...words[0].bbox},{x0:5,y0:30,x1:90,y1:46});
});
test('select rectangles overlap correct OCR locations',()=>{
 assert.equal(C.intersects({x0:1,y0:1,x1:10,y1:10},{x0:5,y0:5,x1:14,y1:14}),true);
 assert.equal(C.intersects({x0:1,y0:1,x1:10,y1:10},{x0:11,y0:11,x1:15,y1:15}),false);
});
test('selected text can be copied into VIN / OEM input',()=>{
 assert.equal(C.cleanForField(' WVW ZZZ1K Z7W000001 '),'WVWZZZ1KZ7W000001');
 assert.equal(C.cleanForField(' 7H1 422 061 J '),'7H1422061J');
});
