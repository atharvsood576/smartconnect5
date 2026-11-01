import QRCode from 'qrcode';
import {db, result, rpc, currentUser} from './cloud.js';
import {safeWebsite, normalizeCard, encodeSnapshot, decodeSnapshot, cardSlug, validSlug, contactFile, helpAnswer} from './card-utils.js';

const $=id=>document.getElementById(id);
const query=new URLSearchParams(location.search);
let user=null, editing=null, scanner=null, scannerLoading=null, stopping=false, accountLoadError=null;
const note=(id,text,error=false)=>{const el=$(id);if(el){el.textContent=text;el.className='status '+(error?'error':'ok');}};
const fields={name:'cardname',role:'cardrole',company:'cardcompany',email:'cardemail',website:'cardwebsite',bio:'cardbio'};
const saveDownload=(data,type,filename)=>{const blob=new Blob([data],{type});const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);};
const goAuth=mode=>location.assign(`${mode==='signup'?'/signup.html?mode=signup':'/login?mode=login'}&next=${encodeURIComponent(query.has('profile')||query.has('card')?'/account':location.pathname+location.search+'#create')}`);
$('signup').onclick=()=>goAuth('signup');$('signin').onclick=()=>goAuth('login');
document.querySelectorAll('[data-auth]').forEach(button=>button.onclick=()=>goAuth(button.dataset.auth));
$('logout').onclick=async()=>{try{await result(db.auth.signOut());location.assign('/');}catch(error){note('cardstatus',error.message,true);}};
document.querySelector('#scx-offers-entry button')?.addEventListener('click',()=>document.querySelector('#scx-offers-entry').remove());

function fillCard(card){for(const [key,id] of Object.entries(fields)) if($(id)) $(id).value=card[key]||'';}
try{const draft=JSON.parse(localStorage.getItem('scx-last-card')||'null');if(draft)fillCard(draft);}catch{}

async function shareCard(card,link,isPublic=true){
  const panel=$('cardresult');panel.replaceChildren();
  if(!isPublic){const text=document.createElement('p');text.textContent='Private draft saved. Publish it when you are ready to share.';panel.append(text);return;}
  const canvas=document.createElement('canvas');canvas.className='qrwrap';canvas.setAttribute('aria-label','QR code for your public card');panel.append(canvas);
  await QRCode.toCanvas(canvas,link,{width:220,margin:3,errorCorrectionLevel:'M',color:{dark:'#101a0c',light:'#ffffff'}});
  const text=document.createElement('p');text.className='mini muted share-url';text.textContent=link;panel.append(text);
  const buttons=document.createElement('div');buttons.className='row';panel.append(buttons);
  const copy=document.createElement('button');copy.className='btn';copy.textContent='Copy profile link';copy.onclick=async()=>{try{await navigator.clipboard.writeText(link);copy.textContent='Copied!';}catch{copy.textContent='Select the address above to copy';}};buttons.append(copy);
  const open=document.createElement('a');open.href=link;open.className='btn outline';open.target='_blank';open.rel='noopener noreferrer';open.textContent='View public card';buttons.append(open);
  const qr=document.createElement('button');qr.className='btn ghost small';qr.textContent='Download QR';qr.onclick=()=>{const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='smartconnectx-qr.png';a.click();};buttons.append(qr);
  const contact=document.createElement('button');contact.className='btn ghost small';contact.textContent='Download contact';contact.onclick=()=>saveDownload(contactFile(card),'text/vcard;charset=utf-8','smartconnectx-contact.vcf');buttons.append(contact);
}

