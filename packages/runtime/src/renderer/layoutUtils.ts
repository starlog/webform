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

/** Controls with non-default anchors (bottom or right) need anchor-based layout, not scaling */
function hasExplicitAnchor(def: ControlDefinition): boolean {
  return def.anchor.bottom || def.anchor.right;
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

  // Proportional scaling only for controls with default anchors (top-left only).
  // Controls with explicit bottom/right anchors must use anchor-based layout
  // so they stay correctly positioned relative to their parent's edges.
  if (
    scale &&
    (scale.scaleX !== 1 || scale.scaleY !== 1) &&
    !isStretchAnchor(def) &&
    !hasExplicitAnchor(def)
  ) {
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

/**
 * Card 등 컨테이너 컨트롤의 CSS containing block 크기를 계산한다.
 * 헤더/보더 등으로 인해 CSS containing block이 컨트롤 디자인 크기보다 작아지는 경우를 보정한다.
 */
export function getContainerClientSize(
  definition: ControlDefinition,
): { width: number; height: number } {
  if (definition.type === 'Card') {
    const showHeader = definition.properties?.showHeader !== false;
    const showBorder = definition.properties?.showBorder !== false;
    const isSmall = definition.properties?.size === 'Small';

    const borderWidth = showBorder ? 1 : 0;
    // Header: padding-top + title-line-height + padding-bottom + border-bottom
    // Normal: 12 + 20 + 12 + 1 = 45, Small: 8 + 17 + 8 + 1 = 34
    const headerHeight = showHeader ? (isSmall ? 34 : 45) : 0;

    return {
      width: definition.size.width - 2 * borderWidth,
      height: definition.size.height - headerHeight - 2 * borderWidth,
    };
  }

  return definition.size;
}

const DEFAULT_FONT: FontDefinition = {
  family: 'Segoe UI',
  size: 9,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
};

export function computeFontStyle(font: Partial<FontDefinition> | undefined): CSSProperties {
  const f = { ...DEFAULT_FONT, ...font };
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
