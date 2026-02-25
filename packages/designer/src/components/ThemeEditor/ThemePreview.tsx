import type { ThemeTokens } from '@webform/common';
import { useThemeEditorStore } from '../../stores/themeEditorStore';

export function ThemePreview() {
  const currentTheme = useThemeEditorStore((s) => s.currentTheme);

  if (!currentTheme) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#999',
          fontSize: 13,
        }}
      >
        No theme selected
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '6px 8px',
          fontWeight: 600,
          fontSize: 12,
          borderBottom: '1px solid #ccc',
          backgroundColor: '#e8e8e8',
        }}
      >
        Preview
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8, backgroundColor: '#d0d0d0' }}>
        <SampleWindow theme={currentTheme} />
      </div>
    </div>
  );
}

function SampleWindow({ theme }: { theme: ThemeTokens }) {
  const t = theme;

  return (
    <div
      style={{
        border: t.window.border,
        borderRadius: t.window.borderRadius,
        boxShadow: t.window.shadow,
        overflow: 'hidden',
        backgroundColor: t.form.backgroundColor,
        fontFamily: t.form.fontFamily,
        fontSize: t.form.fontSize,
        color: t.form.foreground,
      }}
    >
      {/* Title Bar */}
      <div
        style={{
          background: t.window.titleBar.background,
          color: t.window.titleBar.foreground,
          height: t.window.titleBar.height,
          font: t.window.titleBar.font,
          borderRadius: t.window.titleBar.borderRadius,
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          justifyContent: 'space-between',
        }}
      >
        {t.window.titleBar.controlButtonsPosition === 'left' && (
          <div style={{ display: 'flex', gap: 4 }}>
            <CircleBtn color="#FF5F57" />
            <CircleBtn color="#FEBC2E" />
            <CircleBtn color="#28C840" />
          </div>
        )}
        <span style={{ flex: 1, textAlign: 'center' }}>Sample Form</span>
        {t.window.titleBar.controlButtonsPosition === 'right' && (
          <div style={{ display: 'flex', gap: 4 }}>
            <SquareBtn label={'\u2013'} />
            <SquareBtn label={'\u25A1'} />
            <SquareBtn label={'\u2715'} />
          </div>
        )}
      </div>

      {/* Form Body */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Label */}
        <div>Hello, Theme Editor!</div>

        {/* TextInput */}
        <input
          type="text"
          readOnly
          value="Sample text"
          style={{
            background: t.controls.textInput.background,
            border: t.controls.textInput.border,
            borderRadius: t.controls.textInput.borderRadius,
            color: t.controls.textInput.foreground,
            padding: t.controls.textInput.padding,
            fontFamily: 'inherit',
            fontSize: 'inherit',
          }}
        />

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            style={{
              background: t.accent.primary,
              border: 'none',
              borderRadius: t.controls.button.borderRadius,
              color: t.accent.primaryForeground,
              padding: t.controls.button.padding,
              cursor: 'default',
              fontFamily: 'inherit',
              fontSize: 'inherit',
            }}
          >
            Primary
          </button>
          <button
            type="button"
            style={{
              background: t.controls.button.background,
              border: t.controls.button.border,
              borderRadius: t.controls.button.borderRadius,
              color: t.controls.button.foreground,
              padding: t.controls.button.padding,
              cursor: 'default',
              fontFamily: 'inherit',
              fontSize: 'inherit',
            }}
          >
            Button
          </button>
        </div>

        {/* CheckBox + Radio */}
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                width: 14,
                height: 14,
                border: t.controls.checkRadio.border,
                borderRadius: t.controls.checkRadio.borderRadius,
                background: t.controls.checkRadio.checkedBackground,
                display: 'inline-block',
              }}
            />
            Checked
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                width: 14,
                height: 14,
                border: t.controls.checkRadio.border,
                borderRadius: '50%',
                background: t.controls.checkRadio.background,
                display: 'inline-block',
              }}
            />
            Radio
          </label>
        </div>

        {/* Select */}
        <select
          disabled
          style={{
            background: t.controls.select.background,
            border: t.controls.select.border,
            borderRadius: t.controls.select.borderRadius,
            color: t.controls.select.foreground,
            padding: '2px 4px',
            fontFamily: 'inherit',
            fontSize: 'inherit',
          }}
        >
          <option>Option 1</option>
        </select>

        {/* ProgressBar */}
        <div
          style={{
            background: t.controls.progressBar.background,
            border: t.controls.progressBar.border,
            borderRadius: t.controls.progressBar.borderRadius,
            height: 18,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '65%',
              height: '100%',
              background: t.controls.progressBar.fillBackground,
              borderRadius: t.controls.progressBar.borderRadius,
            }}
          />
        </div>

        {/* GroupBox */}
        <fieldset
          style={{
            border: t.controls.groupBox.border,
            borderRadius: t.controls.groupBox.borderRadius,
            padding: '8px',
            margin: 0,
          }}
        >
          <legend style={{ color: t.controls.groupBox.foreground, fontSize: 'inherit' }}>
            GroupBox
          </legend>
          <div style={{ fontSize: 11, color: t.form.foreground }}>Content</div>
        </fieldset>

        {/* Mini DataGrid */}
        <div
          style={{
            border: t.controls.dataGrid.border,
            borderRadius: t.controls.dataGrid.borderRadius,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              background: t.controls.dataGrid.headerBackground,
              color: t.controls.dataGrid.headerForeground,
              borderBottom: t.controls.dataGrid.headerBorder,
              fontSize: 11,
            }}
          >
            <div style={{ flex: 1, padding: '2px 6px' }}>Name</div>
            <div style={{ flex: 1, padding: '2px 6px' }}>Value</div>
          </div>
          <div
            style={{
              display: 'flex',
              background: t.controls.dataGrid.rowBackground,
              color: t.controls.dataGrid.rowForeground,
              fontSize: 11,
            }}
          >
            <div style={{ flex: 1, padding: '2px 6px' }}>Item 1</div>
            <div style={{ flex: 1, padding: '2px 6px' }}>100</div>
          </div>
          <div
            style={{
              display: 'flex',
              background: t.controls.dataGrid.selectedRowBackground,
              color: t.controls.dataGrid.selectedRowForeground,
              fontSize: 11,
            }}
          >
            <div style={{ flex: 1, padding: '2px 6px' }}>Item 2</div>
            <div style={{ flex: 1, padding: '2px 6px' }}>200</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CircleBtn({ color }: { color: string }) {
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        backgroundColor: color,
        display: 'inline-block',
      }}
    />
  );
}

function SquareBtn({ label }: { label: string }) {
  return (
    <span
      style={{
        width: 16,
        height: 16,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        opacity: 0.8,
      }}
    >
      {label}
    </span>
  );
}
