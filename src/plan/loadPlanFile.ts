import type { Plan } from './planStore'

export const PLAN_FILE_TYPES = ['image/png', 'image/jpeg']

/** Decode a PNG/JPG file into a plan; rejects other or broken files. */
export async function loadPlanFile(file: File): Promise<Plan> {
  if (!PLAN_FILE_TYPES.includes(file.type)) {
    throw new Error(`${file.name} is not a PNG or JPG image.`)
  }
  let image: ImageBitmap
  try {
    image = await createImageBitmap(file)
  } catch {
    throw new Error(`${file.name} could not be read as an image.`)
  }
  return { name: file.name, image, width: image.width, height: image.height }
}
