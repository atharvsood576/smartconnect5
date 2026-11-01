import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabasePublishableKey } from './cloud-config.js';

export const db = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
});
export async function result(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}
export const rpc = (name, args = {}) => result(db.rpc(name, args));
export async function currentUser() {
  const { data: { session }, error: sessionError } = await db.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) return null;
  const { data, error } = await db.auth.getUser();
  if (error) throw error;
  return data.user;
}
