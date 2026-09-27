import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Calibration, Furniture } from '../plan/planStore'
import type { Point } from '../plan/zoomView'
import {
  CorruptProjectError,
  type ProjectRepository,
  type SavedProject,
} from './projectRepository'

/**
 * The saved record's layout. Bump it when the layout changes, and teach
 * `readRecord` to migrate records of earlier versions.
 */
const SCHEMA_VERSION = 1

type ProjectRecord = { version: typeof SCHEMA_VERSION; project: SavedProject }

interface ProjectDb extends DBSchema {
  projects: { key: string; value: ProjectRecord }
}

const STORE = 'projects'
/** The app keeps a single project, under this key. */
const KEY = 'current'

/** Keeps the project in the browser's IndexedDB, in database `name`. */
export function createIndexedDbProjectRepository(
  name = 'flat-sim',
): ProjectRepository {
  let opening: Promise<IDBPDatabase<ProjectDb>> | null = null
  const db = () => {
    opening ??= openDB<ProjectDb>(name, 1, {
      upgrade: (db) => void db.createObjectStore(STORE),
      // Let a newer version of the app, open in another tab, upgrade
      blocking: () => {
        void opening?.then((db) => db.close())
        opening = null
      },
    }).catch((e: unknown) => {
      // IndexedDB may come back (or be unavailable for good); try again later
      opening = null
      throw e
    })
    return opening
  }

  return {
    load: async () => {
      const record: unknown = await (await db()).get(STORE, KEY)
      return record === undefined ? null : readRecord(record)
    },
    save: async (project) => {
      await (await db()).put(STORE, { version: SCHEMA_VERSION, project }, KEY)
    },
    clear: async () => {
      await (await db()).delete(STORE, KEY)
    },
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null

const isNumber = (v: unknown): v is number =>
  typeof v === 'number' && isFinite(v)

const isPoint = (v: unknown): v is Point =>
  isObject(v) && isNumber(v.x) && isNumber(v.y)

const isCalibration = (v: unknown): v is Calibration =>
  isObject(v) &&
  isPoint(v.start) &&
  isPoint(v.end) &&
  isNumber(v.lengthCm) &&
  isObject(v.scale) &&
  isNumber(v.scale.pixelsPerMetre)

const isItem = (v: unknown): v is Furniture =>
  isObject(v) &&
  typeof v.id === 'string' &&
  typeof v.name === 'string' &&
  isNumber(v.widthCm) &&
  isNumber(v.depthCm) &&
  isPoint(v.position) &&
  isNumber(v.rotationDeg)

const isPlan = (v: unknown): v is SavedProject['plan'] =>
  isObject(v) && typeof v.name === 'string' && v.image instanceof Blob

/** The project in a stored record; throws if the record is not readable. */
function readRecord(record: unknown): SavedProject {
  if (!isObject(record) || record.version !== SCHEMA_VERSION) {
    throw new CorruptProjectError()
  }
  const { project } = record
  if (
    !isObject(project) ||
    !(project.plan === null || isPlan(project.plan)) ||
    !(project.calibration === null || isCalibration(project.calibration)) ||
    !Array.isArray(project.furniture) ||
    !project.furniture.every(isItem)
  ) {
    throw new CorruptProjectError()
  }
  return {
    plan: project.plan,
    calibration: project.calibration,
    furniture: project.furniture,
  }
}
