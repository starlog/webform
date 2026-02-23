import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusStripItemEditor } from '../components/Editors/StatusStripItemEditor';

let uuidCounter = 0;
beforeEach(() => {
  uuidCounter = 0;
  vi.spyOn(crypto, 'randomUUID').mockImplementation(
    () => `test-uuid-${++uuidCounter}` as `${string}-${string}-${string}-${string}-${string}`,
  );
});

function openModal() {
  fireEvent.click(screen.getByRole('button', { name: /StatusStrip Items/i }));
}

describe('StatusStripItemEditor', () => {
  it('기본 렌더링: 트리거 버튼에 아이템 개수가 표시된다', () => {
    const items = [{ type: 'label', text: 'Ready' }];
    render(<StatusStripItemEditor value={items} onChange={vi.fn()} />);

    expect(screen.getByText('(StatusStrip Items) [1]')).toBeInTheDocument();
  });

  it('빈 배열일 때 모달에 No items가 표시된다', () => {
    render(<StatusStripItemEditor value={[]} onChange={vi.fn()} />);
    openModal();

    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  it('모달 제목이 올바르게 표시된다', () => {
    render(<StatusStripItemEditor value={[]} onChange={vi.fn()} />);
    openModal();

    expect(screen.getByText('StatusStrip Items Editor')).toBeInTheDocument();
  });

  it('아이템 추가(Add): 새 label 타입 아이템이 추가된다', () => {
    render(<StatusStripItemEditor value={[]} onChange={vi.fn()} />);
    openModal();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('[label] Status')).toBeInTheDocument();
  });

  it('spring 속성 토글: spring 체크 시 width 필드가 사라진다', () => {
    const items = [{ type: 'label', text: 'Ready', spring: false, width: 100 }];
    render(<StatusStripItemEditor value={items} onChange={vi.fn()} />);
    openModal();

    // 아이템 선택
    fireEvent.click(screen.getByText('[label] Ready'));

    // spring이 false이면 width 필드가 보임
    expect(screen.getByText('width')).toBeInTheDocument();

    // spring 체크
    const springCheckbox = screen.getByRole('checkbox');
    fireEvent.click(springCheckbox);

    // width 필드가 사라짐
    expect(screen.queryByText('width')).not.toBeInTheDocument();
  });

  it('spring 토글 시 리스트 레이블에 (spring) 표시가 추가된다', () => {
    const items = [{ type: 'label', text: 'Ready', spring: false }];
    render(<StatusStripItemEditor value={items} onChange={vi.fn()} />);
    openModal();

    expect(screen.getByText('[label] Ready')).toBeInTheDocument();

    // 아이템 선택 후 spring 체크
    fireEvent.click(screen.getByText('[label] Ready'));
    const springCheckbox = screen.getByRole('checkbox');
    fireEvent.click(springCheckbox);

    expect(screen.getByText('[label] Ready (spring)')).toBeInTheDocument();
  });

  it('progressBar 타입일 때만 value 필드가 표시된다', () => {
    const items = [{ type: 'progressBar', text: 'Progress', value: 50 }];
    render(<StatusStripItemEditor value={items} onChange={vi.fn()} />);
    openModal();

    fireEvent.click(screen.getByText('[progressBar] Progress'));

    expect(screen.getByText('value')).toBeInTheDocument();
  });

  it('label 타입일 때 value 필드가 표시되지 않는다', () => {
    const items = [{ type: 'label', text: 'Ready' }];
    render(<StatusStripItemEditor value={items} onChange={vi.fn()} />);
    openModal();

    fireEvent.click(screen.getByText('[label] Ready'));

    expect(screen.queryByText('value')).not.toBeInTheDocument();
  });

  it('OK 클릭 시 spring 변경이 반영된 결과가 반환된다', () => {
    const onChange = vi.fn();
    const items = [{ type: 'label', text: 'Ready', spring: false }];
    render(<StatusStripItemEditor value={items} onChange={onChange} />);
    openModal();

    fireEvent.click(screen.getByText('[label] Ready'));
    const springCheckbox = screen.getByRole('checkbox');
    fireEvent.click(springCheckbox);

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const result = onChange.mock.calls[0][0];
    expect(result[0].spring).toBe(true);
  });

  it('Cancel 클릭 시 onChange가 호출되지 않는다', () => {
    const onChange = vi.fn();
    render(<StatusStripItemEditor value={[]} onChange={onChange} />);
    openModal();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
