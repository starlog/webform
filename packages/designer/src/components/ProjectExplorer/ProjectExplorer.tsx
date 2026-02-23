import { useState, useEffect, useCallback, useRef } from 'react';
import type { FontDefinition } from '@webform/common';
import { apiService } from '../../services/apiService';
import type { ProjectDocument, FormSummary } from '../../services/apiService';
import { useDesignerStore } from '../../stores/designerStore';
import { FontPicker } from '../PropertyPanel/editors/FontPicker';

interface ProjectExplorerProps {
  onFormSelect: (formId: string) => void;
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

export function ProjectExplorer({ onFormSelect, refreshKey }: ProjectExplorerProps) {
  const [projects, setProjects] = useState<ProjectWithForms[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentFormId = useDesignerStore((s) => s.currentFormId);

  // 프로젝트 폰트 설정 다이얼로그
  const [fontDialog, setFontDialog] = useState<{ projectId: string; projectName: string } | null>(null);
  const [fontValue, setFontValue] = useState<FontDefinition>({
    family: 'Segoe UI', size: 9, bold: false, italic: false, underline: false, strikethrough: false,
  });
  const [fontApplying, setFontApplying] = useState(false);

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

  const handleDeleteForm = async (formId: string) => {
    if (!confirm('이 폼을 삭제하시겠습니까?')) return;
    try {
      await apiService.deleteForm(formId);
      await loadProjects();
    } catch (error) {
      console.error('Failed to delete form:', error);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('이 프로젝트와 하위 폼을 모두 삭제하시겠습니까?')) return;
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
        state.loadForm(state.currentFormId, data.controls, data.properties);
      }
      setFontDialog(null);
    } catch (error) {
      console.error('Failed to apply project font:', error);
      alert('폰트 적용에 실패했습니다.');
    } finally {
      setFontApplying(false);
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

  const getContextMenuItems = () => {
    if (!contextMenu) return [];
    switch (contextMenu.targetType) {
      case 'project': {
        const proj = projects.find((p) => p.project._id === contextMenu.projectId);
        const projName = proj?.project.name ?? '';
        return [
          { label: '새 폼', action: () => handleNewForm(contextMenu.projectId) },
          { label: '프로젝트 폰트 설정', action: () => handleOpenFontDialog(contextMenu.projectId, projName) },
          { label: '내보내기', action: () => handleExportProject(contextMenu.projectId) },
          { label: '삭제', action: () => handleDeleteProject(contextMenu.projectId) },
        ];
      }
      case 'folder':
        return [
          { label: '새 폼', action: () => handleNewForm(contextMenu.projectId) },
        ];
      case 'form':
        return [
          { label: '열기', action: () => onFormSelect(contextMenu.targetId) },
          { label: '삭제', action: () => handleDeleteForm(contextMenu.targetId) },
        ];
      default:
        return [];
    }
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
      <div style={{ flex: 1, overflow: 'auto', fontSize: 12 }}>
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
                          onClick={() => setSelectedNode(formNodeId)}
                          onDoubleClick={() => onFormSelect(form._id)}
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
                          <span>{form.name}</span>
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
        >
          {getContextMenuItems().map((item) => (
            <div
              key={item.label}
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
            >
              {item.label}
            </div>
          ))}
        </div>
      )}

      {/* 프로젝트 폰트 설정 다이얼로그 */}
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
        >
          <div
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
              <span>프로젝트 폰트 설정</span>
              <button
                type="button"
                onClick={() => setFontDialog(null)}
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
