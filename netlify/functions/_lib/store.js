// Хранилище на Supabase (вместо Netlify Blobs)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_KEY is missing');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
  auth: { persistSession: false, autoRefreshToken: false }
});

export async function saveRecord(record) {
  const { error } = await supabase
    .from('crosswords')
    .upsert({
      id: record.id,
      data: record,
      created_at: new Date(record.createdAt || Date.now()).toISOString(),
      last_access: new Date(record.lastAccess || Date.now()).toISOString()
    });

  if (error) {
    console.error('SAVE FAILED', record.id, error);
    throw new Error('Не удалось сохранить кроссворд: ' + error.message);
  }

  console.log('SAVE OK', record.id);
}

export async function loadRecord(id) {
  if (!/^[A-Za-z0-9_-]{12,64}$/.test(String(id || ''))) return null;

  const { data, error } = await supabase
    .from('crosswords')
    .select('data')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('LOAD ERROR', id, error);
    return null;
  }

  if (!data) return null;

  // Обновляем last_access
  await supabase
    .from('crosswords')
    .update({ last_access: new Date().toISOString() })
    .eq('id', id);

  return data.data;
}

export async function deleteRecord(id) {
  await supabase.from('crosswords').delete().eq('id', id);
}

// --- Rate limit и служебные счётчики (оставлены на простой in-memory для простоты) ---
const memoryStore = new Map();

export async function checkWindowLimit(key, limit, windowMs) {
  const win = Math.floor(Date.now() / windowMs);
  const k = `${key}:${win}`;
  const cur = memoryStore.get(k) || 0;
  if (cur >= limit) return { allowed: false, remaining: 0 };
  memoryStore.set(k, cur + 1);
  return { allowed: true, remaining: limit - cur - 1 };
}

export async function checkMinInterval(key, ms) {
  const k = 'last:' + key;
  const last = memoryStore.get(k) || 0;
  const now = Date.now();
  if (now - last < ms) return false;
  memoryStore.set(k, now);
  return true;
}

export async function sessionCounter(key, limit) {
  const cur = memoryStore.get(key) || 0;
  if (limit > 0 && cur >= limit) return { allowed: false, used: cur };
  memoryStore.set(key, cur + 1);
  return { allowed: true, used: cur + 1 };
}

// Заглушки, чтобы старый код (sweep и т.д.) не падал
export function crosswordsStore() {
  return {
    async list() { return []; },
    async get() { return null; },
    async setJSON() {},
    async delete() {}
  };
}

export function metaStore() {
  return crosswordsStore();
}
