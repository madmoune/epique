import katex from 'katex';
import {
  arithmeticExpressionToInteractiveLatex,
  arithmeticExpressionToLatex,
} from './mental-arithmetic-expression';
import {
  MENTAL_ARITHMETIC_TEMPLATE_COUNT,
  createArithmeticProblem,
} from './mental-arithmetic-problem';

describe('arithmeticExpressionToLatex', () => {
  it('renders powers and their following divisions as distinct operations', () => {
    expect(arithmeticExpressionToLatex('(5 + 3)^2 / 2 - 3 x (11 - 9) + 3^2')).toBe(
      '\\frac{\\left(5 + 3\\right)^{2}}{2} - 3 \\times \\left(11 - 9\\right) + 3^{2}',
    );
  });

  it('removes redundant parentheses inside a scientific fraction', () => {
    expect(arithmeticExpressionToLatex('(13^2 - 7^2) / (13 - 7)')).toBe(
      '\\frac{13^{2} - 7^{2}}{13 - 7}',
    );
  });

  it('renders square roots and nested groups', () => {
    expect(arithmeticExpressionToLatex('sqrt(144) x (8 + (3 x 4 - 2))')).toBe(
      '\\sqrt{144} \\times \\left(8 + \\left(3 \\times 4 - 2\\right)\\right)',
    );
  });

  it('rejects characters outside the arithmetic grammar', () => {
    expect(() => arithmeticExpressionToLatex('4 * 3')).toThrow(
      'Caractère arithmétique non reconnu',
    );
  });

  it('exposes clickable subresults for grouped parts', () => {
    const interactiveExpression = arithmeticExpressionToInteractiveLatex('(5 + 3) + (4321 - 1234)');

    expect(interactiveExpression.latex).toContain('part-id=');
    expect(() =>
      katex.renderToString(interactiveExpression.latex, {
        displayMode: true,
        output: 'htmlAndMathml',
        strict: false,
        trust: true,
        throwOnError: true,
      }),
    ).not.toThrow();
    expect(interactiveExpression.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ expression: '(5 + 3)', value: 8 }),
        expect.objectContaining({ expression: '(4321 - 1234)', value: 3087 }),
      ]),
    );
  });

  it('keeps clickable parts disjoint', () => {
    const interactiveExpression = arithmeticExpressionToInteractiveLatex(
      '(5 + 3) x (2 + 4) + (10 / 2)',
    );

    expect(interactiveExpression.parts).toEqual([
      expect.objectContaining({ expression: '(5 + 3) × (2 + 4)', value: 48 }),
      expect.objectContaining({ expression: '(10 / 2)', value: 5 }),
    ]);
  });

  it('exposes powers as independent clickable subresults', () => {
    const interactiveExpression = arithmeticExpressionToInteractiveLatex('11^2 + (4321 - 1234)');

    expect(interactiveExpression.parts).toEqual([
      expect.objectContaining({ expression: '11 ^ 2', value: 121 }),
      expect.objectContaining({ expression: '(4321 - 1234)', value: 3087 }),
    ]);
  });

  it('exposes square roots as independent clickable subresults', () => {
    const interactiveExpression = arithmeticExpressionToInteractiveLatex(
      'sqrt(144) + (4321 - 1234)',
    );

    expect(interactiveExpression.parts).toEqual([
      expect.objectContaining({ expression: '√(144)', value: 12 }),
      expect.objectContaining({ expression: '(4321 - 1234)', value: 3087 }),
    ]);
  });

  it('renders every generated problem template with KaTeX', () => {
    for (let template = 0; template < MENTAL_ARITHMETIC_TEMPLATE_COUNT; template += 1) {
      let call = 0;
      const random = (): number => {
        call += 1;
        return call === 1 ? (template + 0.5) / MENTAL_ARITHMETIC_TEMPLATE_COUNT : 0.47;
      };
      const latex = arithmeticExpressionToLatex(createArithmeticProblem(random).expression);

      expect(() =>
        katex.renderToString(latex, {
          displayMode: true,
          throwOnError: true,
        }),
      ).not.toThrow();
    }
  });
});
