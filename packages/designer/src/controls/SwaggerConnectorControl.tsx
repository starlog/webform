import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

export function SwaggerConnectorControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const specYaml = (properties.specYaml as string) || '';
  const baseUrl = (properties.baseUrl as string) || '';
  const specSource = (properties.specSource as string) || 'yaml';
  const specUrl = (properties.specUrl as string) || '';
  const hasSpec = specYaml.length > 0;

  let title = 'Swagger API';
  let endpointCount = 0;
  if (hasSpec) {
    const titleMatch = specYaml.match(/title:\s*['"]?([^'"\n]+)/);
    if (titleMatch) title = titleMatch[1].trim();
    endpointCount = (specYaml.match(/^\s+(get|post|put|patch|delete):/gm) || []).length;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        border: `1px dashed ${theme.controls.panel.border}`,
        borderRadius: theme.controls.panel.borderRadius,
        backgroundColor: theme.controls.panel.background,
        width: size.width,
        height: size.height,
        boxSizing: 'border-box',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{'🔗'}</span>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#334E68' }}>{title}</span>
        <span style={{ fontSize: 9, color: hasSpec ? '#627D98' : '#D64545' }}>
          {hasSpec
            ? `${endpointCount} endpoints` + (baseUrl ? ` · ${baseUrl}` : '')
            : specSource === 'url' && specUrl
              ? `from: ${specUrl}`
              : 'Not configured'}
        </span>
      </div>
    </div>
  );
}
