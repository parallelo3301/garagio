// Phone photos are often several MB; reverse proxies commonly reject request bodies over 1 MB.
// Large images are re-encoded in the browser (EXIF orientation applied) before upload.
const MAX_EDGE = 2560
const TARGET_BYTES = 900 * 1024

export async function prepareImage(file) {
  if (file.size <= TARGET_BYTES || file.type === "image/gif" || !file.type.startsWith("image/")) return file

  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    return file
  }

  let edge = Math.min(MAX_EDGE, Math.max(bitmap.width, bitmap.height))
  let blob
  for (const quality of [0.86, 0.78, 0.7, 0.62]) {
    blob = await encode(bitmap, edge, quality)
    if (blob.size <= TARGET_BYTES) break
    if (quality === 0.7) edge = Math.round(edge * 0.8)
  }
  bitmap.close()
  if (!blob || blob.size >= file.size) return file

  const name = file.name.replace(/\.[^.]+$/, "") || "photo"
  return new File([blob], `${name}.jpg`, { type: "image/jpeg" })
}

function encode(bitmap, edge, quality) {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext("2d")
  context.fillStyle = "#fff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
}
