import { process, defaultStyles } from '@ifc-calc/core';
import 'katex/dist/katex.min.css';

let styleInjected = false;

function injectStyles(): void {
  if (styleInjected) return;
  const style = document.createElement('style');
  style.textContent = defaultStyles;
  document.head.appendChild(style);
  styleInjected = true;
}

export function updatePreview(container: HTMLElement, source: string): void {
  injectStyles();
  try {
    container.innerHTML = process(source);
  } catch (err) {
    container.innerHTML = `<div class="ifc-calc"><p class="calc-text" style="color:#dc2626;">Render error: ${(err as Error).message}</p></div>`;
  }
}
