import { create, all, type MathJsInstance, type MathNode } from 'mathjs';
import type { AstNode, EvaluatedNode } from './types.js';

const math: MathJsInstance = create(all, {});

export interface Scope {
  [key: string]: unknown;
}

export function evaluate(nodes: AstNode[]): EvaluatedNode[] {
  const scope: Scope = {};
  return evaluateNodes(nodes, scope);
}

function evaluateNodes(nodes: AstNode[], scope: Scope): EvaluatedNode[] {
  const result: EvaluatedNode[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'heading':
        result.push({ type: 'heading', level: node.level, text: node.text });
        break;

      case 'text':
        result.push({ type: 'text', text: node.text });
        break;

      case 'assignment': {
        const evaluated = evaluateAssignment(node.name, node.expression, scope);
        result.push(evaluated);
        break;
      }

      case 'conditional': {
        const condResult = evaluateConditional(node, scope);
        if (condResult) {
          result.push(condResult);
        }
        break;
      }

      case 'svg': {
        const interpolated = interpolateSvg(node.content, scope);
        result.push({ type: 'svg', content: interpolated });
        break;
      }

      case 'image':
        result.push({ type: 'image', src: node.src });
        break;
    }
  }

  return result;
}

// Separate "expr to unit" into expression and target unit
const TO_UNIT_RE = /^(.+?)\s+to\s+(.+)$/;
const IN_UNIT_RE = /^(.+?)\s+in\s+(.+)$/;

function evaluateAssignment(
  name: string,
  expression: string,
  scope: Scope
): EvaluatedNode {
  try {
    // Parse "to unit" / "in unit" for display purposes
    let displayExpr = expression;
    const toMatch = expression.match(TO_UNIT_RE) || expression.match(IN_UNIT_RE);
    if (toMatch) {
      displayExpr = toMatch[1].trim();
    }

    // Evaluate the full expression (including "to unit" if present)
    const compiled = math.parse(expression);
    const value = compiled.evaluate(scope);
    scope[name] = value;

    // Build substitution: replace variable names with their values
    const substitution = buildSubstitution(displayExpr, scope, name);

    // Format the result with simplified units
    const resultStr = formatResult(value);
    const unit = isUnit(value) ? simplifyUnitString(value) : '';

    return {
      type: 'assignment',
      name,
      expression: displayExpr,
      substitution,
      result: resultStr,
      unit,
    };
  } catch (err) {
    return {
      type: 'assignment',
      name,
      expression,
      substitution: '',
      result: `Error: ${(err as Error).message}`,
      unit: '',
    };
  }
}

function buildSubstitution(
  expression: string,
  scope: Scope,
  currentVar: string
): string {
  const parsed = math.parse(expression);
  const variables = new Set<string>();
  parsed.traverse((node: MathNode) => {
    if (node.type === 'SymbolNode' && 'name' in node) {
      const nodeName = (node as unknown as { name: string }).name;
      if (nodeName !== currentVar && nodeName in scope) {
        variables.add(nodeName);
      }
    }
  });

  if (variables.size === 0) {
    return '';
  }

  let sub = expression;
  for (const varName of variables) {
    const val = scope[varName];
    const formatted = formatInline(val);
    // Wrap in parentheses if value has a unit (contains space) to preserve
    // operator precedence: h^2 → (500 mm)^2, not 500 mm^2
    const wrapped = isUnit(val) ? `(${formatted})` : formatted;
    sub = sub.replace(new RegExp(`\\b${varName}\\b`, 'g'), wrapped);
  }
  return sub;
}

// ─── Unit simplification ────────────────────────────────────────────

interface UnitComponent {
  unit: { name: string };
  prefix: { name: string };
  power: number;
}

interface MathUnit {
  toNumber: (unit: string) => number;
  formatUnits: () => string;
  units: UnitComponent[];
  value: number;
}

/** Check if a value is a mathjs Unit */
function isUnit(value: unknown): value is MathUnit {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).toNumber === 'function' &&
    typeof (value as Record<string, unknown>).formatUnits === 'function'
  );
}

/**
 * Simplify unit string by combining like units.
 * mm mm → mm^2, kN / (mm mm) → kN / mm^2
 */
