export type CrmSalon = {
  id: string;
  name: string;
  address: string;
};

export type CrmWorkspaceConfig = {
  salons: CrmSalon[];
  masterEmployeeIds: string[];
};

export const DEFAULT_CRM_SALONS: CrmSalon[] = [
  { id: 'salon-1', name: 'Салон 1', address: '' },
  { id: 'salon-2', name: 'Салон 2', address: '' },
];

export function normalizeCrmConfig(raw: {
  salons?: unknown;
  masterEmployeeIds?: unknown;
}): CrmWorkspaceConfig {
  const salons = Array.isArray(raw.salons)
    ? raw.salons
        .filter((s): s is CrmSalon =>
          Boolean(s && typeof s === 'object' && 'id' in s),
        )
        .map((s) => ({
          id: String((s as CrmSalon).id),
          name: String((s as CrmSalon).name ?? ''),
          address: String((s as CrmSalon).address ?? ''),
        }))
    : [...DEFAULT_CRM_SALONS];

  const masterEmployeeIds = Array.isArray(raw.masterEmployeeIds)
    ? raw.masterEmployeeIds.map((id) => String(id)).filter(Boolean)
    : [];

  return {
    salons: salons.length ? salons : [...DEFAULT_CRM_SALONS],
    masterEmployeeIds,
  };
}
