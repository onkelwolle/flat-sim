import type { Plan } from './planStore'

export const PLAN_FILE_TYPES = ['image/png', 'image/jpeg']

// Some platforms report no MIME type for dropped files; fall back to the name
const isPlanFile = (file: File) =>
  file.type
    ? PLAN_FILE_TYPES.includes(file.type)
    : /\.(png|jpe?g)$/i.test(file.name)

/** Decode a PNG/JPG file into a plan; rejects other or broken files. */
export async function loadPlanFile(file: File): Promise<Plan> {
  if (!isPlanFile(file)) {
    throw new Error(`${file.name} is not a PNG or JPG image.`)
  }
  let image: ImageBitmap
  try {
    image = await createImageBitmap(file)
  } catch {
    throw new Error(`${file.name} could not be read as an image.`)
  }
  return {
    name: file.name,
    image,
    width: image.width,
    height: image.height,
    source: file,
  }
}
