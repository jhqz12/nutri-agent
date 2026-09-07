import type { LibraryName, LibraryOverride, RawLibraries } from '../nutritionTypes'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function deepMerge<T>(base: T, patch: Record<string, unknown>): T {
  const next = structuredClone(base) as Record<string, unknown>
  for (const [key, value] of Object.entries(patch)) {
    if (isObject(value) && isObject(next[key])) next[key] = deepMerge(next[key], value)
    else next[key] = structuredClone(value)
  }
  return next as T
}

export function getEffectiveLibraries(raw: RawLibraries, overrides: LibraryOverride[]): RawLibraries {
  const effective = structuredClone(raw)
  const active = overrides.filter((item) => !item.revertedAt).sort((a, b) => a.version - b.version)
  for (const override of active) {
    const records = effective[override.library] as Array<{ id: string }>
    const index = records.findIndex((record) => record.id === override.recordId)
    if (index >= 0) records[index] = deepMerge(records[index], override.patch)
  }
  return effective
}

export function nextLibraryVersion(overrides: LibraryOverride[], library: LibraryName): number {
  return Math.max(0, ...overrides.filter((item) => item.library === library).map((item) => item.version)) + 1
}

export function createOverride(
  overrides: LibraryOverride[],
  library: LibraryName,
  recordId: string,
  patch: Record<string, unknown>,
  note: string
): LibraryOverride[] {
  if (!recordId.trim() || !Object.keys(patch).length) throw new Error('覆盖记录必须包含目标和修改内容。')
  return [...overrides, {
    id: crypto.randomUUID(),
    library,
    recordId,
    patch,
    version: nextLibraryVersion(overrides, library),
    note: note.trim() || '页面修改',
    createdAt: new Date().toISOString(),
    revertedAt: null
  }]
}

export function rollbackOverride(overrides: LibraryOverride[], overrideId: string): LibraryOverride[] {
  const target = overrides.find((item) => item.id === overrideId)
  if (!target || target.revertedAt) return overrides
  return overrides.map((item) => item.id === overrideId ? { ...item, revertedAt: new Date().toISOString() } : item)
}

export function getLibraryVersion(overrides: LibraryOverride[], library: LibraryName): number {
  return Math.max(0, ...overrides.filter((item) => item.library === library && !item.revertedAt).map((item) => item.version))
}
