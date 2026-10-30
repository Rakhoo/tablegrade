/** Longest edge of photos chosen by hand; they are stored as base64 in the database. */
const MAX_IMAGE_SIZE = 256;

/** Scales an image file down and converts it to a JPEG data URL. */
export async function imageFileToDataUrl(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_IMAGE_SIZE / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
