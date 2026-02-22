import { useState, useEffect } from 'react';
import type { FormDefinition } from '@webform/common';
import { SDUIRenderer } from './renderer/SDUIRenderer';
import { apiClient } from './communication/apiClient';
import { wsClient } from './communication/wsClient';
import { setupPatchListener } from './communication/patchApplier';
import { useRuntimeStore } from './stores/runtimeStore';

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

  return <SDUIRenderer formDefinition={formDefinition} />;
}
