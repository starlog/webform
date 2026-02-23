import type { DesignerControlProps } from './registry';

export function MongoDBConnectorControl({ properties }: DesignerControlProps) {
  const database = (properties.database as string) || 'DB';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        border: '1px dashed #888',
        borderRadius: 4,
        backgroundColor: '#f8f8f8',
        fontSize: 11,
        color: '#555',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 14 }}>{'\uD83D\uDDC4'}</span>
      <span>{database}</span>
    </div>
  );
}
