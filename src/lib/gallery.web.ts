export async function saveImageToGallery(_localUri: string): Promise<void> {
  throw new Error('Saving to the camera roll is only supported on mobile devices');
}
