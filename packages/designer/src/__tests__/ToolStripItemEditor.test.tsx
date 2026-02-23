import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolStripItemEditor } from '../components/Editors/ToolStripItemEditor';

let uuidCounter = 0;
beforeEach(() => {
  uuidCounter = 0;
  vi.spyOn(crypto, 'randomUUID').mockImplementation(
    () => `test-uuid-${++uuidCounter}` as `${string}-${string}-${string}-${string}-${string}`,
  );
});

function openModal() {
  fireEvent.click(screen.getByRole('button', { name: /ToolStrip Items/i }));
}

describe('ToolStripItemEditor', () => {
  it('기본 렌더링: 트리거 버튼에 아이템 개수가 표시된다', () => {
    const items = [{ type: 'button', text: 'Save' }, { type: 'separator' }];
    render(<ToolStripItemEditor value={items} onChange={vi.fn()} />);

    expect(screen.getByText('(ToolStrip Items) [2]')).toBeInTheDocument();
  });

  it('빈 배열일 때 모달에 No items가 표시된다', () => {
    render(<ToolStripItemEditor value={[]} onChange={vi.fn()} />);
    openModal();

    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  it('모달 제목이 올바르게 표시된다', () => {
    render(<ToolStripItemEditor value={[]} onChange={vi.fn()} />);
    openModal();

    expect(screen.getByText('ToolStrip Items Editor')).toBeInTheDocument();
  });

  it('아이템 추가(Add): 새 button 타입 아이템이 추가된다', () => {
    render(<ToolStripItemEditor value={[]} onChange={vi.fn()} />);
    openModal();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('[button] Button')).toBeInTheDocument();
    expect(screen.queryByText('No items')).not.toBeInTheDocument();
  });

  it('아이템 타입 변경: button → separator로 변경하면 리스트 레이블이 바뀐다', () => {
    const items = [{ type: 'button', text: 'Save' }];
    render(<ToolStripItemEditor value={items} onChange={vi.fn()} />);
    openModal();

    // 아이템 선택
    fireEvent.click(screen.getByText('[button] Save'));

    // type을 separator로 변경
    const typeSelect = screen.getByRole('combobox');
    fireEvent.change(typeSelect, { target: { value: 'separator' } });

    expect(screen.getByText('── (Separator) ──')).toBeInTheDocument();
  });

  it('아이템 타입 변경: label로 변경 시 레이블 형식이 변경된다', () => {
    const items = [{ type: 'button', text: 'Save' }];
    render(<ToolStripItemEditor value={items} onChange={vi.fn()} />);
    openModal();

    fireEvent.click(screen.getByText('[button] Save'));

    const typeSelect = screen.getByRole('combobox');
    fireEvent.change(typeSelect, { target: { value: 'label' } });

    expect(screen.getByText('[label] Save')).toBeInTheDocument();
  });

  it('순서 변경(Up): 두 번째 아이템을 위로 이동한다', () => {
    const items = [
      { type: 'button', text: 'Open' },
      { type: 'button', text: 'Save' },
    ];
    const onChange = vi.fn();
    render(<ToolStripItemEditor value={items} onChange={onChange} />);
    openModal();

    // 두 번째 아이템(Save) 선택
    fireEvent.click(screen.getByText('[button] Save'));

    // Up 클릭
    fireEvent.click(screen.getByRole('button', { name: 'Up' }));

    // OK로 결과 확인
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const result = onChange.mock.calls[0][0];
    expect(result[0].text).toBe('Save');
    expect(result[1].text).toBe('Open');
  });

  it('순서 변경(Down): 첫 번째 아이템을 아래로 이동한다', () => {
    const items = [
      { type: 'button', text: 'Open' },
      { type: 'button', text: 'Save' },
    ];
    const onChange = vi.fn();
    render(<ToolStripItemEditor value={items} onChange={onChange} />);
    openModal();

    // 첫 번째 아이템(Open) 선택
    fireEvent.click(screen.getByText('[button] Open'));

    // Down 클릭
    fireEvent.click(screen.getByRole('button', { name: 'Down' }));

    // OK로 결과 확인
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const result = onChange.mock.calls[0][0];
    expect(result[0].text).toBe('Save');
    expect(result[1].text).toBe('Open');
  });

  it('OK 클릭 시 타입 변경이 반영된 결과가 반환된다', () => {
    const onChange = vi.fn();
    const items = [{ type: 'button', text: 'Save' }];
    render(<ToolStripItemEditor value={items} onChange={onChange} />);
    openModal();

    fireEvent.click(screen.getByText('[button] Save'));

    const typeSelect = screen.getByRole('combobox');
    fireEvent.change(typeSelect, { target: { value: 'separator' } });

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const result = onChange.mock.calls[0][0];
    expect(result[0].type).toBe('separator');
  });

  it('Cancel 클릭 시 onChange가 호출되지 않는다', () => {
    const onChange = vi.fn();
    render(<ToolStripItemEditor value={[]} onChange={onChange} />);
    openModal();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
