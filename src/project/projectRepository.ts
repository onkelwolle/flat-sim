import type { Calibration, Furniture } from '../plan/planStore'

/** A project as it is kept in storage; the plan image stays an encoded file. */
export type SavedProject = {
  plan: { name: string; image: Blob } | null
  calibration: Calibration | null
  furniture: Furniture[]
}

/** Where the project is kept between visits. */
export interface ProjectRepository {
  /** The saved project, or null if none has been saved. */
  load(): Promise<SavedProject | null>
  /** Keep `project`, replacing any saved one. */
  save(project: SavedProject): Promise<void>
  /** Forget the saved project. */
  clear(): Promise<void>
}

/** A saved project exists but cannot be read back. */
export class CorruptProjectError extends Error {
  constructor(message = 'The saved project could not be read.') {
    super(message)
    this.name = 'CorruptProjectError'
  }
}
