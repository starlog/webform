import { useState } from 'react';
import type { AnchorStyle, FontDefinition } from '@webform/common';
import type { PropertyMeta } from './controlProperties';
import { TextEditor } from './editors/TextEditor';
import { NumberEditor } from './editors/NumberEditor';
import { ColorPicker } from './editors/ColorPicker';
import { FontPicker } from './editors/FontPicker';
import { DropdownEditor } from './editors/DropdownEditor';
import { BooleanToggle } from './editors/BooleanToggle';
import { AnchorEditor } from './editors/AnchorEditor';
import { CollectionEditor } from './editors/CollectionEditor';
import { TabPagesEditor } from './editors/TabPagesEditor';
import { MongoColumnsEditor } from './editors/MongoColumnsEditor';
import { MongoConnectionStringEditor } from './editors/MongoConnectionStringEditor';
import { SampleDataEditor } from './editors/SampleDataEditor';

interface PropertyCategoryProps {
  category: string;
  properties: PropertyMeta[];
  getValue: (name: string) => unknown;
  onValueChange: (name: string, value: unknown) => void;
}

export function PropertyCategory({ category, properties, getValue, onValueChange }: PropertyCategoryProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ borderBottom: '1px solid #e0e0e0' }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 4px',
          backgroundColor: '#f0f0f0',
          borderTop: '1px solid #ccc',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 10, width: 12 }}>{collapsed ? '\u25B6' : '\u25BC'}</span>
        {category}
      </div>
      {!collapsed && (
        <div>
          {properties.map((prop) => (
            <PropertyRow key={prop.name} meta={prop} value={getValue(prop.name)} onChange={(v) => onValueChange(prop.name, v)} />
          ))}
        </div>
      )}
    </div>
  );
}

interface PropertyRowProps {
  meta: PropertyMeta;
  value: unknown;
  onChange: (value: unknown) => void;
}

function PropertyRow({ meta, value, onChange }: PropertyRowProps) {
  if (meta.editorType === 'graphSample') {
    return (
      <div style={{ padding: '4px 6px', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
        <PropertyEditor meta={meta} value={value} onChange={onChange} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        borderBottom: '1px solid #f0f0f0',
        fontSize: 12,
      }}
    >
      <div
        style={{
          width: 90,
          minWidth: 90,
          padding: '3px 4px',
          color: '#333',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={meta.name}
      >
        {meta.label}
      </div>
      <div style={{ flex: 1, padding: '2px 4px 2px 0' }}>
        <PropertyEditor meta={meta} value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function PropertyEditor({ meta, value, onChange }: PropertyRowProps) {
  switch (meta.editorType) {
    case 'text':
      return <TextEditor value={value as string ?? ''} onChange={onChange} />;
    case 'number':
      return <NumberEditor value={value as number ?? 0} onChange={onChange} min={meta.min} max={meta.max} />;
    case 'color':
      return <ColorPicker value={value as string ?? '#FFFFFF'} onChange={onChange} />;
    case 'font':
      return <FontPicker value={value as FontDefinition | undefined} onChange={onChange} />;
    case 'dropdown':
      return <DropdownEditor value={value as string ?? ''} options={meta.options ?? []} onChange={onChange} />;
    case 'boolean':
      return <BooleanToggle value={value as boolean ?? false} onChange={onChange} />;
    case 'anchor':
      return <AnchorEditor value={value as AnchorStyle} onChange={onChange} />;
    case 'collection':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return <CollectionEditor value={value as any[] ?? []} onChange={onChange} />;
    case 'tabEditor':
      return <TabPagesEditor value={value as { title: string; id: string }[] ?? []} onChange={onChange} />;
    case 'mongoColumns':
      return <MongoColumnsEditor value={value as string ?? ''} onChange={onChange} />;
    case 'mongoConnectionString':
      return <MongoConnectionStringEditor value={value as string ?? ''} onChange={onChange} />;
    case 'graphSample':
      return <SampleDataEditor value={value as string ?? 'Bar'} />;
    default:
      return <TextEditor value={String(value ?? '')} onChange={onChange} />;
  }
}
