import katex from 'katex';
import type { EvaluatedNode } from './types.js';
import { exprToLatex, nameToLatex, resultToLatex } from './latex.js';

// ─── KaTeX rendering ────────────────────────────────────────────────

function renderLatex(latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      trust: true,
      strict: false,
    });
  } catch {
    return `<span class="calc-error-inline">${escapeHtml(latex)}</span>`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Node rendering ─────────────────────────────────────────────────

export function render(nodes: EvaluatedNode[]): string {
  const parts: string[] = ['<div class="ifc-calc">'];

  for (const node of nodes) {
    parts.push(renderNode(node));
  }

  parts.push('</div>');
  return parts.join('\n');
}

function renderNode(node: EvaluatedNode): string {
  switch (node.type) {
    case 'heading':
      return `<h${node.level}>${escapeHtml(node.text)}</h${node.level}>`;

    case 'text':
      return `<p class="calc-text">${escapeHtml(node.text)}</p>`;

    case 'assignment':
      return renderAssignment(node);

    case 'conditional-branch':
      return node.children.map(renderNode).join('\n');

    case 'svg':
      return `<div class="calc-svg">${node.content}</div>`;

    case 'image':
      return `<div class="calc-image"><img src="${escapeHtml(node.src)}" alt="" /></div>`;
  }
}

function renderAssignment(node: {
  name: string;
  expression: string;
  substitution: string;
  result: string;
  unit: string;
}): string {
  // Error case
  if (node.result.startsWith('Error:')) {
    return `<div class="calc-line calc-error">
  ${renderLatex(`${nameToLatex(node.name)} = ${exprToLatex(node.expression)}`)}
  <span class="calc-error-msg">${escapeHtml(node.result)}</span>
</div>`;
  }

  // Build the LaTeX chain: name = expr [= substitution] = result
  // Split numeric value and unit from result
  const { numStr, unitStr } = splitResult(node.result);
  const resultLatex = resultToLatex(numStr, unitStr);

  // Name
  const nameTex = nameToLatex(node.name);

  // Symbolic expression
  const exprTex = exprToLatex(node.expression);

  // Check if expression is just a direct value (no variables to substitute)
  const isDirectValue = !node.substitution || node.substitution === node.expression;

  let fullLatex: string;

  if (isDirectValue) {
    // Simple: name = value (e.g., b = 300 mm)
    fullLatex = `${nameTex} = \\textcolor{#059669}{\\boldsymbol{${resultLatex}}}`;
  } else {
    // Full chain: name = expr = substitution = result
    let subTex: string;
    try {
      subTex = exprToLatex(node.substitution);
    } catch {
      subTex = escapeLatexStr(node.substitution);
    }

    fullLatex = `${nameTex} = ${exprTex} = ${subTex} = \\textcolor{#059669}{\\boldsymbol{${resultLatex}}}`;
  }

  return `<div class="calc-line">${renderLatex(fullLatex, true)}</div>`;
}

/** Split a result string like "150000 mm^2" into number and unit */
function splitResult(result: string): { numStr: string; unitStr: string } {
  const match = result.match(/^([+-]?\d+\.?\d*(?:e[+-]?\d+)?)\s+(.+)$/i);
  if (match) {
    return { numStr: match[1], unitStr: match[2] };
  }
  return { numStr: result, unitStr: '' };
}

function escapeLatexStr(s: string): string {
  return s.replace(/[_^{}\\#&%$]/g, c => '\\' + c);
}

// ─── Styles ─────────────────────────────────────────────────────────

export const defaultStyles = `
.ifc-calc {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  max-width: 900px;
  padding: 2rem;
  line-height: 1.7;
  color: #1a1a1a;
}

.ifc-calc h1, .ifc-calc h2, .ifc-calc h3,
.ifc-calc h4, .ifc-calc h5, .ifc-calc h6 {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  color: #0d2137;
  border-bottom: 1px solid #d1d5db;
  padding-bottom: 0.3em;
}
.ifc-calc h1 { font-size: 1.5em; }
.ifc-calc h2 { font-size: 1.25em; }
.ifc-calc h3 { font-size: 1.1em; }

.calc-text {
  margin: 0.3em 0;
  color: #374151;
  font-size: 0.95em;
}

.calc-line {
  background: #f8fafc;
  border-left: 3px solid #3b82f6;
  padding: 0.4em 1.2em;
  margin: 0.35em 0;
  border-radius: 0 6px 6px 0;
  overflow-x: auto;
}

.calc-line .katex-display {
  margin: 0.2em 0;
  text-align: left !important;
}

.calc-line .katex {
  font-size: 1.1em;
}

.calc-error {
  border-left-color: #dc2626;
  background: #fef2f2;
}

.calc-error-msg {
  display: block;
  color: #dc2626;
  font-size: 0.85em;
  margin-top: 0.3em;
  font-family: 'Consolas', monospace;
}

.calc-error-inline {
  color: #dc2626;
  font-family: 'Consolas', monospace;
}

.calc-svg {
  margin: 1em 0;
  text-align: center;
}
.calc-svg svg {
  max-width: 100%;
}

.calc-image {
  margin: 1em 0;
  text-align: center;
}
.calc-image img {
  max-width: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}
`;
