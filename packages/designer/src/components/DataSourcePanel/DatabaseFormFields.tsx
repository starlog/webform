import { useId } from 'react';
import type { CSSProperties } from 'react';

export interface DatabaseFormFieldsProps {
  dialect: string;
  connectionString: string;
  onConnectionStringChange: (value: string) => void;
  host: string;
  onHostChange: (value: string) => void;
  port: string;
  onPortChange: (value: string) => void;
  user: string;
  onUserChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  database: string;
  onDatabaseChange: (value: string) => void;
  ssl: boolean;
  onSslChange: (value: boolean) => void;
  styles: {
    formGroup: CSSProperties;
    formLabel: CSSProperties;
    formInput: CSSProperties;
    formCheckboxGroup: CSSProperties;
  };
  defaultPorts?: Record<string, string>;
  showPlaceholders?: boolean;
}

export function DatabaseFormFields({
  dialect,
  connectionString,
  onConnectionStringChange,
  host,
  onHostChange,
  port,
  onPortChange,
  user,
  onUserChange,
  password,
  onPasswordChange,
  database,
  onDatabaseChange,
  ssl,
  onSslChange,
  styles,
  defaultPorts = {},
  showPlaceholders = false,
}: DatabaseFormFieldsProps) {
  const id = useId();
  const sslCheckboxId = `${id}-ssl-checkbox`;

  if (dialect === 'mongodb') {
    return (
      <>
        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Connection String</label>
          <input
            style={styles.formInput}
            value={connectionString}
            onChange={(e) => onConnectionStringChange(e.target.value)}
            placeholder={showPlaceholders ? 'mongodb://localhost:27017' : undefined}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.formLabel}>Database</label>
          <input
            style={styles.formInput}
            value={database}
            onChange={(e) => onDatabaseChange(e.target.value)}
            placeholder={showPlaceholders ? 'mydb' : undefined}
          />
        </div>
      </>
    );
  }

  if (!dialect) return null;

  return (
    <>
      <div style={styles.formGroup}>
        <label style={styles.formLabel}>Host</label>
        <input
          style={styles.formInput}
          value={host}
          onChange={(e) => onHostChange(e.target.value)}
          placeholder={showPlaceholders ? 'localhost' : undefined}
        />
      </div>
      <div style={styles.formGroup}>
        <label style={styles.formLabel}>Port</label>
        <input
          style={styles.formInput}
          value={port}
          onChange={(e) => onPortChange(e.target.value)}
          placeholder={showPlaceholders ? defaultPorts[dialect] || '' : undefined}
          type="number"
        />
      </div>
      <div style={styles.formGroup}>
        <label style={styles.formLabel}>User</label>
        <input
          style={styles.formInput}
          value={user}
          onChange={(e) => onUserChange(e.target.value)}
          placeholder={showPlaceholders ? 'sa' : undefined}
        />
      </div>
      <div style={styles.formGroup}>
        <label style={styles.formLabel}>Password</label>
        <input
          style={styles.formInput}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          type="password"
        />
      </div>
      <div style={styles.formGroup}>
        <label style={styles.formLabel}>Database</label>
        <input
          style={styles.formInput}
          value={database}
          onChange={(e) => onDatabaseChange(e.target.value)}
          placeholder={showPlaceholders ? 'mydb' : undefined}
        />
      </div>
      <div style={styles.formCheckboxGroup}>
        <input
          type="checkbox"
          checked={ssl}
          onChange={(e) => onSslChange(e.target.checked)}
          id={sslCheckboxId}
        />
        <label htmlFor={sslCheckboxId} style={styles.formLabel}>
          SSL
        </label>
      </div>
    </>
  );
}
