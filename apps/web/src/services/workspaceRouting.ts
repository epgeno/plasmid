export type WorkspaceTabId =
  | 'home'
  | 'navigator'
  | 'intersection'
  | 'stream'
  | 'liftover'
  | 'wiki'
  | 'swarm'
  | 'governance'

export const WORKSPACE_TAB_IDS: ReadonlyArray<WorkspaceTabId> = [
  'home',
  'navigator',
  'intersection',
  'stream',
  'liftover',
  'wiki',
  'swarm',
  'governance',
]

const WORKSPACE_TAB_SET = new Set<WorkspaceTabId>(WORKSPACE_TAB_IDS)

const TAB_HASH_ALIASES = new Map<string, WorkspaceTabId>([
  ['home', 'home'],
  ['start', 'home'],
  ['navigator', 'navigator'],
  ['intersection', 'intersection'],
  ['clinvar', 'intersection'],
  ['stream', 'stream'],
  ['viewer', 'stream'],
  ['liftover', 'liftover'],
  ['wiki', 'wiki'],
  ['swarm', 'swarm'],
  ['network', 'swarm'],
  ['governance', 'governance'],
  ['sources', 'governance'],
])

export function isWorkspaceTabId(value: unknown): value is WorkspaceTabId {
  return typeof value === 'string' && WORKSPACE_TAB_SET.has(value as WorkspaceTabId)
}

export function parseWorkspaceTabFromHash(
  rawHash: string | null | undefined
): WorkspaceTabId {
  if (!rawHash || typeof rawHash !== 'string') {
    return 'home'
  }
  const cleaned = rawHash
    .trim()
    .replace(/^#\/?/, '')
    .split(/[?&]/)[0]
    .replace(/\/+$/, '')
    .trim()
    .toLowerCase()

  if (!cleaned) {
    return 'home'
  }
  return TAB_HASH_ALIASES.get(cleaned) ?? 'home'
}

export function formatHashForWorkspaceTab(tab: WorkspaceTabId): string {
  return `#${isWorkspaceTabId(tab) ? tab : 'home'}`
}

export function resolvePostVaultImportTab(currentTab: WorkspaceTabId): WorkspaceTabId {
  if (!isWorkspaceTabId(currentTab) || currentTab === 'home') {
    return 'intersection'
  }
  return currentTab
}
