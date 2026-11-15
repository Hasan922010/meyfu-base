import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useWebMcpTool } from './webmcp';

function Harness({ onExec }: { onExec: (x: Record<string, unknown>) => void }) {
  useWebMcpTool({
    name: 'test_tool',
    description: 'Test',
    inputSchema: { type: 'object' },
    execute: onExec,
  });
  return null;
}

afterEach(() => {
  delete document.modelContext;
});

describe('useWebMcpTool', () => {
  it("modelContext yo'q bo'lsa xatosiz o'tadi", () => {
    expect(() => render(<Harness onExec={vi.fn()} />)).not.toThrow();
  });

  it("modelContext mavjud bo'lsa registerTool va unregisterTool chaqiradi", () => {
    const registerTool = vi.fn();
    const unregisterTool = vi.fn();
    document.modelContext = { registerTool, unregisterTool };

    const { unmount } = render(<Harness onExec={vi.fn()} />);
    expect(registerTool).toHaveBeenCalledTimes(1);
    expect(registerTool).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'test_tool', description: 'Test' }),
    );

    unmount();
    expect(unregisterTool).toHaveBeenCalledWith('test_tool');
  });
});
