import type { CSSProperties } from 'react';

interface TrafficLightButtonsProps {
  onMaximize?: () => void;
  showMinimize?: boolean;
  showMaximize?: boolean;
}

export const titleTextStyle: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
};

export function TrafficLightButtons({
  onMaximize,
  showMinimize = true,
  showMaximize = true,
}: TrafficLightButtonsProps) {
  const btnBase: CSSProperties = {
    width: 12,
    height: 12,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    marginRight: 8,
  };
  const disabledBtn: CSSProperties = {
    ...btnBase,
    backgroundColor: '#ccc',
    cursor: 'default',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginRight: 8 }}>
      <button style={{ ...btnBase, backgroundColor: '#FF5F57' }} title="Close" />
      {showMinimize ? (
        <button style={{ ...btnBase, backgroundColor: '#FEBC2E' }} title="Minimize" />
      ) : (
        <button style={disabledBtn} disabled />
      )}
      {showMaximize ? (
        <button style={{ ...btnBase, backgroundColor: '#28C840' }} title="Maximize" onClick={onMaximize} />
      ) : (
        <button style={disabledBtn} disabled />
      )}
    </div>
  );
}
