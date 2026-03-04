import type { CSSProperties, ReactNode } from 'react';
import { GroupBoxView } from '@webform/common/views';

interface GroupBoxProps {
  id: string;
  name: string;
  text?: string;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}

export function GroupBox({ id, text, backColor, foreColor, style, children }: GroupBoxProps) {
  return (
    <GroupBoxView
      text={text}
      backColor={backColor}
      foreColor={foreColor}
      className="wf-groupbox"
      data-control-id={id}
      style={style}
    >
      {children}
    </GroupBoxView>
  );
}
