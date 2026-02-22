import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ProjectExplorer } from '../components/ProjectExplorer/ProjectExplorer';

// apiService 모킹
vi.mock('../../src/services/apiService', () => ({
  apiService: {
    listProjects: vi.fn(),
    getProject: vi.fn(),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
    exportProject: vi.fn(),
    importProject: vi.fn(),
    createForm: vi.fn(),
    deleteForm: vi.fn(),
  },
}));

// designerStore 모킹
vi.mock('../../src/stores/designerStore', () => ({
  useDesignerStore: vi.fn((selector) => {
    const state = { currentFormId: null };
    return selector ? selector(state) : state;
  }),
}));

import { apiService } from '../services/apiService';

const mockListProjects = vi.mocked(apiService.listProjects);
const mockGetProject = vi.mocked(apiService.getProject);

const sampleProjects = [
  {
    _id: 'proj-1',
    name: 'Project Alpha',
    description: '',
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    _id: 'proj-2',
    name: 'Project Beta',
    description: '두번째 프로젝트',
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: '2025-01-02',
    updatedAt: '2025-01-02',
  },
];

const sampleForms = {
  'proj-1': [
    { _id: 'form-1', name: 'Login Form', version: 1, status: 'published' as const, updatedAt: '2025-01-01' },
    { _id: 'form-2', name: 'Dashboard Form', version: 2, status: 'draft' as const, updatedAt: '2025-01-01' },
  ],
  'proj-2': [
    { _id: 'form-3', name: 'Settings Form', version: 1, status: 'draft' as const, updatedAt: '2025-01-02' },
  ],
};

function setupMocks() {
  mockListProjects.mockResolvedValue({
    data: sampleProjects,
    meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
  });

  mockGetProject.mockImplementation(async (id: string) => ({
    data: {
      project: sampleProjects.find((p) => p._id === id)!,
      forms: sampleForms[id as keyof typeof sampleForms] ?? [],
    },
  }));
}

describe('ProjectExplorer', () => {
  const onFormSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('프로젝트 목록을 렌더링해야 한다', async () => {
    render(<ProjectExplorer onFormSelect={onFormSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
    });
  });

  it('프로젝트를 클릭하면 하위 Forms 폴더가 표시되어야 한다', async () => {
    render(<ProjectExplorer onFormSelect={onFormSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });

    // 프로젝트 노드 클릭하여 펼침
    fireEvent.click(screen.getByText('Project Alpha'));

    await waitFor(() => {
      expect(screen.getByText('Forms')).toBeInTheDocument();
    });
  });

  it('폼 더블클릭 시 onFormSelect가 호출되어야 한다', async () => {
    render(<ProjectExplorer onFormSelect={onFormSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });

    // 프로젝트 펼침
    fireEvent.click(screen.getByText('Project Alpha'));

    await waitFor(() => {
      expect(screen.getByText('Forms')).toBeInTheDocument();
    });

    // Forms 폴더 펼침
    fireEvent.click(screen.getByText('Forms'));

    await waitFor(() => {
      expect(screen.getByText('Login Form')).toBeInTheDocument();
    });

    // 폼 더블클릭
    fireEvent.doubleClick(screen.getByText('Login Form'));

    expect(onFormSelect).toHaveBeenCalledWith('form-1');
  });
});
