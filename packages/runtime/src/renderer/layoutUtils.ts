import type { CSSProperties } from 'react';
import type { ControlDefinition, FontDefinition, DockStyle } from '@webform/common';

export function computeDockStyle(
  dock: DockStyle,
  size: { width: number; height: number },
  position?: { x: number; y: number },
): CSSProperties {
  switch (dock) {
    case 'Top':
      return { width: '100%', height: size.height, flexShrink: 0 };
    case 'Bottom':
      return { width: '100%', height: size.height, flexShrink: 0 };
    case 'Left':
      return { width: size.width, height: '100%', flexShrink: 0 };
    case 'Right':
      return { width: size.width, height: '100%', flexShrink: 0 };
    case 'Fill':
      return {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      };
    default:
      return {};
  }
}

export function computeAnchorStyle(
  def: ControlDefinition,
  parentSize: { width: number; height: number },
): CSSProperties {
  const { anchor, position, size } = def;
  const style: CSSProperties = { position: 'absolute' };

  if (anchor.left) {
    style.left = position.x;
  }
  if (anchor.right) {
    style.right = parentSize.width - position.x - size.width;
  }
  if (anchor.top) {
    style.top = position.y;
  }
  if (anchor.bottom) {
    style.bottom = parentSize.height - position.y - size.height;
  }

  // If both left and right anchored, width is auto
  if (anchor.left && anchor.right) {
    // width determined by left + right
  } else {
    style.width = size.width;
  }

  // If both top and bottom anchored, height is auto
  if (anchor.top && anchor.bottom) {
    // height determined by top + bottom
  } else {
    style.height = size.height;
  }

  return style;
}

export function computeLayoutStyle(def: ControlDefinition): CSSProperties {
  // Dock takes priority over absolute positioning
  if (def.dock !== 'None') {
    return computeDockStyle(def.dock, def.size, def.position);
  }

  // Default: absolute positioning
  return {
    position: 'absolute',
    left: def.position.x,
    top: def.position.y,
    width: def.size.width,
    height: def.size.height,
  };
}

export function computeFontStyle(font: FontDefinition): CSSProperties {
  const textDecoration = [
    font.underline ? 'underline' : '',
    font.strikethrough ? 'line-through' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    fontFamily: font.family,
    fontSize: `${font.size}pt`,
    fontWeight: font.bold ? 'bold' : 'normal',
    fontStyle: font.italic ? 'italic' : 'normal',
    textDecoration: textDecoration || 'none',
  };
}