function simplifyUnitString(value: MathUnit): string {
  const groups: Record<string, { name: string; power: number }> = {};

  for (const u of value.units) {
    const key = u.prefix.name + u.unit.name;
    if (groups[key] === undefined) {
      groups[key] = { name: key, power: 0 };
    }
    groups[key].power += u.power;
  }

  const entries = Object.values(groups).filter(g => g.power !== 0);
  const pos = entries.filter(g => g.power > 0);
  const neg = entries.filter(g => g.power < 0);

  let result = pos
    .map(g => (g.power === 1 ? g.name : `${g.name}^${g.power}`))
    .join(' ');

  if (neg.length > 0) {
    const negStr = neg
      .map(g => {
        const absPow = Math.abs(g.power);
        return absPow === 1 ? g.name : `${g.name}^${absPow}`;
      })
      .join(' ');

    if (pos.length === 0) {
      // Pure inverse: 1 / mm^2
      result = `1 / ${neg.length > 1 ? `(${negStr})` : negStr}`;
    } else {
      result += ` / ${neg.length > 1 ? `(${negStr})` : negStr}`;
    }
  }

  return result;
}

/** Get the numeric value in the simplified unit */
function getNumericValue(value: MathUnit): number {
  try {
    const simplified = simplifyUnitString(value);
    return value.toNumber(simplified);
  } catch {
    // Fallback: extract from toString
    const str = String(value);
    const match = str.match(/^([+-]?\d+\.?\d*(?:e[+-]?\d+)?)\s/i);
    if (match) return parseFloat(match[1]);
    return value.value;
  }
}

// ─── Number formatting ──────────────────────────────────────────────

function formatNumber(n: number): string {
  if (!isFinite(n)) return String(n);
  if (n === 0) return '0';

  // If integer and not too large, show exact
  if (Number.isInteger(n) && Math.abs(n) < 1e12) {
    return n.toString();
  }

  // Use 4 significant digits for non-integers
  const formatted = parseFloat(n.toPrecision(4));

  // Avoid scientific notation for reasonable ranges
  if (Math.abs(formatted) >= 0.001 && Math.abs(formatted) < 1e9) {
    return formatted.toString();
  }

  return n.toExponential(3);
}

/** Format value for the final result: "150000 mm^2" */
function formatResult(value: unknown): string {
  if (value === null || value === undefined) return '';

  if (isUnit(value)) {
    const num = getNumericValue(value);
    const unit = simplifyUnitString(value);
    return `${formatNumber(num)} ${unit}`;
  }

  if (typeof value === 'number') {
    return formatNumber(value);
  }

  return String(value);
}

/** Format value for inline substitution: "300 mm" */
function formatInline(value: unknown): string {
  if (value === null || value === undefined) return '';

  if (isUnit(value)) {
    const num = getNumericValue(value);
    const unit = simplifyUnitString(value);
    return `${formatNumber(num)} ${unit}`;
  }

  if (typeof value === 'number') {
    return formatNumber(value);
  }

  return String(value);
}

// ─── Conditionals ───────────────────────────────────────────────────

function evaluateConditional(
  node: { condition: string; ifBody: AstNode[]; elseBody: AstNode[] },
  scope: Scope
): EvaluatedNode | null {
  try {
    const condValue = math.evaluate(node.condition, scope);
    const isTruthy = Boolean(condValue);
    const body = isTruthy ? node.ifBody : node.elseBody;

    if (body.length === 0) return null;

    const children = evaluateNodes(body, scope);
    return { type: 'conditional-branch', children };
  } catch {
    return {
      type: 'conditional-branch',
      children: [{ type: 'text', text: `Error evaluating condition: ${node.condition}` }],
    };
  }
}

// ─── SVG interpolation ──────────────────────────────────────────────

function interpolateSvg(content: string, scope: Scope): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, varName: string) => {
    if (varName in scope) {
      const val = scope[varName];
      if (isUnit(val)) {
        return formatNumber(getNumericValue(val));
      }
      if (typeof val === 'number') {
        return formatNumber(val);
      }
      return String(val);
    }
    return `{{${varName}}}`;
  });
}
