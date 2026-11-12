import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {Pool} from 'pg';

export class Store {
  constructor(root){
    this.root=root;
    this.file=process.env.DATA_FILE||path.join(root,'data','state.json');
    this.pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:false}:undefined,max:5}):null;
    this.state={products:{},media:{},rates:null,imports:[],settings:{globalPriceFactor:1,priceHistory:[],featuredRotation:true},reviews:[],orders:[]};
    this.writeChain=Promise.resolve();
  }
  get persistent(){return !!this.pool || !!process.env.DATA_FILE}
  get mode(){return this.pool?'postgres':process.env.DATA_FILE?'file':'ephemeral-file'}
  async init(seeds){
    if(this.pool){
      await this.pool.query(`CREATE TABLE IF NOT EXISTS autopiese_state (key TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now())`);
      const rows=await this.pool.query('SELECT key,data FROM autopiese_state');
      for(const row of rows.rows)if(Object.hasOwn(this.state,row.key))this.state[row.key]=row.data;
    } else {
      try{const read=JSON.parse(await fs.readFile(this.file,'utf8'));if(read&&typeof read==='object')this.state={...this.state,...read}}catch(e){if(e.code!=='ENOENT')throw e}
    }
    this.state.settings={globalPriceFactor:1,priceHistory:[],featuredRotation:true,...this.state.settings};
    this.state.reviews=Array.isArray(this.state.reviews)?this.state.reviews:[];
    this.state.orders=Array.isArray(this.state.orders)?this.state.orders:[];
    for(const p of seeds)if(!Object.hasOwn(this.state.products,p.id))this.state.products[p.id]={...p,source:p.source||'dedauto'};
    await this.save('products');return this;
  }
  async save(key){
    if(this.pool){await this.pool.query('INSERT INTO autopiese_state (key,data) VALUES ($1,$2::jsonb) ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data,updated_at=now()',[key,JSON.stringify(this.state[key])]);return}
    const snapshot=JSON.stringify(this.state,null,2);
    this.writeChain=this.writeChain.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(this.file),{recursive:true});const tmp=this.file+'.tmp';await fs.writeFile(tmp,snapshot);await fs.rename(tmp,this.file)});
    await this.writeChain;
  }
  products(includeHidden=false){const list=Object.values(this.state.products||{});return includeHidden?list:list.filter(p=>!p.hidden&&!p.deleted)}
  find(id){return this.state.products[id]||null}
  regularPrice(p){const p0=p?.price_override_ron??p?.price_ron;if(p0==null||!Number.isFinite(Number(p0)))return null;return Math.round(Number(p0)*this.state.settings.globalPriceFactor*100)/100}
  customerPrice(p){let price=this.regularPrice(p);if(price===null)return null;const disc=this.activeDiscount(p);return Math.max(0,Math.round(price*(1-disc/100)*100)/100)}
  activeDiscount(p){const discount=Number(p?.discount_percent||0);if(!Number.isFinite(discount)||discount<=0||discount>70)return 0;if(p?.discount_ends_at&&Date.parse(p.discount_ends_at)<Date.now())return 0;return discount}
  async upsertManual(product){this.state.products[product.id]=product;await this.save('products');return product}
  async setVisibility(id,patch){let p=this.find(id);if(!p)return null;this.state.products[id]={...p,...patch,updatedAt:new Date().toISOString()};await this.save('products');return this.find(id)}
  async importProducts(items){let added=0,updated=0,skipped=0;for(const incoming of items){if(!incoming?.id)continue;const old=this.find(incoming.id);if(old?.deleted||old?.source==='manual'||old?.lock_supplier){skipped++;continue};if(old){this.state.products[incoming.id]={...old,...incoming,hidden:old.hidden,deleted:old.deleted,price_override_ron:old.price_override_ron,discount_percent:old.discount_percent,discount_ends_at:old.discount_ends_at};updated++}else{this.state.products[incoming.id]=incoming;added++}}await this.save('products');return {added,updated,skipped,total:this.products().length}}
  async saveOrder(order){
    this.state.orders=[order,...this.state.orders.filter(x=>x.id!==order.id)].slice(0,5000);
    await this.save('orders');return order;
  }
  findOrder(id){return this.state.orders.find(x=>x.id===id)||null;}
  async updateOrder(id,patch){const o=this.findOrder(id);if(!o)return null;Object.assign(o,patch,{updatedAt:new Date().toISOString()});await this.save('orders');return o;}
  async upsertMedia(id,content){this.state.media ||= {};this.state.media[id]=content;await this.save('media');return id}
  async rates(value){this.state.rates=value;await this.save('rates')}
  async logImport(info){this.state.imports=[{...info,at:new Date().toISOString()},...(this.state.imports||[])].slice(0,30);await this.save('imports')}
  async bulkAdjust(percent){const prev=Number(this.state.settings.globalPriceFactor)||1;const next=Math.round(prev*(1+percent/100)*1e8)/1e8;if(!Number.isFinite(next)||next<0.01||next>100)throw Error('FACTOR_OUT_OF_RANGE');const entry={id:crypto.randomUUID(),percent,previousFactor:prev,nextFactor:next,at:new Date().toISOString(),affected:this.products().filter(p=>this.regularPrice(p)!=null).length};this.state.settings.globalPriceFactor=next;this.state.settings.priceHistory=[entry,...(this.state.settings.priceHistory||[])].slice(0,100);await this.save('settings');return entry}
  async undoLastPriceChange(){const history=this.state.settings.priceHistory||[];const last=history[0];if(!last)throw Error('NOTHING_TO_UNDO');if(Math.abs(Number(this.state.settings.globalPriceFactor)-last.nextFactor)>1e-7)throw Error('PRICE_CHANGED_SINCE');this.state.settings.globalPriceFactor=last.previousFactor;this.state.settings.priceHistory=history.slice(1);await this.save('settings');return last}
  async upsertReview(row){this.state.reviews=[row,...this.state.reviews.filter(x=>x.id!==row.id)];await this.save('reviews');return row}
  async deleteReview(id){this.state.reviews=this.state.reviews.filter(x=>x.id!==id);await this.save('reviews')}
}
