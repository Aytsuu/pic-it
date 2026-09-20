import { saveMoments } from '@/lib/offline-cache';
import { supabase } from '@/lib/supabase';

export type JoinMomentResult =
  | { ok: true; momentId: string }
  | { ok: false; error: string };

export async function joinMoment(userId: string, code: string): Promise<JoinMomentResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return { ok: false, error: 'Enter a moment code' };
  }

  const { data: moment, error: lookupErr } = await supabase
    .from('moments')
    .select('id, name, created_at')
    .eq('code', normalized)
    .single();

  if (lookupErr || !moment) {
    return { ok: false, error: 'Moment not found' };
  }

  const { error: memberErr } = await supabase
    .from('members')
    .upsert({ moment_id: moment.id, user_id: userId });

  if (memberErr) {
    return { ok: false, error: memberErr.message };
  }

  saveMoments(userId, [
    {
      id: moment.id,
      name: moment.name,
      created_at: moment.created_at,
    },
  ]);

  return { ok: true, momentId: moment.id };
}
