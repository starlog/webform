import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataGridView } from '../controls/DataGridView';
import { useBindingStore } from '../bindings/bindingStore';

describe('DataGridView', () => {
  beforeEach(() => {
    useBindingStore.getState().reset();
  });

  describe('데이터 렌더링', () => {
    it('데이터 배열 → 행 렌더링 확인', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
        { name: 'Charlie', age: 35 },
      ];

      render(<DataGridView id="grid1" name="grid1" dataSource={data} />);

      // 데이터 행 확인
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('35')).toBeInTheDocument();
    });

    it('컬럼 정의가 없으면 데이터 키에서 자동 생성한다', () => {
      const data = [{ name: 'Alice', email: 'alice@test.com' }];

      render(<DataGridView id="grid1" name="grid1" dataSource={data} />);

      // 자동 생성된 헤더 확인
      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('email')).toBeInTheDocument();
    });

    it('내부 필드(_id, __v, createdAt, updatedAt)는 필터링한다', () => {
      const data = [{ name: 'Alice', _id: '123', __v: 0, createdAt: '2024-01-01', updatedAt: '2024-01-01' }];

      render(<DataGridView id="grid1" name="grid1" dataSource={data} />);

      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.queryByText('_id')).not.toBeInTheDocument();
      expect(screen.queryByText('__v')).not.toBeInTheDocument();
    });
  });

  describe('정렬', () => {
    it('컬럼 헤더 클릭 → 정렬 전환', () => {
      const data = [
        { name: 'Charlie', age: 35 },
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];

      render(
        <DataGridView
          id="grid1"
          name="grid1"
          dataSource={data}
          columns={[
            { field: 'name', headerText: 'Name', sortable: true },
            { field: 'age', headerText: 'Age', sortable: true },
          ]}
        />,
      );

      const nameHeader = screen.getByText('Name');

      // 첫 클릭: asc 정렬
      fireEvent.click(nameHeader);
      const rows1 = screen.getAllByRole('listitem');
      expect(rows1[0]).toHaveTextContent('Alice');
      expect(rows1[1]).toHaveTextContent('Bob');
      expect(rows1[2]).toHaveTextContent('Charlie');

      // 두번째 클릭: desc 정렬
      fireEvent.click(nameHeader);
      const rows2 = screen.getAllByRole('listitem');
      expect(rows2[0]).toHaveTextContent('Charlie');
      expect(rows2[1]).toHaveTextContent('Bob');
      expect(rows2[2]).toHaveTextContent('Alice');

      // 세번째 클릭: 정렬 해제 (원본 순서)
      fireEvent.click(nameHeader);
      const rows3 = screen.getAllByRole('listitem');
      expect(rows3[0]).toHaveTextContent('Charlie');
      expect(rows3[1]).toHaveTextContent('Alice');
      expect(rows3[2]).toHaveTextContent('Bob');
    });
  });

  describe('행 선택', () => {
    it('행 클릭 → setSelectedRow 호출', () => {
      const data = [
        { name: 'Alice' },
        { name: 'Bob' },
      ];
      const onSelectionChanged = vi.fn();

      render(
        <DataGridView
          id="grid1"
          name="grid1"
          dataSource={data}
          onSelectionChanged={onSelectionChanged}
        />,
      );

      // 두번째 행 클릭
      fireEvent.click(screen.getByText('Bob'));

      // onSelectionChanged 콜백 확인
      expect(onSelectionChanged).toHaveBeenCalledWith(1);

      // bindingStore의 selectedRows 확인
      const state = useBindingStore.getState();
      expect(state.selectedRows['grid1']).toBe(1);
    });
  });

  describe('빈 데이터 처리', () => {
    it('빈 데이터일 때 빈 상태 메시지를 표시한다', () => {
      render(<DataGridView id="grid1" name="grid1" dataSource={[]} />);

      expect(screen.getByText('데이터가 없습니다.')).toBeInTheDocument();
    });

    it('dataSource가 undefined일 때도 빈 상태 메시지를 표시한다', () => {
      render(<DataGridView id="grid1" name="grid1" />);

      expect(screen.getByText('데이터가 없습니다.')).toBeInTheDocument();
    });
  });
});
