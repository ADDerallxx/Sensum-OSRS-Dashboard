import path from 'node:path';import {audit,fetchJson,hash,writeSnapshot} from './lib.mjs';
const root=path.resolve(process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'.platform-data');
const base='https://prices.runescape.wiki/api/v1/osrs';
const [mapping,latest,five,hour]=await Promise.all(['mapping','latest','5m','1h'].map(x=>fetchJson(`${base}/${x}`)));
const observedAt=new Date(Math.max(Number(five.timestamp||0),Number(hour.timestamp||0))*1000).toISOString();
const prices=latest.data||{},fiveData=five.data||{},hourData=hour.data||{};
const items=mapping.map(x=>({id:Number(x.id),name:String(x.name||''),members:!!x.members,tradeable:true,stackable:null,buy_limit:Number(x.limit||0)||null,high_alch_value:Number(x.highalch||0)||null,icon:String(x.icon||''),examine:String(x.examine||''),state:'verified',source_url:`${base}/mapping`,source_revision:hash(x)}));
const observations=mapping.map(x=>{const id=String(x.id),p=prices[id]||{},f=fiveData[id]||{},h=hourData[id]||{};return {item_id:Number(x.id),observed_at:observedAt,high_price:Number(p.high||f.avgHighPrice||0)||null,low_price:Number(p.low||f.avgLowPrice||0)||null,high_volume:Number(h.highPriceVolume||0),low_volume:Number(h.lowPriceVolume||0),high_time:p.highTime?new Date(p.highTime*1000).toISOString():null,low_time:p.lowTime?new Date(p.lowTime*1000).toISOString():null,state:'verified',source_url:`${base}/latest`}});
const itemAudit=audit(items,{minimum:3000,required:['id','name'],maximumUnknownRatio:0}),priceAudit=audit(observations,{minimum:1000,required:['item_id','observed_at'],maximumUnknownRatio:0});
const itemSnapshot=await writeSnapshot(root,'items',items,{kind:'ge_price_api',urls:[`${base}/mapping`],audit:itemAudit});
const priceSnapshot=await writeSnapshot(root,'prices',observations,{kind:'ge_price_api',urls:[`${base}/latest`,`${base}/5m`,`${base}/1h`],audit:priceAudit});
console.log(JSON.stringify({items:itemSnapshot.manifest,prices:priceSnapshot.manifest,publishable:itemAudit.publishable&&priceAudit.publishable,findings:[...itemAudit.findings,...priceAudit.findings]},null,2));

