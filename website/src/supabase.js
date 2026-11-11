import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Null when env vars are missing, so the site still works without Supabase.
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

export async function logEvent(kind) {
  if (!supabase) return;
  try { await supabase.from('download_events').insert({ kind }); } catch { /* best effort */ }
}

export async function signUp(email) {
  if (!supabase) return { ok: false, message: 'Signup is not configured.' };
  const { error } = await supabase.from('email_signups').insert({ email: email.trim() });
  if (!error) return { ok: true, message: "Thanks! You're on the list." };
  if (error.code === '23505') return { ok: true, message: "You're already on the list." };
  if (error.code === '23514') return { ok: false, message: 'Please enter a valid email.' };
  return { ok: false, message: 'Something went wrong. Please try again.' };
}

export async function getDownloadCount() {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_download_count');
  return error ? null : data;
}