async function initializeAccount(){
  try{
    user=await currentUser();
    if(user){
      $('signin').classList.add('hide');$('signup').classList.add('hide');$('logout').classList.remove('hide');$('accountlink').classList.remove('hide');
      $('userbadge').textContent=user.email||'Signed in';$('userbadge').classList.remove('hide');
      $('account-card-options')?.classList.remove('hide');
      if($('savecard'))$('savecard').textContent='Save & generate link →';
      if($('snapshot-note'))$('snapshot-note').textContent='Your saved profile keeps its address when you update it. You can make it private from the editor.';
      if($('cardslug'))$('cardslug').value=cardSlug($('cardname').value,crypto.randomUUID().slice(0,6));
    }
    const editId=query.get('id')||query.get('edit');
    if(location.pathname==='/editor'||editId){
      if(!user){goAuth('login');return;}
      if(editId){
        editing=await result(db.from('scx_profiles').select('*').eq('id',editId).eq('owner_id',user.id).single());
        fillCard(normalizeCard(editing.profile));$('cardslug').value=editing.slug;$('cardslug').disabled=true;$('cardpublic').checked=editing.is_public;
        await shareCard(editing.profile,`${location.origin}/?profile=${encodeURIComponent(editing.slug)}`,editing.is_public);
      }else if(query.get('new')==='1'){ $('cardform').reset();$('cardslug').value=cardSlug('profile',crypto.randomUUID().slice(0,6)); }
      $('create')?.scrollIntoView();
    }
  }catch(error){accountLoadError=error;note('cardstatus',error.message||'Could not load your account. Please retry.',true);}
}
const accountReady=initializeAccount();
$('cardname').addEventListener('change',()=>{if(user&&!editing)$('cardslug').value=cardSlug($('cardname').value,crypto.randomUUID().slice(0,6));});
$('cardform').addEventListener('submit',async event=>{
  event.preventDefault();const button=$('savecard');if(button.disabled)return;button.disabled=true;note('cardstatus','Preparing your card…');
  try{
    await accountReady;
    if(accountLoadError)throw new Error('Your account could not be loaded. Refresh this page before saving.');
    const card=normalizeCard(Object.fromEntries(Object.entries(fields).map(([key,id])=>[key,$(id).value])));
    if(!card.role)throw new Error('Add your role or profession.');
    let link,isPublic=true;
    if(user){
      const slug=editing?.slug||$('cardslug').value.trim().toLowerCase();
      if(!validSlug(slug))throw new Error('Use 3–40 lowercase letters, numbers or hyphens for the card address.');
      isPublic=$('cardpublic').checked;
      editing=await rpc('scx_save_profile',{p_id:editing?.id||null,p_slug:slug,p_profile:card,p_public:isPublic});
      $('cardslug').value=editing.slug;$('cardslug').disabled=true;
      link=`${location.origin}/?profile=${encodeURIComponent(editing.slug)}`;
      note('cardstatus',isPublic?'Saved to your account. This link stays the same when you edit your card.':'Private draft saved.');
    }else{
      link=`${location.origin}/?card=${encodeSnapshot(card)}`;
      note('cardstatus','Snapshot created. Sign in to save a permanent, editable card.');
      try{localStorage.setItem('scx-last-card',JSON.stringify(card));}catch{}
    }
    await shareCard(card,link,isPublic);
  }catch(error){note('cardstatus',error.message||'Could not save this card. Please try again.',true);}
  finally{button.disabled=false;}
});

