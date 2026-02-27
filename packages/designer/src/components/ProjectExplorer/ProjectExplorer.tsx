import { useState, useEffect, useCallback, useRef } from 'react';
import type { FontDefinition } from '@webform/common';
import { apiService } from '../../services/apiService';
import type { ProjectDocument, FormSummary } from '../../services/apiService';
import { useDesignerStore } from '../../stores/designerStore';
import { FontPicker } from '../PropertyPanel/editors/FontPicker';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ProjectExplorerProps {
  onFormSelect: (formId: string) => void;
  onPublishAll?: (projectId: string) => void;
  refreshKey?: number;
}

interface ProjectWithForms {
  project: ProjectDocument;
  forms: FormSummary[];
}

interface ContextMenu {
  visible: boolean;
  x: number;
  y: number;
  targetType: 'project' | 'folder' | 'form';
  targetId: string;
  projectId: string;
}

export function ProjectExplorer({ onFormSelect, onPublishAll, refreshKey }: ProjectExplorerProps) {
  const [projects, setProjects] = useState<ProjectWithForms[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [loading, setLoading] = useState(false);
  const [renamingFormId, setRenamingFormId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const defaultFontDialogRef = useRef<HTMLDivElement>(null);
  const fontDialogRef = useRef<HTMLDivElement>(null);
  const currentFormId = useDesignerStore((s) => s.currentFormId);
  const editMode = useDesignerStore((s) => s.editMode);
  const currentShellId = useDesignerStore((s) => s.currentShellId);

  // 프로젝트 폰트 설정 다이얼로그 (일괄 적용)
  const [fontDialog, setFontDialog] = useState<{ projectId: string; projectName: string } | null>(null);
  const [fontValue, setFontValue] = useState<FontDefinition>({
    family: 'Segoe UI', size: 9, bold: false, italic: false, underline: false, strikethrough: false,
  });
  const [fontApplying, setFontApplying] = useState(false);

  // 기본 폰트 설정 다이얼로그
  const [defaultFontDialog, setDefaultFontDialog] = useState<{ projectId: string; projectName: string } | null>(null);
  const [defaultFontValue, setDefaultFontValue] = useState<FontDefinition>({
    family: 'Segoe UI', size: 9, bold: false, italic: false, underline: false, strikethrough: false,
  });
  const [defaultFontSaving, setDefaultFontSaving] = useState(false);

  useFocusTrap(defaultFontDialogRef, !!defaultFontDialog);
  useFocusTrap(fontDialogRef, !!fontDialog);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data: projectList } = await apiService.listProjects();
      const projectsWithForms: ProjectWithForms[] = await Promise.all(
        projectList.map(async (project) => {
          const { data } = await apiService.getProject(project._id);
          return { project: data.project, forms: data.forms };
        }),
      );
      setProjects(projectsWithForms);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects, refreshKey]);

  // 외부 클릭 시 컨텍스트 메뉴 닫기
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    targetType: ContextMenu['targetType'],
    targetId: string,
    projectId: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetType,
      targetId,
      projectId,
    });
  };

  const handleNewForm = async (projectId: string) => {
    const name = prompt('새 폼 이름:');
    if (!name) return;
    try {
      const { data: form } = await apiService.createForm({ name, projectId });
      await loadProjects();
      onFormSelect(form._id);
    } catch (error) {
      console.error('Failed to create form:', error);
    }
  };

  const startRename = (formId: string, currentName: string) => {
    setRenamingFormId(formId);
    setRenamingValue(currentName);
  };

  const cancelRename = () => {
    setRenamingFormId(null);
    setRenamingValue('');
  };

  const commitRename = async () => {
    const formId = renamingFormId;
    const newName = renamingValue.trim();
    cancelRename();
    if (!formId || !newName) return;
    try {
      await apiService.saveForm(formId, { name: newName });
      await loadProjects();
      if (currentFormId === formId) {
        const { data } = await apiService.loadForm(formId);
        const state = useDesignerStore.getState();
        state.loadForm(formId, data.controls, data.properties, data.eventHandlers);
      }
    } catch (error) {
      console.error('Failed to rename form:', error);
    }
  };

  const handleDeleteForm = async (formId: string, formName: string) => {
    if (!confirm(`"${formName}" 폼을 삭제하시겠습니까?`)) return;
    try {
      await apiService.deleteForm(formId);
      await loadProjects();
    } catch (error) {
      console.error('Failed to delete form:', error);
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`"${projectName}" 프로젝트와 하위 폼을 모두 삭제하시겠습니까?`)) return;
    try {
      await apiService.deleteProject(projectId);
      await loadProjects();
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const handleExportProject = async (projectId: string) => {
    try {
      const exportData = await apiService.exportProject(projectId);
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportData.project.name}.webform.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export project:', error);
    }
  };

  const handlePublishAll = async (projectId: string) => {
    try {
      const { data: result } = await apiService.publishAll(projectId);
      const { forms, shell } = result;

      // 트리 새로고침 (폼 status 변경 반영)
      await loadProjects();

      // App.tsx에 알림 (formStatus 업데이트 등)
      onPublishAll?.(projectId);

      // 결과 메시지
      let msg = `${forms.publishedCount}개 폼 퍼블리시 완료`;
      if (forms.skippedCount > 0) {
        msg += ` (${forms.skippedCount}개 스킵)`;
      }
      if (shell.published) {
        msg += '\nShell 퍼블리시 완료';
      }
      alert(msg);
    } catch (error) {
      console.error('Failed to publish all:', error);
      alert('전체 퍼블리시에 실패했습니다.');
    }
  };

  const handleNewProject = async () => {
    const name = prompt('새 프로젝트 이름:');
    if (!name) return;
    try {
      await apiService.createProject({ name });
      await loadProjects();
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleOpenFontDialog = (projectId: string, projectName: string) => {
    setFontValue({
      family: 'Segoe UI', size: 9, bold: false, italic: false, underline: false, strikethrough: false,
    });
    setFontDialog({ projectId, projectName });
  };

  const handleApplyProjectFont = async () => {
    if (!fontDialog) return;
    const confirmation = prompt(
      '이 작업은 프로젝트 내 모든 폼과 모든 컨트롤의 폰트를 변경합니다.\n계속하려면 "confirm"을 입력하세요.',
    );
    if (confirmation !== 'confirm') return;
    setFontApplying(true);
    try {
      const result = await apiService.applyProjectFont(fontDialog.projectId, fontValue);
      alert(`${result.modifiedCount}개 폼의 모든 요소에 폰트가 적용되었습니다.`);
      // 현재 열린 폼이 이 프로젝트에 속하면 서버에서 다시 로드
      const state = useDesignerStore.getState();
      if (state.currentFormId && state.currentProjectId === fontDialog.projectId) {
        const { data } = await apiService.loadForm(state.currentFormId);
        state.loadForm(state.currentFormId, data.controls, data.properties, data.eventHandlers);
      }
      setFontDialog(null);
    } catch (error) {
      console.error('Failed to apply project font:', error);
      alert('폰트 적용에 실패했습니다.');
    } finally {
      setFontApplying(false);
    }
  };

  const handleOpenDefaultFontDialog = async (projectId: string, projectName: string) => {
    try {
      const { data } = await apiService.getProject(projectId);
      if (data.project.defaultFont) {
        setDefaultFontValue(data.project.defaultFont);
      } else {
        setDefaultFontValue({
          family: 'Segoe UI', size: 9, bold: false, italic: false, underline: false, strikethrough: false,
        });
      }
    } catch {
      setDefaultFontValue({
        family: 'Segoe UI', size: 9, bold: false, italic: false, underline: false, strikethrough: false,
      });
    }
    setDefaultFontDialog({ projectId, projectName });
  };

  const handleSaveDefaultFont = async () => {
    if (!defaultFontDialog) return;
    setDefaultFontSaving(true);
    try {
      await apiService.updateProject(defaultFontDialog.projectId, { defaultFont: defaultFontValue });
      // 현재 프로젝트면 스토어 동기화
      const state = useDesignerStore.getState();
      if (state.currentProjectId === defaultFontDialog.projectId) {
        state.setProjectDefaultFont(defaultFontValue);
      }
      setDefaultFontDialog(null);
    } catch (error) {
      console.error('Failed to save default font:', error);
      alert('기본 폰트 저장에 실패했습니다.');
    } finally {
      setDefaultFontSaving(false);
    }
  };

  const handleResetDefaultFont = async () => {
    if (!defaultFontDialog) return;
    setDefaultFontSaving(true);
    try {
      await apiService.updateProject(defaultFontDialog.projectId, { defaultFont: null });
      const state = useDesignerStore.getState();
      if (state.currentProjectId === defaultFontDialog.projectId) {
        state.setProjectDefaultFont(null);
      }
      setDefaultFontDialog(null);
    } catch (error) {
      console.error('Failed to reset default font:', error);
      alert('기본 폰트 초기화에 실패했습니다.');
    } finally {
      setDefaultFontSaving(false);
    }
  };

  const handleImportProject = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await apiService.importProject(data);
        await loadProjects();
      } catch (error) {
        console.error('Failed to import project:', error);
      }
    };
    input.click();
  };

  const handleShellSelect = async (projectId: string) => {
    const store = useDesignerStore.getState();
    try {
      let result = await apiService.getShell(projectId);

      // Shell이 없으면 기본값으로 생성
      if (!result?.data) {
        result = await apiService.createShell(projectId, {
          name: 'Application Shell',
        });
      }

      const shell = result?.data;
      if (!shell) return;
      store.setCurrentProject(projectId);
      store.loadShell({
        id: shell._id,
        projectId: shell.projectId,
        name: shell.name,
        version: shell.version,
        properties: shell.properties,
        controls: shell.controls,
        eventHandlers: shell.eventHandlers,
      });
    } catch (error) {
      console.error('Failed to load shell:', error);
    }
  };

  const getContextMenuItems = () => {
    if (!contextMenu) return [];
    switch (contextMenu.targetType) {
      case 'project': {
        const proj = projects.find((p) => p.project._id === contextMenu.projectId);
        const projName = proj?.project.name ?? '';
        return [
          { label: '새 폼', action: () => handleNewForm(contextMenu.projectId) },
          { label: 'Publish All', action: () => handlePublishAll(contextMenu.projectId) },
          { label: '기본 폰트 설정', action: () => handleOpenDefaultFontDialog(contextMenu.projectId, projName) },
          { label: '폰트 일괄 적용', action: () => handleOpenFontDialog(contextMenu.projectId, projName) },
          { label: '내보내기', action: () => handleExportProject(contextMenu.projectId) },
          { label: '삭제', action: () => handleDeleteProject(contextMenu.projectId, projName) },
        ];
      }
      case 'folder':
        return [
          { label: '새 폼', action: () => handleNewForm(contextMenu.projectId) },
        ];
      case 'form': {
        const targetForm = projects
          .flatMap((p) => p.forms)
          .find((f) => f._id === contextMenu.targetId);
        return [
          { label: '열기', action: () => onFormSelect(contextMenu.targetId) },
          {
            label: '이름 변경',
            action: () => startRename(contextMenu.targetId, targetForm?.name ?? ''),
          },
          { label: '삭제', action: () => handleDeleteForm(contextMenu.targetId, targetForm?.name ?? '') },
        ];
      }
      default:
        return [];
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'F2' && selectedNode?.startsWith('form-') && !renamingFormId) {
          e.preventDefault();
          const formId = selectedNode.replace('form-', '');
          const form = projects.flatMap((p) => p.forms).find((f) => f._id === formId);
          if (form) startRename(formId, form.name);
        }
      }}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', outline: 'none' }}
    >
      {/* 툴바 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          borderBottom: '1px solid #ddd',
          backgroundColor: '#e8e8e8',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        <span>프로젝트 탐색기</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleNewProject}
            title="새 프로젝트"
            aria-label="새 프로젝트"
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 14,
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            +
          </button>
          <button
            onClick={handleImportProject}
            title="가져오기"
            aria-label="가져오기"
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 12,
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            ↓
          </button>
          <button
            onClick={loadProjects}
            title="새로고침"
            aria-label="새로고침"
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 12,
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            ⟳
          </button>
        </div>
      </div>

      {/* 트리뷰 */}
      <div role="tree" aria-label="프로젝트 탐색기" style={{ flex: 1, overflow: 'auto', fontSize: 12 }}>
        {loading && <div style={{ padding: 8, color: '#888' }}>로딩 중...</div>}

        {!loading && projects.length === 0 && (
          <div style={{ padding: 8, color: '#888' }}>프로젝트가 없습니다</div>
        )}

        {projects.map(({ project, forms }) => {
          const projectNodeId = `project-${project._id}`;
          const formsNodeId = `forms-${project._id}`;
          const isProjectExpanded = expandedNodes.has(projectNodeId);
          const isFormsExpanded = expandedNodes.has(formsNodeId);

          return (
            <div key={project._id}>
              {/* 프로젝트 노드 */}
              <div
                role="treeitem"
                aria-expanded={isProjectExpanded}
                aria-selected={selectedNode === projectNodeId}
                tabIndex={0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  backgroundColor: selectedNode === projectNodeId ? '#cce5ff' : 'transparent',
                  userSelect: 'none',
                }}
                onClick={() => {
                  toggleNode(projectNodeId);
                  setSelectedNode(projectNodeId);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleNode(projectNodeId);
                    setSelectedNode(projectNodeId);
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, 'project', project._id, project._id)}
              >
                <span style={{ marginRight: 4, fontSize: 10 }}>
                  {isProjectExpanded ? '▼' : '▶'}
                </span>
                <span style={{ marginRight: 4 }}>📁</span>
                <span style={{ fontWeight: 600 }}>{project.name}</span>
              </div>

              {isProjectExpanded && (
                <>
                  {/* Shell 노드 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px 8px 2px 24px',
                      cursor: 'pointer',
                      backgroundColor:
                        editMode === 'shell' && currentShellId
                          ? '#b3d9ff'
                          : selectedNode === `shell-${project._id}`
                            ? '#cce5ff'
                            : 'transparent',
                      userSelect: 'none',
                    }}
                    onClick={() => setSelectedNode(`shell-${project._id}`)}
                    onDoubleClick={() => handleShellSelect(project._id)}
                  >
                    <span style={{ marginRight: 4 }}>🖥️</span>
                    <span>Application Shell</span>
                  </div>

                  {/* Forms 폴더 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px 8px 2px 24px',
                      cursor: 'pointer',
                      backgroundColor: selectedNode === formsNodeId ? '#cce5ff' : 'transparent',
                      userSelect: 'none',
                    }}
                    onClick={() => {
                      toggleNode(formsNodeId);
                      setSelectedNode(formsNodeId);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, 'folder', formsNodeId, project._id)}
                  >
                    <span style={{ marginRight: 4, fontSize: 10 }}>
                      {isFormsExpanded ? '▼' : '▶'}
                    </span>
                    <span style={{ marginRight: 4 }}>📂</span>
                    <span>Forms</span>
                    <span style={{ marginLeft: 4, color: '#888', fontSize: 10 }}>
                      ({forms.length})
                    </span>
                  </div>

                  {isFormsExpanded &&
                    forms.map((form) => {
                      const formNodeId = `form-${form._id}`;
                      const isActive = currentFormId === form._id;

                      return (
                        <div
                          key={form._id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '2px 8px 2px 48px',
                            cursor: 'pointer',
                            backgroundColor: isActive
                              ? '#b3d9ff'
                              : selectedNode === formNodeId
                                ? '#cce5ff'
                                : 'transparent',
                            userSelect: 'none',
                          }}
                          onClick={() => onFormSelect(form._id)}
                          onContextMenu={(e) => handleContextMenu(e, 'form', form._id, project._id)}
                        >
                          <span
                            style={{
                              marginRight: 4,
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: form.status === 'published' ? '#28a745' : '#999',
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                          {renamingFormId === form._id ? (
                            <input
                              value={renamingValue}
                              onChange={(e) => setRenamingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  commitRename();
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  cancelRename();
                                }
                                e.stopPropagation();
                              }}
                              onBlur={() => commitRename()}
                              autoFocus
                              onFocus={(e) => e.target.select()}
                              onClick={(e) => e.stopPropagation()}
                              onDoubleClick={(e) => e.stopPropagation()}
                              style={{
                                fontSize: 12,
                                padding: '0 2px',
                                border: '1px solid #0078d4',
                                outline: 'none',
                                width: '100%',
                                minWidth: 60,
                              }}
                            />
                          ) : (
                            <span>{form.name}</span>
                          )}
                        </div>
                      );
                    })}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 컨텍스트 메뉴 */}
      {contextMenu?.visible && (
        <div
          role="menu"
          aria-label="컨텍스트 메뉴"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            boxShadow: '2px 2px 6px rgba(0,0,0,0.15)',
            zIndex: 10000,
            minWidth: 120,
            fontSize: 12,
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setContextMenu(null);
          }}
        >
          {getContextMenuItems().map((item) => (
            <div
              key={item.label}
              role="menuitem"
              tabIndex={0}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = '#e8e8e8';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = 'transparent';
              }}
              onClick={() => {
                item.action();
                setContextMenu(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  item.action();
                  setContextMenu(null);
                }
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}

      {/* 기본 폰트 설정 다이얼로그 */}
      {defaultFontDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20000,
          }}
          onClick={() => setDefaultFontDialog(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setDefaultFontDialog(null); }}
        >
          <div
            ref={defaultFontDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="default-font-dialog-title"
            style={{
              backgroundColor: '#fff',
              border: '1px solid #999',
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
              width: 320,
              borderRadius: 4,
              fontFamily: 'Segoe UI, sans-serif',
              fontSize: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '8px 12px',
              borderBottom: '1px solid #ddd',
              fontWeight: 600,
              fontSize: 13,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span id="default-font-dialog-title">기본 폰트 설정</span>
              <button
                type="button"
                onClick={() => setDefaultFontDialog(null)}
                aria-label="닫기"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: '#666' }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '12px' }}>
              <div style={{ marginBottom: 8, color: '#555' }}>
                <strong>{defaultFontDialog.projectName}</strong> 프로젝트에서 새로 생성되는 폼과 컨트롤에 적용될 기본 폰트를 설정합니다.
              </div>
              <FontPicker value={defaultFontValue} onChange={setDefaultFontValue} />
            </div>

            <div style={{
              padding: '8px 12px',
              borderTop: '1px solid #ddd',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
            }}>
              <button
                type="button"
                onClick={handleResetDefaultFont}
                disabled={defaultFontSaving}
                style={{ padding: '4px 16px', border: '1px solid #d32f2f', borderRadius: 2, backgroundColor: '#fff', color: '#d32f2f', fontSize: 12, cursor: 'pointer', marginRight: 'auto' }}
              >
                초기화
              </button>
              <button
                type="button"
                onClick={() => setDefaultFontDialog(null)}
                style={{ padding: '4px 16px', border: '1px solid #bbb', borderRadius: 2, backgroundColor: '#fff', fontSize: 12, cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveDefaultFont}
                disabled={defaultFontSaving}
                style={{ padding: '4px 16px', border: '1px solid #0078d4', borderRadius: 2, backgroundColor: '#0078d4', color: '#fff', fontSize: 12, cursor: 'pointer' }}
              >
                {defaultFontSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 폰트 일괄 적용 다이얼로그 */}
      {fontDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20000,
          }}
          onClick={() => setFontDialog(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setFontDialog(null); }}
        >
          <div
            ref={fontDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="font-batch-dialog-title"
            style={{
              backgroundColor: '#fff',
              border: '1px solid #999',
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
              width: 320,
              borderRadius: 4,
              fontFamily: 'Segoe UI, sans-serif',
              fontSize: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 다이얼로그 헤더 */}
            <div style={{
              padding: '8px 12px',
              borderBottom: '1px solid #ddd',
              fontWeight: 600,
              fontSize: 13,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span id="font-batch-dialog-title">폰트 일괄 적용</span>
              <button
                type="button"
                onClick={() => setFontDialog(null)}
                aria-label="닫기"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: '#666' }}
              >
                ×
              </button>
            </div>

            {/* 다이얼로그 본문 */}
            <div style={{ padding: '12px' }}>
              <div style={{ marginBottom: 8, color: '#555' }}>
                <strong>{fontDialog.projectName}</strong> 프로젝트의 모든 폼에 아래 폰트를 일괄 적용합니다.
              </div>
              <FontPicker value={fontValue} onChange={setFontValue} />
              <div style={{ marginTop: 8, padding: '6px 8px', backgroundColor: '#fff8e1', border: '1px solid #ffe082', borderRadius: 3, fontSize: 11, color: '#795548' }}>
                이 작업은 프로젝트 내 모든 폼과 모든 컨트롤의 폰트를 일괄 변경합니다.
              </div>
            </div>

            {/* 다이얼로그 푸터 */}
            <div style={{
              padding: '8px 12px',
              borderTop: '1px solid #ddd',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
            }}>
              <button
                type="button"
                onClick={() => setFontDialog(null)}
                style={{ padding: '4px 16px', border: '1px solid #bbb', borderRadius: 2, backgroundColor: '#fff', fontSize: 12, cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleApplyProjectFont}
                disabled={fontApplying}
                style={{ padding: '4px 16px', border: '1px solid #0078d4', borderRadius: 2, backgroundColor: '#0078d4', color: '#fff', fontSize: 12, cursor: 'pointer' }}
              >
                {fontApplying ? '적용 중...' : '적용'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
