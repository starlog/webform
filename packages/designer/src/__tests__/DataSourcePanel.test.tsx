import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DataSourcePanel } from '../components/DataSourcePanel/DataSourcePanel';

// ─── fetch 모킹 헬퍼 ────────────────────────────────

const DIALECTS_RESPONSE = {
  data: [
    { dialect: 'mongodb', displayName: 'MongoDB' },
    { dialect: 'postgresql', displayName: 'PostgreSQL' },
  ],
};

function mockFetchResponses() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      // 데이터소스 목록 (GET /api/datasources)
      if (url.includes('/datasources') && !url.includes('/dialects')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });
      }
      // dialect 목록 (GET /api/datasources/dialects)
      if (url.includes('/datasources/dialects')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(DIALECTS_RESPONSE),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({}),
      });
    }),
  );
}

// ─── 테스트 ──────────────────────────────────────────

describe('DataSourcePanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetchResponses();
  });

  it('데이터소스 type "database" 선택 시 dialect 드롭다운이 렌더링된다', async () => {
    render(<DataSourcePanel />);

    // "+" 버튼 클릭하여 모달 열기
    fireEvent.click(screen.getByText('+'));

    // 모달이 열리면 유형 셀렉트가 "database"로 기본 선택되어 있음
    const typeSelect = screen.getByDisplayValue('Database');
    expect(typeSelect).toBeInTheDocument();

    // dialect 목록이 로드되면 Dialect 라벨과 드롭다운이 표시됨
    await waitFor(() => {
      expect(screen.getByText('Dialect')).toBeInTheDocument();
    });

    // dialect 드롭다운에 MongoDB, PostgreSQL 옵션이 존재
    expect(screen.getByText('MongoDB')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
  });

  it('MongoDB dialect 선택 시 connectionString + database 필드가 표시된다', async () => {
    render(<DataSourcePanel />);

    // 모달 열기
    fireEvent.click(screen.getByText('+'));

    // dialect 로드 대기
    await waitFor(() => {
      expect(screen.getByText('Dialect')).toBeInTheDocument();
    });

    // MongoDB는 첫 번째 항목이므로 기본 선택됨
    // Connection String, Database 필드 확인
    expect(screen.getByText('Connection String')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('mongodb://localhost:27017')).toBeInTheDocument();

    // Database 필드 (mongodb에서 표시되는 것)
    const dbInputs = screen.getAllByPlaceholderText('mydb');
    expect(dbInputs.length).toBeGreaterThanOrEqual(1);

    // Host, Port, User, Password, SSL은 표시되지 않아야 함
    expect(screen.queryByText('Host')).not.toBeInTheDocument();
    expect(screen.queryByText('Port')).not.toBeInTheDocument();
    expect(screen.queryByText('User')).not.toBeInTheDocument();
    expect(screen.queryByText('Password')).not.toBeInTheDocument();
    expect(screen.queryByText('SSL')).not.toBeInTheDocument();
  });

  it('PostgreSQL dialect 선택 시 host/port/user/password/database/ssl 필드가 표시된다', async () => {
    render(<DataSourcePanel />);

    // 모달 열기
    fireEvent.click(screen.getByText('+'));

    // dialect 로드 대기
    await waitFor(() => {
      expect(screen.getByText('Dialect')).toBeInTheDocument();
    });

    // dialect를 PostgreSQL로 변경
    const dialectSelect = screen.getByDisplayValue('MongoDB');
    fireEvent.change(dialectSelect, { target: { value: 'postgresql' } });

    // PostgreSQL 필드 확인
    expect(screen.getByText('Host')).toBeInTheDocument();
    expect(screen.getByText('Port')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
    // "Database"는 <option>과 <label> 두 곳에 존재하므로 label만 확인
    expect(screen.getByPlaceholderText('mydb')).toBeInTheDocument();
    expect(screen.getByText('SSL')).toBeInTheDocument();

    // Port 기본값 5432 확인
    expect(screen.getByDisplayValue('5432')).toBeInTheDocument();

    // Connection String은 표시되지 않아야 함
    expect(screen.queryByText('Connection String')).not.toBeInTheDocument();
  });
});
