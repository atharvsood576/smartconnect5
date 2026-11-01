import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {startGoogle,consumeAuthDestination,authDestination,googleErrorMessage} from '../auth-flow.js';
import {supabaseUrl,supabasePublishableKey} from '../cloud-config.js';

const storage=()=>{const values=new Map();return {setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)||null,removeItem:k=>values.delete(k)};};
test('Google sign-in uses PKCE and preserves the selected plan on this browser',async()=>{
  const state=storage();
  const client=createClient(supabaseUrl,supabasePublishableKey,{auth:{flowType:'pkce',autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
  const url=new URL(await startGoogle(client,'https://smartconnectx.vercel.app','/checkout?plan=pro-yearly',state));
  assert.equal(url.origin,supabaseUrl);assert.equal(url.searchParams.get('provider'),'google');
  assert.equal(url.searchParams.get('redirect_to'),'https://smartconnectx.vercel.app/auth/callback');
  assert.equal(url.searchParams.get('code_challenge_method'),'s256');
  assert.ok(url.searchParams.get('code_challenge').length>=43);
  assert.equal(url.searchParams.get('prompt'),'select_account');
  assert.equal(consumeAuthDestination(state),'/checkout?plan=pro-yearly');
  assert.equal(consumeAuthDestination(state),'/account');
});
test('OAuth cannot redirect to another site, loop to login, or navigate an unexpected provider URL',async()=>{
  for(const path of ['https://evil.invalid','//evil.invalid','/\\evil.invalid','/auth/callback','/login?next=/login'])assert.equal(authDestination(path),'/account');
  assert.equal(authDestination('/editor?id=abc#create'),'/editor?id=abc#create');
  const state=storage();
  await assert.rejects(()=>startGoogle({auth:{signInWithOAuth:async()=>({data:{url:'https://evil.invalid/auth/v1/authorize'}})}},'https://smartconnectx.vercel.app','/account',state));
  assert.equal(state.getItem('scx.auth.next'),null);
});
test('failed and cancelled Google sign-in clears pending navigation and gives useful recovery',async()=>{
  const state=storage();
  await assert.rejects(()=>startGoogle({auth:{signInWithOAuth:async()=>({error:new Error('Provider failure')})}},'https://smartconnectx.vercel.app','/checkout',state));
  assert.equal(state.getItem('scx.auth.next'),null);
  assert.match(googleErrorMessage('access_denied'),/cancelled/);
  assert.match(googleErrorMessage('invalid code verifier'),/different browser/);
});
