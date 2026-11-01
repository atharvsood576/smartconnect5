import {safeNext} from './commerce.js';
import {supabaseUrl} from './cloud-config.js';

const nextKey='scx.auth.next';
export function authDestination(value){
  const next=safeNext(value);
  return ['/auth/callback','/login','/signup.html'].includes(next.split(/[?#]/)[0])?'/account':next;
}
export async function startGoogle(client,origin,next,storage){
  const destination=authDestination(next);
  try{storage.setItem(nextKey,destination);}catch{throw new Error('Allow site storage in your browser to sign in with Google.');}
  try{
    const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:new URL('/auth/callback',origin).href,queryParams:{prompt:'select_account'},skipBrowserRedirect:true}});
    if(error)throw error;
    const target=new URL(data?.url);
    if(target.origin!==new URL(supabaseUrl).origin||target.pathname!=='/auth/v1/authorize')throw new Error('Google sign-in could not start. Please try again.');
    return target.href;
  }catch(error){try{storage.removeItem(nextKey);}catch{}throw error;}
}
export function consumeAuthDestination(storage){
  try{const next=authDestination(storage.getItem(nextKey));storage.removeItem(nextKey);return next;}catch{return '/account';}
}
export function googleErrorMessage(value){
  const text=String(value?.message||value||'');
  if(/access_denied|cancel|denied/i.test(text))return 'Google sign-in was cancelled. Try again or sign in with email.';
  if(/provider.*not enabled|unsupported provider/i.test(text))return 'Google sign-in is unavailable right now. Please sign in with email.';
  if(/code.*verifier|expired|invalid.*code/i.test(text))return 'This sign-in link expired or was opened in a different browser. Start Google sign-in again here.';
  return 'Google sign-in could not finish. Please try again or use email and password.';
}
export const googleButtonContent='<svg viewBox="0 0 48 48" aria-hidden="true" width="20" height="20"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.04 46.98 31.87 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.7 23.7 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg><span>Continue with Google</span>';
