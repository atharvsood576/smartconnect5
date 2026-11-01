import {db,result} from './cloud.js';
import {safeNext} from './commerce.js';
import {startGoogle,googleErrorMessage,googleButtonContent} from './auth-flow.js';
const $=id=>document.getElementById(id),query=new URLSearchParams(location.search);
const next=safeNext(query.get('next')||'/account');
let mode=query.get('mode')==='login'?'login':'signup';
const notify=(message,bad=false)=>{$('notice').textContent=message;$('notice').className='notice '+(bad?'bad':'good');};
function render(){
  $('signup-tab').setAttribute('aria-selected',String(mode==='signup'));$('login-tab').setAttribute('aria-selected',String(mode==='login'));
  $('name-field').hidden=mode==='login';$('heading').textContent=mode==='signup'?'Create your free account':'Welcome back';
  $('subheading').textContent=mode==='signup'?'Make a digital identity you can share.':'Sign in to your SmartConnect X account.';
  $('submit').textContent=mode==='signup'?'Create account':'Log In';$('password').autocomplete=mode==='signup'?'new-password':'current-password';
  $('password').minLength=mode==='signup'?8:1;$('password').placeholder=mode==='signup'?'At least 8 characters':'Your password';
  document.title=(mode==='signup'?'Sign up':'Log in')+' | SmartConnect X';
  $('help').textContent=mode==='signup'?'Use at least 8 characters. Confirm your email when prompted before signing in.':'Your saved cards and subscription are waiting in your account.';
}
$('signup-tab').onclick=()=>{mode='signup';render();};$('login-tab').onclick=()=>{mode='login';render();};render();
$('google-login').innerHTML=googleButtonContent;
$('google-login').onclick=async()=>{
  const button=$('google-login');if(button.disabled)return;button.disabled=true;notify('Opening Google sign-in…');
  try{location.assign(await startGoogle(db,location.origin,next,sessionStorage));}
  catch(error){notify(googleErrorMessage(error),true);button.disabled=false;}
};
$('form').addEventListener('submit',async event=>{
  event.preventDefault();if($('submit').disabled)return;$('submit').disabled=true;notify('Signing in securely…');
  const email=$('email').value.trim(),password=$('password').value;
  try{
    if(mode==='signup'){
      const data=await result(db.auth.signUp({email,password,options:{data:{full_name:$('name').value.trim()},emailRedirectTo:location.origin+'/account'}}));
      if(data.session)location.assign(next);else notify('Check your email to confirm your account, then sign in. If you already have an account, use Log In.');
    }else{await result(db.auth.signInWithPassword({email,password}));location.assign(next);}
  }catch(error){notify(error.message||'Sign-in is unavailable. Please try again.',true);}
  finally{$('password').value='';$('submit').disabled=false;}
});
