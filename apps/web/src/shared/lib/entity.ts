const ENTITY_KEY = 'aptora_entity_id';
const NAV_COLLAPSED_KEY = 'aptora_nav_collapsed';

export function getSelectedEntityId(): string {
  return sessionStorage.getItem(ENTITY_KEY) ?? 'all';
}

export function setSelectedEntityId(id: string) {
  sessionStorage.setItem(ENTITY_KEY, id || 'all');
}

/** Query value for APIs: omit filter noise when all. */
export function entityQueryParam(id = getSelectedEntityId()): string {
  const v = id.trim();
  if (!v || v === 'all') return 'all';
  return v;
}

export function appendEntityParam(
  params: URLSearchParams,
  id = getSelectedEntityId(),
) {
  params.set('entityId', entityQueryParam(id));
}

type EntityRef = { code: string; name?: string };

/** Table cell: entity code when included, otherwise short id. */
export function formatEntityCell(
  entityId: string | null | undefined,
  entity?: EntityRef | null,
): string {
  if (entity?.code) return entity.code;
  if (!entityId) return '—';
  return entityId.slice(0, 8);
}

export function isNavCollapsed(): boolean {
  return sessionStorage.getItem(NAV_COLLAPSED_KEY) === '1';
}

export function setNavCollapsed(collapsed: boolean) {
  sessionStorage.setItem(NAV_COLLAPSED_KEY, collapsed ? '1' : '0');
}

export { ENTITY_KEY, NAV_COLLAPSED_KEY };
