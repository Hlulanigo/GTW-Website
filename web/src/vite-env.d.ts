/// <reference types="vite/client" />

declare module "react-dom/client" {
  import type { ReactNode } from "react";

  interface Root {
    render(children: ReactNode): void;
    unmount(): void;
  }

  interface CreateRootOptions {
    identifierPrefix?: string;
    onRecoverableError?: (error: unknown) => void;
  }

  export function createRoot(container: Element | DocumentFragment, options?: CreateRootOptions): Root;
  export function hydrateRoot(container: Element | Document, initialChildren: ReactNode, options?: CreateRootOptions): Root;
}
