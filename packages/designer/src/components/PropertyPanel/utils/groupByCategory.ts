import type { PropertyCategory as PropertyCategoryName, PropertyMeta } from '../controlProperties';

type SortMode = 'category' | 'alphabetical';

const DEFAULT_CONTROL_ORDER: PropertyCategoryName[] = [
  'Design',
  'Appearance',
  'Behavior',
  'Data',
  'APIs',
  'Sample',
  'Layout',
];

export function groupByCategory(
  metas: PropertyMeta[],
  options?: {
    sortMode?: SortMode;
    categoryOrder?: PropertyCategoryName[];
  },
): { category: string; properties: PropertyMeta[] }[] {
  const sortMode = options?.sortMode ?? 'category';
  const categoryOrder = options?.categoryOrder ?? DEFAULT_CONTROL_ORDER;

  if (sortMode === 'alphabetical') {
    const sorted = [...metas].sort((a, b) => a.label.localeCompare(b.label));
    return [{ category: 'All', properties: sorted }];
  }

  const groups = new Map<string, PropertyMeta[]>();
  for (const meta of metas) {
    const cat = meta.category ?? 'Design';
    const list = groups.get(cat) ?? [];
    list.push(meta);
    groups.set(cat, list);
  }

  return categoryOrder
    .filter((c) => groups.has(c))
    .map((c) => ({ category: c, properties: groups.get(c)! }));
}
