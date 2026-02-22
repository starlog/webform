import { describe, it, expect } from 'vitest';

describe('designer setup', () => {
  it('should import React successfully', async () => {
    const React = await import('react');
    expect(React).toBeDefined();
  });

  it('should import ReactDOM successfully', async () => {
    const ReactDOM = await import('react-dom/client');
    expect(ReactDOM).toBeDefined();
  });
});
