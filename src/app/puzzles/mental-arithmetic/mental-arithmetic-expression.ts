type ArithmeticExpressionNode =
  | { kind: 'number'; value: string }
  | { kind: 'group'; expression: ArithmeticExpressionNode }
  | { kind: 'square-root'; radicand: ArithmeticExpressionNode }
  | {
      kind: 'binary';
      operator: '+' | '-' | 'x' | '/' | '^';
      left: ArithmeticExpressionNode;
      right: ArithmeticExpressionNode;
    };

export type ArithmeticExpressionPart = {
  id: number;
  expression: string;
  value: number;
};

export type InteractiveArithmeticExpression = {
  latex: string;
  parts: readonly ArithmeticExpressionPart[];
};

export function arithmeticExpressionToLatex(expression: string): string {
  return renderLatex(new ArithmeticExpressionParser(tokenize(expression)).parse());
}

export function arithmeticExpressionToInteractiveLatex(
  expression: string,
): InteractiveArithmeticExpression {
  const parts: ArithmeticExpressionPart[] = [];
  const root = new ArithmeticExpressionParser(tokenize(expression)).parse();

  return {
    latex: renderInteractiveLatex(root, parts, true, false),
    parts,
  };
}

class ArithmeticExpressionParser {
  private position = 0;

  constructor(private readonly tokens: string[]) {}

  parse(): ArithmeticExpressionNode {
    const expression = this.parseAdditionAndSubtraction();

    if (this.peek() !== undefined) {
      throw new Error(`Jeton inattendu : ${this.peek()}`);
    }

    return expression;
  }

  private parseAdditionAndSubtraction(): ArithmeticExpressionNode {
    let left = this.parseMultiplicationAndDivision();

    while (this.peek() === '+' || this.peek() === '-') {
      const operator = this.consume() as '+' | '-';
      left = {
        kind: 'binary',
        operator,
        left,
        right: this.parseMultiplicationAndDivision(),
      };
    }

    return left;
  }

  private parseMultiplicationAndDivision(): ArithmeticExpressionNode {
    let left = this.parsePower();

    while (this.peek() === 'x' || this.peek() === '/') {
      const operator = this.consume() as 'x' | '/';
      left = {
        kind: 'binary',
        operator,
        left,
        right: this.parsePower(),
      };
    }

    return left;
  }

  private parsePower(): ArithmeticExpressionNode {
    const left = this.parsePrimary();

    if (this.peek() !== '^') {
      return left;
    }

    this.consume('^');
    return {
      kind: 'binary',
      operator: '^',
      left,
      right: this.parsePower(),
    };
  }

  private parsePrimary(): ArithmeticExpressionNode {
    const token = this.peek();

    if (token === undefined) {
      throw new Error('Expression arithmétique incomplète.');
    }

    if (/^\d+$/.test(token)) {
      this.consume();
      return { kind: 'number', value: token };
    }

    if (token === 'sqrt') {
      this.consume('sqrt');
      this.consume('(');
      const radicand = this.parseAdditionAndSubtraction();
      this.consume(')');
      return { kind: 'square-root', radicand };
    }

    if (token === '(') {
      this.consume('(');
      const expression = this.parseAdditionAndSubtraction();
      this.consume(')');
      return { kind: 'group', expression };
    }

    throw new Error(`Valeur inattendue : ${token}`);
  }

  private peek(): string | undefined {
    return this.tokens[this.position];
  }

  private consume(expected?: string): string {
    const token = this.tokens[this.position];

    if (token === undefined || (expected !== undefined && token !== expected)) {
      throw new Error(`Jeton attendu : ${expected ?? 'valeur'}`);
    }

    this.position += 1;
    return token;
  }
}

function tokenize(expression: string): string[] {
  const tokens: string[] = [];
  let position = 0;

  while (position < expression.length) {
    const character = expression[position];

    if (/\s/.test(character)) {
      position += 1;
      continue;
    }

    if (expression.startsWith('sqrt', position)) {
      tokens.push('sqrt');
      position += 4;
      continue;
    }

    if (/\d/.test(character)) {
      let end = position + 1;

      while (end < expression.length && /\d/.test(expression[end])) {
        end += 1;
      }

      tokens.push(expression.slice(position, end));
      position = end;
      continue;
    }

    if ('()+-x/^'.includes(character)) {
      tokens.push(character);
      position += 1;
      continue;
    }

    throw new Error(`Caractère arithmétique non reconnu : ${character}`);
  }

  return tokens;
}

