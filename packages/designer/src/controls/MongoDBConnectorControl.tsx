import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

export function MongoDBConnectorControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const database = (properties.database as string) || '';
  const connectionString = (properties.connectionString as string) || '';
  const hasConnection = connectionString.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        border: (theme.controls.panel.border as string).replace('solid', 'dashed'),
        borderRadius: theme.controls.panel.borderRadius,
        backgroundColor: theme.controls.panel.background,
        width: size.width,
        height: size.height,
        boxSizing: 'border-box',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{'\uD83D\uDDC4'}</span>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#334E68' }}>
          {database || 'MongoDB'}
        </span>
        <span style={{ fontSize: 9, color: hasConnection ? '#627D98' : '#D64545' }}>
          {hasConnection ? 'Connected' : 'Not configured'}
        </span>
      </div>
    </div>
  );
}
