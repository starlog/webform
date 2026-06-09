import { WebBrowserView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function WebBrowserControl({ properties, size }: DesignerControlProps) {
  return (
    <WebBrowserView
      url={(properties.url as string) ?? 'about:blank'}
      backColor={properties.backColor as string | undefined}
      placeholderText="WebBrowser"
      style={{ width: size.width, height: size.height }}
    />
  );
}
