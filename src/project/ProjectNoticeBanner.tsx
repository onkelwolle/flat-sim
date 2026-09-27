import type { ProjectNotice } from './projectPersistence'

const MESSAGES: Record<ProjectNotice, string> = {
  'storage-unavailable':
    'This browser’s storage is not available, so the project won’t be saved when you leave the page.',
  'restore-failed':
    'The saved project could not be restored, so a new one was started.',
  'save-failed':
    'The project could not be saved. Your changes are kept only until you leave the page.',
}

/** Non-blocking message about saving or restoring the project. */
export function ProjectNoticeBanner({
  notice,
  onDismiss,
}: {
  notice: ProjectNotice | null
  onDismiss: () => void
}) {
  if (!notice) return null
  return (
    <div className="notice" role="alert">
      <p>{MESSAGES[notice]}</p>
      <button type="button" className="button" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  )
}
