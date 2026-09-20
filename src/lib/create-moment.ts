import { saveMoments } from '@/lib/offline-cache';
import { supabase } from '@/lib/supabase';
import { generateCode } from '@/utils/generate-code';

export type CreateMomentResult =
  | { ok: true; momentId: string }
  | { ok: false; error: string };

export async function createMoment(userId: string, name: string): Promise<CreateMomentResult> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: 'Enter a moment name' };
  }

  const code = generateCode();

  const { data: moment, error: momentErr } = await supabase
    .from('moments')
    .insert({ name: trimmed, host_id: userId, code })
    .select('id')
    .single();

  if (momentErr || !moment) {
    return { ok: false, error: momentErr?.message ?? 'Failed to create moment' };
  }

  const { error: memberErr } = await supabase
    .from('members')
    .insert({ moment_id: moment.id, user_id: userId });

  if (memberErr) {
    return { ok: false, error: memberErr.message };
  }

  saveMoments(userId, [
    {
      id: moment.id,
      name: trimmed,
      created_at: new Date().toISOString(),
    },
  ]);

  return { ok: true, momentId: moment.id };
}
