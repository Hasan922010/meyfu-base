import { useEffect, useRef } from 'react';

export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => unknown;
}

/** Brauzerda WebMCP (`document.modelContext`) mavjud bo'lsa, tool'ni ro'yxatdan o'tkazadi. */
export function useWebMcpTool(tool: WebMcpTool): void {
  const execRef = useRef(tool.execute);
  useEffect(() => {
    execRef.current = tool.execute;
  }, [tool.execute]);

  useEffect(() => {
    const ctx = typeof document !== 'undefined' ? document.modelContext : undefined;
    if (!ctx?.registerTool) return;
    void ctx.registerTool({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      execute: (input) => execRef.current(input),
    });
    return () => {
      void ctx.unregisterTool?.(tool.name);
    };
  }, [tool.name, tool.description, tool.inputSchema]);
}
