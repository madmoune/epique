import { describe, expect, it } from 'vitest';
import {
  MENTAL_ARITHMETIC_TEMPLATE_COUNT,
  createArithmeticProblem,
} from './mental-arithmetic-problem';

describe('createArithmeticProblem', () => {
  it('keeps every advanced template exact and integer-valued', () => {
    for (let template = 0; template < MENTAL_ARITHMETIC_TEMPLATE_COUNT; template += 1) {
      let call = 0;
      const random = (): number => {
        call += 1;
        return call === 1 ? (template + 0.5) / MENTAL_ARITHMETIC_TEMPLATE_COUNT : 0.47;
      };
      const problem = createArithmeticProblem(random);

      expect(problem.answer).toBe(evaluateExpression(problem.expression));
      expect(Number.isInteger(problem.answer)).toBe(true);
      expect(problem.expression).toMatch(/\(.+\)/);
      expect(problem.expression).toContain('^');
      expect(problem.expression).toContain(' / ');
      expect(problem.expression).toContain(' x ');
      expect(problem.expression).toContain(' + ');
      expect(problem.expression).toContain(' - ');
      expect(problem.expression).toMatch(/\+ \(\d{4} - \d{4}\)$/);
    }
  });

  it('generates varied hard problems without fractional answers', () => {
    let state = 0x5eed1234;
    const random = (): number => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state / 0x1_0000_0000;
    };
    const problems = Array.from({ length: 600 }, () => createArithmeticProblem(random));

    for (const problem of problems) {
      expect(problem.answer).toBe(evaluateExpression(problem.expression));
      expect(Number.isInteger(problem.answer)).toBe(true);
    }

    expect(new Set(problems.map((problem) => problem.expression)).size).toBeGreaterThan(550);
    expect(problems.some((problem) => problem.expression.includes('^3'))).toBe(true);
    expect(problems.some((problem) => /\([^()]*(?:\([^()]+\))/.test(problem.expression))).toBe(
      true,
    );
  });

  it('does not cancel adjacent division and multiplication factors', () => {
    let state = 0x7eed1234;
    const random = (): number => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state / 0x1_0000_0000;
    };
    const problems = Array.from({ length: 2_000 }, () => createArithmeticProblem(random));

    for (const problem of problems) {
      const directFactors = problem.expression.match(/\/ (\d+) x (\d+)/);
      if (directFactors) {
        expect(directFactors[1]).not.toBe(directFactors[2]);
      }

      const groupedFactors = problem.expression.match(/\/ \((\d+) \+ (\d+)\) x (\d+)/);
      if (groupedFactors) {
        expect(Number(groupedFactors[1]) + Number(groupedFactors[2])).not.toBe(
          Number(groupedFactors[3]),
        );
      }
    }
  });
});

function evaluateExpression(expression: string): number {
  const javascriptExpression = expression
    .replace(/sqrt\((\d+)\)/g, 'Math.sqrt($1)')
    .replaceAll(' x ', ' * ')
    .replaceAll('^', '**');

  return Function(`"use strict"; return (${javascriptExpression});`)() as number;
}
