import type { AstNode } from './types.js';

// Pattern: variable = expression (with optional unit on the value side)
// Matches lines like: b = 300mm, A = b * h, sigma = F / A
const ASSIGNMENT_RE = /^([a-zA-Z_]\w*)\s*=\s*(.+)$/;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const SVG_START_RE = /^@svg\s*$/;
const SVG_END_RE = /^@end\s*$/;
const IMG_RE = /^@img\((.+)\)\s*$/;
const SELECT_START_RE = /^@select\s+([a-zA-Z_]\w*)\s+"([^"]+)"\s*$/;
const SELECT_OPTION_RE = /^(.+?)\s*=\s*(.+)$/;
const GEF_RE = /^@gef\s+([a-zA-Z_]\w*)\s*$/;
const IF_RE = /^#if\s+(.+)$/;
const ELSE_RE = /^#else\s*$/;
const ENDIF_RE = /^#end\s+if\s*$/;

export function parse(source: string): AstNode[] {
  const lines = source.split('\n');
  return parseLines(lines, 0, lines.length).nodes;
}

interface ParseResult {
  nodes: AstNode[];
  endIndex: number;
}

function parseLines(lines: string[], start: number, end: number): ParseResult {
  const nodes: AstNode[] = [];
  let i = start;

  while (i < end) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line — skip
    if (trimmed === '') {
      i++;
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(HEADING_RE);
    if (headingMatch) {
      nodes.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      i++;
      continue;
    }

    // SVG block
    if (SVG_START_RE.test(trimmed)) {
      const svgLines: string[] = [];
      i++;
      while (i < end && !SVG_END_RE.test(lines[i].trim())) {
        svgLines.push(lines[i]);
        i++;
      }
      nodes.push({ type: 'svg', content: svgLines.join('\n') });
      i++; // skip @end
      continue;
    }

    // Select block
    const selectMatch = trimmed.match(SELECT_START_RE);
    if (selectMatch) {
      const name = selectMatch[1];
      const label = selectMatch[2];
      const options: { text: string; value: string }[] = [];
      i++;
      while (i < end && !SVG_END_RE.test(lines[i].trim())) {
        const optLine = lines[i].trim();
        if (optLine !== '') {
          const optMatch = optLine.match(SELECT_OPTION_RE);
          if (optMatch) {
            options.push({ text: optMatch[1].trim(), value: optMatch[2].trim() });
          }
        }
        i++;
      }
      nodes.push({ type: 'select', name, label, options });
      i++; // skip @end
      continue;
    }

    // Image
    const imgMatch = trimmed.match(IMG_RE);
    if (imgMatch) {
      nodes.push({ type: 'image', src: imgMatch[1].trim() });
      i++;
      continue;
    }

    // GEF upload
    const gefMatch = trimmed.match(GEF_RE);
    if (gefMatch) {
      nodes.push({ type: 'gef-upload', name: gefMatch[1] });
      i++;
      continue;
    }

    // Conditional #if / #else / #end if
    const ifMatch = trimmed.match(IF_RE);
    if (ifMatch) {
      const condition = ifMatch[1];
      i++;
      // Collect if-body lines until #else or #end if
      const ifBodyResult = collectConditionalBody(lines, i, end);
      const ifBody = ifBodyResult.nodes;
      i = ifBodyResult.endIndex;

      let elseBody: AstNode[] = [];
      if (i < end && ELSE_RE.test(lines[i].trim())) {
        i++; // skip #else
        const elseBodyResult = collectConditionalBody(lines, i, end);
        elseBody = elseBodyResult.nodes;
        i = elseBodyResult.endIndex;
      }

      // skip #end if
      if (i < end && ENDIF_RE.test(lines[i].trim())) {
        i++;
      }

      nodes.push({ type: 'conditional', condition, ifBody, elseBody });
      continue;
    }

    // Assignment (variable = expression)
    const assignMatch = trimmed.match(ASSIGNMENT_RE);
    if (assignMatch) {
      nodes.push({
        type: 'assignment',
        name: assignMatch[1],
        expression: assignMatch[2].trim(),
        raw: trimmed,
      });
      i++;
      continue;
    }

    // Plain text (description)
    nodes.push({ type: 'text', text: trimmed });
    i++;
  }

  return { nodes, endIndex: end };
}

/** Collect body lines for #if or #else block until #else or #end if */
function collectConditionalBody(
  lines: string[],
  start: number,
  end: number
): ParseResult {
  const nodes: AstNode[] = [];
  let i = start;

  while (i < end) {
    const trimmed = lines[i].trim();
    if (ELSE_RE.test(trimmed) || ENDIF_RE.test(trimmed)) {
      break;
    }

    // Handle nested #if
    const ifMatch = trimmed.match(IF_RE);
    if (ifMatch) {
      const condition = ifMatch[1];
      i++;
      const ifBodyResult = collectConditionalBody(lines, i, end);
      const ifBody = ifBodyResult.nodes;
      i = ifBodyResult.endIndex;

      let elseBody: AstNode[] = [];
      if (i < end && ELSE_RE.test(lines[i].trim())) {
        i++;
        const elseBodyResult = collectConditionalBody(lines, i, end);
        elseBody = elseBodyResult.nodes;
        i = elseBodyResult.endIndex;
      }
      if (i < end && ENDIF_RE.test(lines[i].trim())) {
        i++;
      }
      nodes.push({ type: 'conditional', condition, ifBody, elseBody });
      continue;
    }

    if (trimmed === '') {
      i++;
      continue;
    }

    const headingMatch = trimmed.match(HEADING_RE);
    if (headingMatch) {
      nodes.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
      i++;
      continue;
    }

    const assignMatch = trimmed.match(ASSIGNMENT_RE);
    if (assignMatch) {
      nodes.push({
        type: 'assignment',
        name: assignMatch[1],
        expression: assignMatch[2].trim(),
        raw: trimmed,
      });
      i++;
      continue;
    }

    nodes.push({ type: 'text', text: trimmed });
    i++;
  }

  return { nodes, endIndex: i };
}
