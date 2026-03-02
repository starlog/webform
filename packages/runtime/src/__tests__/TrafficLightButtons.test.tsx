import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrafficLightButtons, titleTextStyle } from '../components/TrafficLightButtons';

describe('TrafficLightButtons', () => {
  it('3개 버튼을 렌더링한다', () => {
    render(<TrafficLightButtons />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
  });

  it('Close, Minimize, Maximize 버튼을 순서대로 표시한다', () => {
    render(<TrafficLightButtons />);
    expect(screen.getByTitle('Close')).toBeInTheDocument();
    expect(screen.getByTitle('Minimize')).toBeInTheDocument();
    expect(screen.getByTitle('Maximize')).toBeInTheDocument();
  });

  it('각 버튼에 올바른 색상을 적용한다', () => {
    render(<TrafficLightButtons />);
    const closeBtn = screen.getByTitle('Close');
    const minBtn = screen.getByTitle('Minimize');
    const maxBtn = screen.getByTitle('Maximize');

    expect(closeBtn.style.backgroundColor).toBe('rgb(255, 95, 87)'); // #FF5F57
    expect(minBtn.style.backgroundColor).toBe('rgb(254, 188, 46)'); // #FEBC2E
    expect(maxBtn.style.backgroundColor).toBe('rgb(40, 200, 64)'); // #28C840
  });

  it('Maximize 클릭 시 onMaximize 콜백을 호출한다', () => {
    const onMaximize = vi.fn();
    render(<TrafficLightButtons onMaximize={onMaximize} />);

    fireEvent.click(screen.getByTitle('Maximize'));
    expect(onMaximize).toHaveBeenCalledTimes(1);
  });

  it('showMinimize=false이면 Minimize 버튼을 비활성화한다', () => {
    render(<TrafficLightButtons showMinimize={false} />);

    const buttons = screen.getAllByRole('button');
    // Close는 활성, Minimize 위치의 버튼은 비활성, Maximize는 활성
    expect(buttons[1]).toBeDisabled();
    expect(buttons[1].style.backgroundColor).toBe('rgb(204, 204, 204)'); // #ccc
  });

  it('showMaximize=false이면 Maximize 버튼을 비활성화한다', () => {
    render(<TrafficLightButtons showMaximize={false} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons[2]).toBeDisabled();
    expect(buttons[2].style.backgroundColor).toBe('rgb(204, 204, 204)');
  });

  it('둘 다 false이면 Close만 활성 상태이다', () => {
    render(<TrafficLightButtons showMinimize={false} showMaximize={false} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).not.toBeDisabled(); // Close
    expect(buttons[1]).toBeDisabled(); // Minimize
    expect(buttons[2]).toBeDisabled(); // Maximize
  });

  it('onMaximize가 없으면 Maximize 클릭해도 에러가 없다', () => {
    render(<TrafficLightButtons />);
    expect(() => fireEvent.click(screen.getByTitle('Maximize'))).not.toThrow();
  });
});

describe('titleTextStyle', () => {
  it('텍스트 말줄임 스타일을 포함한다', () => {
    expect(titleTextStyle.overflow).toBe('hidden');
    expect(titleTextStyle.whiteSpace).toBe('nowrap');
    expect(titleTextStyle.textOverflow).toBe('ellipsis');
  });

  it('flex: 1로 공간을 채운다', () => {
    expect(titleTextStyle.flex).toBe(1);
  });
});
