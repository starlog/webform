import { describe, it, expect } from 'vitest';

describe('server setup', () => {
  it('should import express successfully', async () => {
    const express = await import('express');
    expect(express).toBeDefined();
  });
});
