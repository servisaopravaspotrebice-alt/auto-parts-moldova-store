/* VIN / OEM OCR primitives. Pure helpers (also loadable in Node tests). */
(function(root){
  'use strict';
  const vinPattern=/[A-HJ-NPR-Z0-9]{17}/g;
  function normalized(text){return String(text||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
  function vinCandidates(text){
    const lines=String(text||'').toUpperCase().split(/[\r\n]+/);
    const output=[];
    function add(code){if(/^[A-HJ-NPR-Z0-9]{17}$/.test(code)&&!output.includes(code))output.push(code)}
    for(let line of lines){
      // Prefer an exact standalone VIN; never take 17 arbitrary characters from a longer string.
      for(const token of line.match(/[A-Z0-9]{17}/g)||[]){
        const location=line.indexOf(token);
        if((location===0||!/[A-Z0-9]/.test(line[location-1]))&&
           (location+17===line.length||!/[A-Z0-9]/.test(line[location+17])))add(token);
      }
      if(line.includes(':'))line=line.slice(line.lastIndexOf(':')+1);
      add(normalized(line));
    }
    return output.slice(0,8);
  }
  function flattenWords(data){
    let words=[];
    if(Array.isArray(data?.words))words=data.words;
    if(!words.length&&Array.isArray(data?.blocks))for(const b of data.blocks){
      if(Array.isArray(b.words))words.push(...b.words);
      for(const p of b.paragraphs||[]){
        if(Array.isArray(p.words))words.push(...p.words);
        for(const l of p.lines||[])words.push(...(l.words||[]));
      }
    }
    const output=[];
    for(const w of words){
      const text=String(w.text||'').trim();
      const box=w.bbox||w.box||{};
      let x0=Number(box.x0??box.left),y0=Number(box.y0??box.top);
      let x1=Number(box.x1??(box.left+box.width)),y1=Number(box.y1??(box.top+box.height));
      if(!text||![x0,y0,x1,y1].every(Number.isFinite)||x1<=x0||y1<=y0)continue;
      output.push({text,bbox:{x0,y0,x1,y1},confidence:Number(w.confidence??w.conf??0)});
    }
    output.sort((a,b)=>{const midA=(a.bbox.y0+a.bbox.y1)/2,midB=(b.bbox.y0+b.bbox.y1)/2;
      return Math.abs(midA-midB)>Math.max(8,(a.bbox.y1-a.bbox.y0)/2)?midA-midB:a.bbox.x0-b.bbox.x0});
    return output.slice(0,300);
  }
  function intersects(a,b){return a.x0<b.x1 && a.x1>b.x0 && a.y0<b.y1 && a.y1>b.y0}
  function cleanForField(text){return String(text||'').toUpperCase().replace(/\s+/g,'').replace(/[^A-Z0-9/\-]/g,'').slice(0,30)}
  const api={normalized,vinCandidates,flattenWords,intersects,cleanForField};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.VinLensCore=api;
})(typeof window!=='undefined'?window:null);
