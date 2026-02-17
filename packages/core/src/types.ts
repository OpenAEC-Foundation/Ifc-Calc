export interface HeadingNode {
  type: 'heading';
  level: number;
  text: string;
}

export interface TextNode {
  type: 'text';
  text: string;
}

export interface AssignmentNode {
  type: 'assignment';
  name: string;
  expression: string;
  raw: string;
}

export interface ConditionalNode {
  type: 'conditional';
  condition: string;
  ifBody: AstNode[];
  elseBody: AstNode[];
}

export interface SvgNode {
  type: 'svg';
  content: string;
}

export interface ImageNode {
  type: 'image';
  src: string;
}

export type AstNode =
  | HeadingNode
  | TextNode
  | AssignmentNode
  | ConditionalNode
  | SvgNode
  | ImageNode;

export interface EvaluatedHeading {
  type: 'heading';
  level: number;
  text: string;
}

export interface EvaluatedText {
  type: 'text';
  text: string;
}

export interface EvaluatedAssignment {
  type: 'assignment';
  name: string;
  expression: string;
  substitution: string;
  result: string;
  unit: string;
}

export interface EvaluatedConditionalBranch {
  type: 'conditional-branch';
  children: EvaluatedNode[];
}

export interface EvaluatedSvg {
  type: 'svg';
  content: string;
}

export interface EvaluatedImage {
  type: 'image';
  src: string;
}

export type EvaluatedNode =
  | EvaluatedHeading
  | EvaluatedText
  | EvaluatedAssignment
  | EvaluatedConditionalBranch
  | EvaluatedSvg
  | EvaluatedImage;
