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

/** Controls anchored on both horizontal or both vertical sides stretch via CSS margins */
function isStretchAnchor(def: ControlDefinition): boolean {
  const { anchor } = def;
  const hStretch = anchor.left && anchor.right;
  const vStretch = anchor.top && anchor.bottom;
  return hStretch || vStretch;
}

export function computeScaledStyle(
  def: ControlDefinition,
  scaleX: number,
  scaleY: number,
): CSSProperties {
  return {
    position: 'absolute',
    left: def.position.x * scaleX,
    top: def.position.y * scaleY,
    width: def.size.width * scaleX,
    height: def.size.height * scaleY,
  };
}

export function computeLayoutStyle(
  def: ControlDefinition,
  parentSize?: { width: number; height: number },
  scale?: { scaleX: number; scaleY: number },
): CSSProperties {
  // Dock takes priority over absolute positioning
  if (def.dock !== 'None') {
    return computeDockStyle(def.dock, def.size, def.position);
  }

  // Proportional scaling for non-stretch controls when scale differs from 1:1
  if (scale && (scale.scaleX !== 1 || scale.scaleY !== 1) && !isStretchAnchor(def)) {
    return computeScaledStyle(def, scale.scaleX, scale.scaleY);
  }

  // Anchor layout when parentSize is available (includes stretch anchors)
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

const DEFAULT_FONT: FontDefinition = {
  family: 'Segoe UI',
  size: 9,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
};

export function computeFontStyle(font: FontDefinition | undefined): CSSProperties {
  const f = font ?? DEFAULT_FONT;
  const textDecoration = [
    f.underline ? 'underline' : '',
    f.strikethrough ? 'line-through' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    fontFamily: f.family,
    fontSize: `${f.size}pt`,
    fontWeight: f.bold ? 'bold' : 'normal',
    fontStyle: f.italic ? 'italic' : 'normal',
    textDecoration: textDecoration || 'none',
  };
}
