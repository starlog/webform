import { describe, it, expect } from 'vitest';
import { SHELL_PROPERTIES } from '../components/PropertyPanel/controlProperties';

describe('controlProperties - Shell', () => {
  it('SHELL_PROPERTIES가 배열로 export 된다', () => {
    expect(Array.isArray(SHELL_PROPERTIES)).toBe(true);
    expect(SHELL_PROPERTIES.length).toBeGreaterThan(0);
  });

  it('title 속성이 포함된다', () => {
    const names = SHELL_PROPERTIES.map((p) => p.name);
    expect(names).toContain('title');
  });

  it('width 속성이 포함된다', () => {
    const names = SHELL_PROPERTIES.map((p) => p.name);
    expect(names).toContain('width');
  });

  it('height 속성이 포함된다', () => {
    const names = SHELL_PROPERTIES.map((p) => p.name);
    expect(names).toContain('height');
  });

  it('backgroundColor 속성이 포함된다', () => {
    const names = SHELL_PROPERTIES.map((p) => p.name);
    expect(names).toContain('backgroundColor');
  });

  it('font 속성이 포함된다', () => {
    const names = SHELL_PROPERTIES.map((p) => p.name);
    expect(names).toContain('font');
  });

  it('showTitleBar 속성이 포함된다', () => {
    const names = SHELL_PROPERTIES.map((p) => p.name);
    expect(names).toContain('showTitleBar');
  });

  it('formBorderStyle 속성이 포함된다', () => {
    const names = SHELL_PROPERTIES.map((p) => p.name);
    expect(names).toContain('formBorderStyle');
  });

  it('maximizeBox 속성이 포함된다', () => {
    const names = SHELL_PROPERTIES.map((p) => p.name);
    expect(names).toContain('maximizeBox');
  });

  it('minimizeBox 속성이 포함된다', () => {
    const names = SHELL_PROPERTIES.map((p) => p.name);
    expect(names).toContain('minimizeBox');
  });

  it('각 속성에 name, label, category, editorType이 정의되어 있다', () => {
    for (const prop of SHELL_PROPERTIES) {
      expect(prop.name).toBeTruthy();
      expect(prop.label).toBeTruthy();
      expect(prop.category).toBeTruthy();
      expect(prop.editorType).toBeTruthy();
    }
  });

  it('Layout 카테고리에 width, height가 포함된다', () => {
    const layoutProps = SHELL_PROPERTIES.filter((p) => p.category === 'Layout');
    const names = layoutProps.map((p) => p.name);
    expect(names).toContain('width');
    expect(names).toContain('height');
  });

  it('Appearance 카테고리에 title, backgroundColor, font가 포함된다', () => {
    const appearanceProps = SHELL_PROPERTIES.filter((p) => p.category === 'Appearance');
    const names = appearanceProps.map((p) => p.name);
    expect(names).toContain('title');
    expect(names).toContain('backgroundColor');
    expect(names).toContain('font');
  });

  it('Behavior 카테고리에 maximizeBox, minimizeBox가 포함된다', () => {
    const behaviorProps = SHELL_PROPERTIES.filter((p) => p.category === 'Behavior');
    const names = behaviorProps.map((p) => p.name);
    expect(names).toContain('maximizeBox');
    expect(names).toContain('minimizeBox');
  });
});
