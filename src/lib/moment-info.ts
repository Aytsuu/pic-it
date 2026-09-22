import { supabase } from '@/lib/supabase';

export type MomentMember = {
  user_id: string;
  email: string;
  display_name: string;
};

export type MomentDetails = {
  id: string;
  name: string;
  code: string;
  host_id: string;
  members: MomentMember[];
};

function normalizeMembers(members: unknown): MomentMember[] {
  if (!Array.isArray(members)) return [];
  return members as MomentMember[];
}

export async function fetchMomentDetails(momentId: string): Promise<MomentDetails> {
  const { data, error } = await supabase.rpc('get_moment_details', {
    p_moment_id: momentId,
  });

  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error('Moment not found');

  const details = data as MomentDetails;
  return {
    ...details,
    members: normalizeMembers(details.members),
  };
}
