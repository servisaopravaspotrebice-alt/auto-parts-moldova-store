import test from 'node:test';
import assert from 'node:assert/strict';
import {localizeName,productLanguages,productSummary} from '../lib/product-locale.js';
const p={name:'Caseta de directie VW Golf 7 (produs reconditionat de uzina, piesa la schimb)',sku:'5Q1423055D',condition:'refurbished',category:'steering'};
test('all four languages translate catalog part title and preserve model and OEM',()=>{
 const tr=productLanguages(p);
 assert.match(tr.ro,/Caseta de directie/);
 assert.match(tr.ru,/Рулевая рейка/);
 assert.match(tr.uk,/Рульова рейка/);
 assert.match(tr.en,/Steering rack/);
 for(const name of Object.values(tr))assert.match(name,/VW Golf 7/);
 for(const lang of ['ro','ru','uk','en'])assert.match(productSummary(p,lang),/5Q1423055D/);
});
test('accented Romanian names translate instead of leaving mixed text',()=>{
 assert.match(localizeName('Curea servodirecție electrică TOYOTA RAV4','ru'),/^Ремень электроусилителя/);
 assert.match(localizeName('Compresor de aer condiționat AUDI A4','en'),/^A\/C compressor/);
});
test('human-verified override takes precedence',()=>{
 assert.equal(localizeName('Caseta de directie VW', 'ru', {ru:'Рейка рулевая для VW'}),'Рейка рулевая для VW');
});
