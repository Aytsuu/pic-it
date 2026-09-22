const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm']);

export function getFileExtension(localUri: string): string {
  const withoutQuery = localUri.split('?')[0] ?? localUri;
  return withoutQuery.split('.').pop()?.toLowerCase() ?? 'jpg';
}

export function isVideoUri(localUri: string): boolean {
  return VIDEO_EXTENSIONS.has(getFileExtension(localUri));
}

export function getMimeType(localUri: string): string {
  const ext = getFileExtension(localUri);
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    m4v: 'video/x-m4v',
    webm: 'video/webm',
  };
  return map[ext] ?? 'application/octet-stream';
}
