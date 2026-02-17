export { parse } from './parser.js';
export { evaluate } from './evaluator.js';
export { render, defaultStyles } from './renderer.js';
export { exprToLatex, nameToLatex } from './latex.js';
export type * from './types.js';

import { parse } from './parser.js';
import { evaluate } from './evaluator.js';
import { render } from './renderer.js';

/**
 * Process a calc document from source text to HTML output.
 * Convenience function that chains parse → evaluate → render.
 */
export function process(source: string): string {
  const ast = parse(source);
  const evaluated = evaluate(ast);
  return render(evaluated);
}
