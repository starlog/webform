import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

export function DataSourceConnectorControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const dsType = (properties.dsType as string) || 'database';
  const dialect = (properties.dialect as string) || 'postgresql';
  const host = (properties.host as string) || '';
  const baseUrl = (properties.baseUrl as string) || '';

  let icon: string;
  let label: string;
  let isConfigured: boolean;

  switch (dsType) {
    case 'restApi':
      icon = '\uD83C\uDF10';
      label = 'REST API';
      isConfigured = baseUrl.length > 0;
      break;
    case 'static':
      icon = '\uD83D\uDCCB';
      label = 'Static';
      isConfigured = true;
      break;
    case 'database':
    default:
      icon = '\uD83D\uDDC3\uFE0F';
      label = `${dialect.toUpperCase()} DB`;
      isConfigured = host.length > 0;
      break;
  }

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
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#334E68' }}>{label}</span>
        <span style={{ fontSize: 9, color: isConfigured ? '#627D98' : '#D64545' }}>
          {isConfigured ? 'Configured' : 'Not configured'}
        </span>
      </div>
    </div>
  );
}
