import { useState, useEffect, useCallback } from 'react';
import type { FormDefinition } from '@webform/common';
import { SDUIRenderer } from './renderer/SDUIRenderer';
import { apiClient } from './communication/apiClient';
import { wsClient } from './communication/wsClient';
import { setupPatchListener } from './communication/patchApplier';
import { useRuntimeStore, type DialogMessage } from './stores/runtimeStore';

export function App() {
  const [formDefinition, setFormDefinition] = useState<FormDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyPatches = useRuntimeStore((s) => s.applyPatches);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const formId = params.get('formId');

    if (!formId) {
      setError('formId 파라미터가 필요합니다.');
      setLoading(false);
      return;
    }

    apiClient
      .fetchForm(formId)
      .then((def) => {
        setFormDefinition(def);

        // WebSocket 연결 및 패치 리스너 설정
        wsClient.connect(formId);
        setupPatchListener({ applyPatches }, wsClient);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    return () => {
      wsClient.disconnect();
    };
  }, [applyPatches]);

  if (loading) {
    return <div style={{ padding: 20, fontFamily: 'Segoe UI, sans-serif' }}>로딩 중...</div>;
  }

  if (error) {
    return <div style={{ padding: 20, fontFamily: 'Segoe UI, sans-serif', color: 'red' }}>오류: {error}</div>;
  }

  if (!formDefinition) {
    return <div style={{ padding: 20, fontFamily: 'Segoe UI, sans-serif' }}>폼을 찾을 수 없습니다.</div>;
  }

  return (
    <>
      <SDUIRenderer formDefinition={formDefinition} />
      <MessageDialog />
    </>
  );
}

const dialogTypeConfig: Record<DialogMessage['dialogType'], { icon: string; color: string }> = {
  info: { icon: 'ℹ', color: '#0078d4' },
  warning: { icon: '⚠', color: '#d48a00' },
  error: { icon: '✕', color: '#d42020' },
  success: { icon: '✓', color: '#107c10' },
};

function MessageDialog() {
  const dialog = useRuntimeStore((s) => s.dialogQueue[0] ?? null);
  const dismissDialog = useRuntimeStore((s) => s.dismissDialog);

  const handleDismiss = useCallback(() => {
    dismissDialog();
  }, [dismissDialog]);

  useEffect(() => {
    if (!dialog) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        handleDismiss();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [dialog, handleDismiss]);

  if (!dialog) return null;

  const config = dialogTypeConfig[dialog.dialogType] ?? dialogTypeConfig.info;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        fontFamily: 'Segoe UI, sans-serif',
      }}
      onClick={handleDismiss}
    >
      <div
        style={{
          backgroundColor: '#fff',
          border: '1px solid #d0d0d0',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          minWidth: 320,
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: '#f0f0f0',
            borderBottom: '1px solid #d0d0d0',
            fontSize: 13,
            fontWeight: 600,
            color: '#333',
          }}
        >
          {dialog.title || 'Message'}
        </div>

        {/* Body */}
        <div style={{ padding: '16px 16px 20px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 22, color: config.color, lineHeight: 1, flexShrink: 0 }}>
            {config.icon}
          </span>
          <span style={{ fontSize: 13, color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {dialog.text}
          </span>
        </div>

        {/* Button bar */}
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: '#f0f0f0',
            borderTop: '1px solid #d0d0d0',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              padding: '4px 24px',
              fontSize: 13,
              border: '1px solid #adadad',
              backgroundColor: '#e1e1e1',
              cursor: 'pointer',
              fontFamily: 'Segoe UI, sans-serif',
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
