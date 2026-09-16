export async function canShareToInstagram(): Promise<boolean> {
  return false;
}

export async function shareToInstagramStories(_localUri: string): Promise<void> {
  throw new Error('Not supported on web');
}