async function renderPublicProfile(){
  const profileSlug=query.get('profile');const legacy=query.get('card');if(!profileSlug&&!legacy)return;
  document.querySelector('#scx-offers-entry')?.remove();
  document.querySelector('#smartconnect-ad')?.remove();
  const root=$('site');root.replaceChildren();
  const article=document.createElement('article');article.className='public-card';article.setAttribute('aria-live','polite');root.append(article);article.textContent='Opening your SmartConnect X card…';
  try{
    let card;
    if(profileSlug||(legacy&&validSlug(legacy))){
      const slug=profileSlug||legacy;if(!validSlug(slug))throw new Error('This card address is invalid.');
      const row=await result(db.from('scx_profiles').select('profile').eq('slug',slug).eq('is_public',true).maybeSingle());
      if(!row)throw new Error('This card is private or no longer available.');
      card=normalizeCard(row.profile);
    }else card=decodeSnapshot(legacy);
    article.replaceChildren();
    const badge=document.createElement('span');badge.className='eyebrow';badge.textContent='SmartConnect X · digital card';article.append(badge);
    const title=document.createElement('h1');title.textContent=card.name;article.append(title);document.title=card.name+' | SmartConnect X';
    [card.role,card.company,card.bio].filter(Boolean).forEach(value=>{const p=document.createElement('p');p.textContent=value;article.append(p);});
    if(card.email&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(card.email)){const a=document.createElement('a');a.textContent=card.email;a.href='mailto:'+encodeURIComponent(card.email);a.className='public-contact';article.append(a);}
    if(card.phone){const a=document.createElement('a');a.textContent=card.phone;a.href='tel:'+card.phone.replace(/[^+0-9]/g,'');a.className='public-contact';article.append(a);}
    if(card.website){const a=document.createElement('a');a.textContent=card.website;a.href=safeWebsite(card.website);a.target='_blank';a.rel='noopener noreferrer';a.className='public-contact';article.append(a);}
    const button=document.createElement('button');button.className='btn';button.textContent='Save contact';button.onclick=()=>saveDownload(contactFile(card),'text/vcard;charset=utf-8','smartconnectx-contact.vcf');article.append(button);
    const qr=document.createElement('canvas');qr.className='qrwrap public-qr';qr.setAttribute('aria-label','Share this card by QR code');article.append(qr);
    await QRCode.toCanvas(qr,location.origin+location.pathname+location.search,{width:190,margin:3});
  }catch(error){article.textContent=error.message||'This profile could not be loaded. Please try again.';}
  const back=document.createElement('a');back.href='/';back.textContent='← Create your own SmartConnect X card';back.className='public-back';article.append(back);
}

function loadScanner(){
  if(window.Html5Qrcode)return Promise.resolve();
  if(!scannerLoading)scannerLoading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/html5-qrcode.min.js';script.onload=()=>window.Html5Qrcode?resolve():reject(new Error('Scanner could not load.'));script.onerror=()=>{scannerLoading=null;script.remove();reject(new Error('Scanner could not load. Check your connection and retry.'));};document.head.append(script);});
  return scannerLoading;
}
async function stopScanner(){
  const current=scanner;scanner=null;
  if(current){try{await current.stop();}catch{}try{current.clear();}catch{}}
  if($('scanstart'))$('scanstart').disabled=false;if($('scanstop'))$('scanstop').disabled=true;stopping=false;
}
$('scanstart').onclick=async()=>{
  if(scanner)return;$('scanstart').disabled=true;note('scanresult','Starting camera…');
  try{
    await loadScanner();$('qr-reader').replaceChildren();scanner=new window.Html5Qrcode('qr-reader');$('scanstop').disabled=false;
    await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:210,height:210}},async text=>{
      if(stopping)return;stopping=true;note('scanresult','Scanned: '+text);
      const link=safeWebsite(text);if(link){const a=document.createElement('a');a.href=link;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open scanned link →';a.className='public-contact';$('scanresult').append(a);}
      await stopScanner();
    },()=>{});
  }catch(error){note('scanresult',error?.name==='NotAllowedError'?'Camera permission was not granted. You can paste a profile link instead.':error.message||'Camera unavailable. Use HTTPS and allow camera access, or paste a profile link.',true);await stopScanner();}
};
$('scanstop').onclick=()=>stopScanner();
$('openlinkbtn').onclick=()=>{const link=safeWebsite($('openlink').value);if(!link){note('scanresult','Paste a valid http or https link.',true);return;}window.open(link,'_blank','noopener,noreferrer');};
window.addEventListener('pagehide',()=>stopScanner());document.addEventListener('visibilitychange',()=>{if(document.hidden)stopScanner();});
$('aiform').addEventListener('submit',event=>{event.preventDefault();note('aianswer',helpAnswer($('aiquestion').value));});
const guide=document.createElement('a');guide.className='guide-launch';guide.href='/#guide';guide.textContent='Need help?';document.body.append(guide);
const guideSection=$('aiform').closest('section');guideSection.id='guide';
if(location.pathname==='/scan.html')$('scan')?.scrollIntoView();
const authError=new URLSearchParams(location.hash.slice(1)).get('error_description');
if(authError){note('cardstatus',authError.slice(0,250),true);history.replaceState(null,'',location.pathname+location.search);}
const profileReady=renderPublicProfile();
