import type { CSSProperties, ReactNode } from 'react';
import type { FormProperties } from '@webform/common';
import { computeFontStyle } from './layoutUtils';

interface FormContainerProps {
  properties: FormProperties;
  children: ReactNode;
}

const titleBarStyle: CSSProperties = {
  height: 30,
  background: 'linear-gradient(to right, #0078D7, #005A9E)',
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  color: '#FFFFFF',
  fontSize: '12px',
  fontFamily: 'Segoe UI, sans-serif',
  userSelect: 'none',
};

const titleTextStyle: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
};

const windowButtonStyle: CSSProperties = {
  width: 30,
  height: 30,
  border: 'none',
  background: 'transparent',
  color: '#FFFFFF',
  fontSize: '14px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};

function getBorderStyle(formBorderStyle: FormProperties['formBorderStyle']): CSSProperties {
  switch (formBorderStyle) {
    case 'None':
      return { border: 'none' };
    case 'FixedSingle':
      return { border: '1px solid #333333' };
    case 'Fixed3D':
      return { border: '2px inset #D0D0D0' };
    case 'Sizable':
      return { border: '1px solid #333333', resize: 'both', overflow: 'auto' };
    default:
      return { border: '1px solid #333333' };
  }
}

export function FormContainer({ properties, children }: FormContainerProps) {
  const borderStyles = getBorderStyle(properties.formBorderStyle);
  const fontStyles = computeFontStyle(properties.font);

  const containerStyle: CSSProperties = {
    width: properties.width,
    height: properties.height,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
    ...borderStyles,
  };

  const contentStyle: CSSProperties = {
    flex: 1,
    position: 'relative',
    backgroundColor: properties.backgroundColor || '#F0F0F0',
    overflow: 'hidden',
    ...fontStyles,
  };

  const showTitleBar = properties.formBorderStyle !== 'None';

  return (
    <div className="wf-form" style={containerStyle}>
      {showTitleBar && (
        <div className="wf-titlebar" style={titleBarStyle}>
          <span style={titleTextStyle}>{properties.title}</span>
          {properties.minimizeBox && (
            <button style={windowButtonStyle} title="Minimize">&#x2500;</button>
          )}
          {properties.maximizeBox && (
            <button style={windowButtonStyle} title="Maximize">&#x25A1;</button>
          )}
          <button
            style={{ ...windowButtonStyle, fontWeight: 'bold' }}
            title="Close"
          >
            &#x2715;
          </button>
        </div>
      )}
      <div className="wf-content" style={contentStyle}>
        {children}
      </div>
    </div>
  );
}
