import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MenuItemEditor } from '../components/Editors/MenuItemEditor';

let uuidCounter = 0;
beforeEach(() => {
  uuidCounter = 0;
  vi.spyOn(crypto, 'randomUUID').mockImplementation(
    () => `test-uuid-${++uuidCounter}` as `${string}-${string}-${string}-${string}-${string}`,
  );
});

function openModal() {
  fireEvent.click(screen.getByRole('button', { name: /Menu Items/i }));
}

describe('MenuItemEditor', () => {
  it('기본 렌더링: 트리거 버튼에 아이템 개수가 표시된다', () => {
    const items = [{ text: 'File' }, { text: 'Edit' }];
    render(<MenuItemEditor value={items} onChange={vi.fn()} />);

    expect(screen.getByText('(Menu Items) [2]')).toBeInTheDocument();
  });

  it('빈 배열일 때 아이템 개수 0으로 표시된다', () => {
    render(<MenuItemEditor value={[]} onChange={vi.fn()} />);

    expect(screen.getByText('(Menu Items) [0]')).toBeInTheDocument();
  });

  it('아이템 추가(Add): 빈 목록에서 Add 클릭 시 새 아이템이 추가된다', () => {
    render(<MenuItemEditor value={[]} onChange={vi.fn()} />);
    openModal();

    expect(screen.getByText('No items')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('New Item')).toBeInTheDocument();
    expect(screen.queryByText('No items')).not.toBeInTheDocument();
  });

  it('아이템 추가(Add): 기존 아이템 선택 상태에서 Add 시 같은 레벨에 추가된다', () => {
    const items = [{ text: 'File' }];
    render(<MenuItemEditor value={items} onChange={vi.fn()} />);
    openModal();

    // 첫 번째 아이템 선택
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('New Item')).toBeInTheDocument();
  });

  it('아이템 삭제(Delete): 선택된 아이템이 삭제된다', () => {
    const items = [{ text: 'File' }, { text: 'Edit' }];
    render(<MenuItemEditor value={items} onChange={vi.fn()} />);
    openModal();

    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();

    // File 선택 후 삭제
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.queryByText('File')).not.toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('아이템 선택 시 속성 패널에 속성 필드들이 표시된다', () => {
    const items = [{ text: 'File', shortcut: 'Ctrl+F', enabled: true, checked: false }];
    render(<MenuItemEditor value={items} onChange={vi.fn()} />);
    openModal();

    // 선택 전에는 "Select an item" 표시
    expect(screen.getByText('Select an item')).toBeInTheDocument();

    // 아이템 선택
    fireEvent.click(screen.getByText('File'));

    // 속성 필드들이 표시됨
    expect(screen.queryByText('Select an item')).not.toBeInTheDocument();
    expect(screen.getByText('text')).toBeInTheDocument();
    expect(screen.getByText('shortcut')).toBeInTheDocument();
    expect(screen.getByText('enabled')).toBeInTheDocument();
    expect(screen.getByText('checked')).toBeInTheDocument();
    expect(screen.getByText('separator')).toBeInTheDocument();

    // text 필드에 값이 채워져 있음
    const textInputs = screen.getAllByRole('textbox');
    expect(textInputs[0]).toHaveValue('File');
    expect(textInputs[1]).toHaveValue('Ctrl+F');
  });

  it('속성 변경 시 모달 내부 상태가 즉시 반영된다', () => {
    const items = [{ text: 'File' }];
    render(<MenuItemEditor value={items} onChange={vi.fn()} />);
    openModal();

    fireEvent.click(screen.getByText('File'));

    const textInputs = screen.getAllByRole('textbox');
    fireEvent.change(textInputs[0], { target: { value: 'View' } });

    // 트리뷰에 변경된 텍스트가 즉시 반영됨
    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.queryByText('File')).not.toBeInTheDocument();
  });

  it('OK 클릭 시 onChange가 최종 items로 호출된다', () => {
    const onChange = vi.fn();
    const items = [{ text: 'File' }];
    render(<MenuItemEditor value={items} onChange={onChange} />);
    openModal();

    // Add로 아이템 추가
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const result = onChange.mock.calls[0][0];
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ text: 'File' });
    expect(result[1]).toEqual({ text: 'New Item' });
  });

  it('OK 클릭 시 속성 변경이 반영된 결과가 반환된다', () => {
    const onChange = vi.fn();
    const items = [{ text: 'File' }];
    render(<MenuItemEditor value={items} onChange={onChange} />);
    openModal();

    // 아이템 선택 후 텍스트 변경
    fireEvent.click(screen.getByText('File'));
    const textInputs = screen.getAllByRole('textbox');
    fireEvent.change(textInputs[0], { target: { value: 'View' } });

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0]).toEqual({ text: 'View' });
  });

  it('Cancel 클릭 시 onChange가 호출되지 않는다', () => {
    const onChange = vi.fn();
    const items = [{ text: 'File' }];
    render(<MenuItemEditor value={items} onChange={onChange} />);
    openModal();

    // Add로 아이템 추가해도
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    // Cancel 시 onChange 미호출
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('Cancel 클릭 시 모달이 닫힌다', () => {
    render(<MenuItemEditor value={[]} onChange={vi.fn()} />);
    openModal();

    expect(screen.getByText('Menu Items Editor')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Menu Items Editor')).not.toBeInTheDocument();
  });
});
