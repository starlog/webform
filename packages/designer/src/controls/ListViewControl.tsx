import {
  ListViewView,
  type ListViewItem,
  type ListViewColumn,
  type ListViewMode,
} from '@webform/common/views';
import type { DesignerControlProps } from './registry';

const SAMPLE_COLUMNS: ListViewColumn[] = [
  { text: 'Name', width: 120 },
  { text: 'Type', width: 80 },
  { text: 'Size', width: 60 },
];

const SAMPLE_ITEMS: ListViewItem[] = [
  { text: 'Document.txt', subItems: ['Text', '12 KB'] },
  { text: 'Image.png', subItems: ['Image', '256 KB'] },
  { text: 'Data.xlsx', subItems: ['Spreadsheet', '48 KB'] },
];

export function ListViewControl({ properties, size }: DesignerControlProps) {
  const items = (properties.items as ListViewItem[]) ?? [];
  const columns = (properties.columns as ListViewColumn[]) ?? [];

  return (
    <ListViewView
      items={items.length > 0 ? items : SAMPLE_ITEMS}
      columns={columns.length > 0 ? columns : SAMPLE_COLUMNS}
      view={(properties.view as ListViewMode) ?? 'Details'}
      gridLines={(properties.gridLines as boolean) ?? false}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
