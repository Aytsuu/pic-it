import * as Linking from 'expo-linking';

export function buildMomentInviteLink(code: string): string {
  return Linking.createURL('join', {
    queryParams: { code: code.trim().toUpperCase() },
  });
}

export function buildMomentInviteMessage(momentName: string, code: string): string {
  const link = buildMomentInviteLink(code);
  return `Join "${momentName}" on Pic It!\nCode: ${code}\n${link}`;
}