function renderLatex(node: ArithmeticExpressionNode): string {
  if (node.kind === 'number') {
    return node.value;
  }

  if (node.kind === 'group') {
    return `\\left(${renderLatex(node.expression)}\\right)`;
  }

  if (node.kind === 'square-root') {
    return `\\sqrt{${renderWithoutOuterGroup(node.radicand)}}`;
  }

  if (node.operator === '/') {
    return `\\frac{${renderWithoutOuterGroup(node.left)}}{${renderWithoutOuterGroup(node.right)}}`;
  }

  if (node.operator === '^') {
    return `${renderLatex(node.left)}^{${renderWithoutOuterGroup(node.right)}}`;
  }

  const operator = node.operator === 'x' ? '\\times' : node.operator;
  return `${renderLatex(node.left)} ${operator} ${renderLatex(node.right)}`;
}

function renderInteractiveLatex(
  node: ArithmeticExpressionNode,
  parts: ArithmeticExpressionPart[],
  allowInteractive: boolean,
  wrapNode = allowInteractive,
): string {
  if (node.kind === 'number') {
    return node.value;
  }

  if (node.kind === 'group') {
    const shouldWrap = allowInteractive && wrapNode;
    const latex = `\\left(${renderInteractiveLatex(
      node.expression,
      parts,
      shouldWrap ? false : allowInteractive,
    )}\\right)`;
    return shouldWrap ? wrapInteractivePart(node, latex, parts) : latex;
  }

  if (node.kind === 'square-root') {
    const shouldWrap = allowInteractive && wrapNode;
    const childInteractive = shouldWrap ? false : allowInteractive;
    const radicand =
      node.radicand.kind === 'group'
        ? renderInteractiveLatex(node.radicand.expression, parts, childInteractive)
        : renderInteractiveLatex(node.radicand, parts, childInteractive);
    const latex = `\\sqrt{${radicand}}`;
    return shouldWrap ? wrapInteractivePart(node, latex, parts) : latex;
  }

  let latex: string;
  const shouldWrap =
    allowInteractive &&
    wrapNode &&
    (node.operator === 'x' || node.operator === '/' || node.operator === '^');
  const childInteractive = shouldWrap ? false : allowInteractive;

  if (node.operator === '/') {
    latex = `\\frac{${renderInteractiveWithoutOuterGroup(node.left, parts, childInteractive)}}{${renderInteractiveWithoutOuterGroup(node.right, parts, childInteractive)}}`;
  } else if (node.operator === '^') {
    latex = `${renderInteractiveLatex(node.left, parts, childInteractive)}^{${renderInteractiveWithoutOuterGroup(node.right, parts, childInteractive)}}`;
  } else {
    const operator = node.operator === 'x' ? '\\times' : node.operator;
    latex = `${renderInteractiveLatex(node.left, parts, childInteractive)} ${operator} ${renderInteractiveLatex(node.right, parts, childInteractive)}`;
  }

  return shouldWrap ? wrapInteractivePart(node, latex, parts) : latex;
}

function renderWithoutOuterGroup(node: ArithmeticExpressionNode): string {
  return renderLatex(node.kind === 'group' ? node.expression : node);
}

function renderInteractiveWithoutOuterGroup(
  node: ArithmeticExpressionNode,
  parts: ArithmeticExpressionPart[],
  allowInteractive: boolean,
): string {
  return node.kind === 'group'
    ? renderInteractiveLatex(node.expression, parts, allowInteractive)
    : renderInteractiveLatex(node, parts, allowInteractive);
}

function wrapInteractivePart(
  node: ArithmeticExpressionNode,
  latex: string,
  parts: ArithmeticExpressionPart[],
): string {
  const id = parts.length;
  parts.push({
    id,
    expression: describeArithmeticNode(node),
    value: evaluateArithmeticNode(node),
  });

  return `\\htmlData{part-id=${id}}{${latex}}`;
}

function describeArithmeticNode(node: ArithmeticExpressionNode): string {
  if (node.kind === 'number') {
    return node.value;
  }

  if (node.kind === 'group') {
    return `(${describeArithmeticNode(node.expression)})`;
  }

  if (node.kind === 'square-root') {
    return `√(${describeArithmeticNode(node.radicand)})`;
  }

  const operator = node.operator === 'x' ? '×' : node.operator;
  return `${describeArithmeticNode(node.left)} ${operator} ${describeArithmeticNode(node.right)}`;
}

function evaluateArithmeticNode(node: ArithmeticExpressionNode): number {
  if (node.kind === 'number') {
    return Number(node.value);
  }

  if (node.kind === 'group') {
    return evaluateArithmeticNode(node.expression);
  }

  if (node.kind === 'square-root') {
    return Math.sqrt(evaluateArithmeticNode(node.radicand));
  }

  const left = evaluateArithmeticNode(node.left);
  const right = evaluateArithmeticNode(node.right);

  if (node.operator === '+') return left + right;
  if (node.operator === '-') return left - right;
  if (node.operator === 'x') return left * right;
  if (node.operator === '/') return left / right;
  return left ** right;
}
