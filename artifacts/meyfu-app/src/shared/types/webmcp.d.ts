import 'react';

declare global {
  interface WebMcpToolSpec {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    execute: (input: Record<string, unknown>) => unknown;
  }

  interface Document {
    modelContext?: {
      registerTool: (tool: WebMcpToolSpec) => Promise<void> | void;
      unregisterTool?: (name: string) => Promise<void> | void;
    };
  }
}

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface FormHTMLAttributes<T> {
    toolname?: string;
    tooldescription?: string;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface InputHTMLAttributes<T> {
    toolparamdescription?: string;
  }
}

export {};
