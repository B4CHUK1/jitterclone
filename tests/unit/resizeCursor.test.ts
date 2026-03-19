import { describe, it, expect } from 'vitest';
import { getResizeCursorFromDirection } from '@/engine/interaction/resizeCursor';

describe('resize cursor mapping', () => {
  it('maps axis-aligned directions', () => {
    expect(getResizeCursorFromDirection({ x: 10, y: 0 })).toBe('ew-resize');
    expect(getResizeCursorFromDirection({ x: 0, y: 10 })).toBe('ns-resize');
  });

  it('maps diagonal directions', () => {
    expect(getResizeCursorFromDirection({ x: 10, y: 10 })).toBe('nwse-resize');
    expect(getResizeCursorFromDirection({ x: 10, y: -10 })).toBe('nesw-resize');
  });

  it('treats opposite directions as same cursor', () => {
    expect(getResizeCursorFromDirection({ x: -10, y: 0 })).toBe('ew-resize');
    expect(getResizeCursorFromDirection({ x: -10, y: -10 })).toBe('nwse-resize');
  });
});

