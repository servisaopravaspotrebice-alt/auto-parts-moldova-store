import test from 'node:test';import assert from 'node:assert/strict';import {retailRon,parseRon,fromSupplier,categoryOf} from '../lib/catalog.js';
test('20% applied exactly once to supplier RON',()=>{const p=fromSupplier({url:'https://www.dedauto.ro/produse/test.html',name:'Test',supplier_price_ron:1540});assert.equal(p.price_ron,1848);assert.equal(retailRon(1540),1848)});
test('Romanian prices parse correctly',()=>{assert.equal(parseRon('1.540,00 Lei'),1540);assert.equal(parseRon('4.550,00'),4550)});

test('Refurbished steering racks never classified as A/C compressors',()=>{assert.equal(categoryOf('Caseta de directie Mercedes C205 (produs reconditionat)'),'steering');assert.equal(categoryOf('Compresor aer conditionat Audi A4'),'ac')});
