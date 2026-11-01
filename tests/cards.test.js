import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import * as cards from '../card-utils.js';

const sample={name:'आशा Mehta 🌿',role:'Designer',company:'A & B',email:'asha@example.com',website:'https://example.com',bio:'Design for everyone.'};
test('jury-day QR payloads and Unicode still open after the rebuild',()=>{
  const oldPayload=Buffer.from(JSON.stringify(sample),'utf8').toString('base64url');
  assert.equal(cards.decodeSnapshot(oldPayload).name,sample.name);
  assert.deepEqual(cards.decodeSnapshot(cards.encodeSnapshot(sample)),cards.normalizeCard(sample));
  for(const bad of ['javascript:alert(1)','%bad','a'.repeat(6001)])assert.throws(()=>cards.decodeSnapshot(bad));
});
test('public links and contact downloads reject executable URLs and vCard field injection',()=>{
  for(const bad of ['javascript:alert(1)','data:text/html,test','file:///etc/passwd','https://user:password@example.com']) {
    assert.equal(cards.safeWebsite(bad),null);
    assert.throws(()=>cards.normalizeCard({...sample,website:bad}));
  }
  const vcf=cards.contactFile({...sample,name:'Name\r\nURL:https://evil.invalid',bio:'Hello; there, friend'});
  assert.ok(!vcf.includes('\r\nURL:https://evil.invalid'));
  assert.ok(vcf.includes('FN:Name\\nURL:https://evil.invalid'));
  assert.ok(vcf.includes('NOTE:Hello\\; there\\, friend'));
  assert.ok(vcf.endsWith('END:VCARD\r\n'));
});

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const source=(await readFile(new URL('../main.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const names=['window','document','location','history','navigator','localStorage','crypto','QRCode','db','result','rpc','currentUser',...Object.keys(cards)];
const factory=new AsyncFunction(...names,source+'\nawait accountReady; await profileReady;');
async function render(path='/',{signedIn=false,profiles=[],authError=null}={}){
  const window=new Window({url:'https://test.invalid'+path});
  window.document.write(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));
  window.HTMLElement.prototype.scrollIntoView=function(){};
  const calls=[],qrs=[],queries=[];
  const db={from(table){const filters=[];const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},single(){q.required=true;return q;},maybeSingle(){return q;},then(resolve,reject){queries.push({table,filters});const data=profiles.find(row=>filters.every(([k,v])=>row[k]===v))||null;return Promise.resolve({data,error:!data&&q.required?new Error('Card unavailable'):null}).then(resolve,reject);}};return q;},auth:{signOut:async()=>({data:{},error:null})}};
  const result=async promise=>{const response=await promise;if(response.error)throw response.error;return response.data;};
  const rpc=async(name,args)=>{calls.push({name,args});return {id:args.p_id||'saved-card-id',owner_id:'customer',slug:args.p_slug,profile:args.p_profile,is_public:args.p_public};};
  const user=async()=>{if(authError)throw authError;return signedIn?{id:'customer',email:'customer@example.invalid'}:null;};
  await factory(window,window.document,window.location,window.history,window.navigator,window.localStorage,crypto,{toCanvas:async(_,payload)=>qrs.push(payload)},db,result,rpc,user,...Object.values(cards));
  return {window,document:window.document,calls,qrs,queries,close:()=>window.happyDOM.close()};
}
async function settle(){await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));}
async function save(page,{name='Asha',role='Designer',published=true}={}){
  page.document.getElementById('cardname').value=name;page.document.getElementById('cardrole').value=role;
  page.document.getElementById('cardpublic').checked=published;
  page.document.getElementById('cardform').dispatchEvent(new page.window.Event('submit',{bubbles:true,cancelable:true}));await settle();
}
test('guest builder generates a portable legacy link without storing a cloud profile',async()=>{
  const p=await render();await save(p);
  const link=new URL(p.qrs[0]);assert.ok(link.searchParams.has('card'));
  assert.equal(cards.decodeSnapshot(link.searchParams.get('card')).name,'Asha');
  assert.equal(p.calls.length,0);assert.match(p.document.getElementById('cardstatus').textContent,/Snapshot created/);
  await p.close();
});
test('account card keeps its saved URL across edits and can become private',async()=>{
  const p=await render('/editor?new=1',{signedIn:true});await save(p);
  const first=new URL(p.qrs[0]);assert.ok(first.searchParams.get('profile'));
  await save(p,{name:'Asha Updated'});assert.equal(p.qrs[1],p.qrs[0]);
  assert.equal(p.calls[1].args.p_id,'saved-card-id');
  await save(p,{published:false});assert.equal(p.calls[2].args.p_public,false);
  assert.match(p.document.getElementById('cardresult').textContent,/Private draft saved/);
  assert.equal(p.document.querySelector('#cardresult canvas'),null);
  await p.close();
});
test('an unreadable account or another customer’s card cannot fall back to a new save',async()=>{
  for(const options of [{signedIn:true,authError:new Error('Offline')},{signedIn:true,profiles:[{id:'someone-else',owner_id:'other',slug:'private-card',profile:sample,is_public:false}]}]){
    const p=await render('/editor?id=someone-else',options);await save(p);
    assert.equal(p.calls.length,0);assert.match(p.document.getElementById('cardstatus').textContent,/could not be loaded/);
    await p.close();
  }
});
test('legacy public profiles render text safely and hide the promotional video',async()=>{
  const p=await render('/?card='+cards.encodeSnapshot({...sample,bio:'<img src=x onerror=alert(1)>'}));
  assert.equal(p.document.querySelector('.public-card h1').textContent,sample.name);
  assert.equal(p.document.querySelector('.public-card img'),null);
  assert.match(p.document.querySelector('.public-card').textContent,/<img src=x/);
  assert.equal(p.document.getElementById('smartconnect-ad'),null);
  await p.close();
});
test('public URLs query only published profiles and do not reveal private card details',async()=>{
  const p=await render('/?profile=private-card',{signedIn:true,profiles:[{id:'mine',owner_id:'customer',slug:'private-card',profile:sample,is_public:false}]});
  assert.match(p.document.querySelector('.public-card').textContent,/private or no longer available/);
  assert.ok(p.queries[0].filters.some(([k,v])=>k==='is_public'&&v===true));
  assert.doesNotMatch(p.document.querySelector('.public-card').textContent,/Designer/);await p.close();
});
test('scanner waits for a click and releases the camera when stopped',async()=>{
  const p=await render();let starts=0,stops=0;
  p.window.Html5Qrcode=class {async start(){starts++}async stop(){stops++}clear(){}};
  assert.equal(starts,0);p.document.getElementById('scanstart').click();await settle();assert.equal(starts,1);
  p.document.getElementById('scanstop').click();await settle();assert.equal(stops,1);
  await p.close();
});
