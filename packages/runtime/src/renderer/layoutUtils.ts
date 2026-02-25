import type { CSSProperties } from 'react';
import type { ControlDefinition, FontDefinition, DockStyle } from '@webform/common';

export function computeDockStyle(
  dock: DockStyle,
  size: { width: number; height: number },
  _position?: { x: number; y: number },
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

  const aLeft = anchor.left || (!anchor.left && !anchor.right);
  const aRight = anchor.right;
  const aTop = anchor.top || (!anchor.top && !anchor.bottom);
  const aBottom = anchor.bottom;

  // Horizontal
  if (aLeft && aRight) {
    style.left = position.x;
    style.right = parentSize.width - position.x - size.width;
  } else if (aRight) {
    style.right = parentSize.width - position.x - size.width;
    style.width = size.width;
  } else {
    style.left = position.x;
    style.width = size.width;
  }

  // Vertical
  if (aTop && aBottom) {
    style.top = position.y;
    style.bottom = parentSize.height - position.y - size.height;
  } else if (aBottom) {
    style.bottom = parentSize.height - position.y - size.height;
    style.height = size.height;
  } else {
    style.top = position.y;
    style.height = size.height;
  }

  return style;
}

export function computeLayoutStyle(
  def: ControlDefinition,
  parentSize?: { width: number; height: number },
): CSSProperties {
  // Dock takes priority over absolute positioning
  if (def.dock !== 'None') {
    return computeDockStyle(def.dock, def.size, def.position);
  }

  // Anchor layout when parentSize is available
  if (parentSize) {
    return computeAnchorStyle(def, parentSize);
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
