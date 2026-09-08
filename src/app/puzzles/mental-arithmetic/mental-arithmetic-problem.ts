export type ArithmeticProblem = {
  expression: string;
  answer: number;
};

export const MENTAL_ARITHMETIC_TEMPLATE_COUNT = 12;

export function createArithmeticProblem(random: () => number = Math.random): ArithmeticProblem {
  const randomInt = (min: number, max: number): number =>
    min + Math.floor(random() * (max - min + 1));
  const randomIntExcluding = (min: number, max: number, excluded: number): number => {
    const value = randomInt(min, max);

    if (value !== excluded || excluded < min || excluded > max) {
      return value;
    }

    return value === max ? min : value + 1;
  };
  const type = randomInt(0, MENTAL_ARITHMETIC_TEMPLATE_COUNT - 1);
  const largeAddend = randomInt(1_000, 9_999);
  const largeSubtrahend = randomInt(1_000, largeAddend);
  const withLargeAddSubtract = (problem: ArithmeticProblem): ArithmeticProblem => ({
    expression: `${problem.expression} + (${largeAddend} - ${largeSubtrahend})`,
    answer: problem.answer + largeAddend - largeSubtrahend,
  });

  if (type === 0) {
    const a = randomInt(5, 14);
    const b = randomInt(4, 16);
    const divisor = randomInt(2, 5);
    const factor = randomInt(3, 7);
    const squaredBase = randomInt(6, 10);
    const adjustment = squaredBase ** 2 - divisor * factor;
    const tail = randomInt(12, 48);
    const root = randomInt(4, 13);

    return withLargeAddSubtract({
      expression: `(${a} + ${b}) x (${squaredBase}^2 - ${adjustment}) / ${divisor} + ${tail} - sqrt(${root ** 2})`,
      answer: (a + b) * factor + tail - root,
    });
  }

  if (type === 1) {
    const b = randomInt(4, 10);
    const a = b + randomInt(2, 6);
    const c = randomInt(3, 9);
    const d = randomInt(6, 14);
    const e = randomInt(2, d - 2);
    const root = randomInt(3, 12);

    return withLargeAddSubtract({
      expression: `(${a}^2 - ${b}^2) / (${a} - ${b}) + ${c} x (${d} + ${e}) - sqrt(${root ** 2})`,
      answer: a + b + c * (d + e) - root,
    });
  }

  if (type === 2) {
    const a = randomInt(5, 12);
    const b = randomInt(3, 9);
    const c = randomInt(2, 10);
    const cubedBase = randomInt(2, 5);
    const divisor = randomInt(2, 6);
    const quotient = Math.ceil(cubedBase ** 3 / divisor) + randomInt(3, 9);
    const adjustment = divisor * quotient - cubedBase ** 3;
    const root = randomInt(3, 11);
    const rootMultiplier = randomInt(2, 7);

    return withLargeAddSubtract({
      expression: `${a} x (${b} + ${c}) - (${cubedBase}^3 + ${adjustment}) / ${divisor} + sqrt(${root ** 2}) x ${rootMultiplier}`,
      answer: a * (b + c) - quotient + root * rootMultiplier,
    });
  }

  if (type === 3) {
    const divisor = randomInt(2, 5);
    const total = divisor * randomInt(3, 6);
    const a = randomInt(2, total - 2);
    const b = total - a;
    const c = randomInt(3, 9);
    const d = randomInt(7, 15);
    const e = randomInt(2, d - 2);
    const f = randomInt(3, 9);

    return withLargeAddSubtract({
      expression: `(${a} + ${b})^2 / ${divisor} - ${c} x (${d} - ${e}) + ${f}^2`,
      answer: total ** 2 / divisor - c * (d - e) + f ** 2,
    });
  }

  if (type === 4) {
    const start = randomInt(140, 280);
    const quotient = randomInt(9, 24);
    const divisor = randomInt(2, 8);
    const multiplier = randomIntExcluding(2, 6, divisor);
    const a = randomInt(3, 9);
    const b = randomInt(3, 9);
    const root = randomInt(4, 13);

    return withLargeAddSubtract({
      expression: `${start} - ${quotient * divisor} / ${divisor} x ${multiplier} + (${a} + ${b})^2 - sqrt(${root ** 2})`,
      answer: start - quotient * multiplier + (a + b) ** 2 - root,
    });
  }

  if (type === 5) {
    const cubedBase = randomInt(4, 7);
    const divisor = randomInt(2, 6);
    const maximumQuotient = Math.floor((cubedBase ** 3 - 6) / divisor);
    const quotient = randomInt(6, Math.min(24, maximumQuotient));
    const adjustment = cubedBase ** 3 - divisor * quotient;
    const a = randomInt(3, 9);
    const b = randomInt(3, 10);
    const c = randomInt(2, Math.min(12, a * b - 1));
    const multiplier = randomInt(2, 7);
    const root = randomInt(3, 12);

    return withLargeAddSubtract({
      expression: `(${cubedBase}^3 - ${adjustment}) / ${divisor} + (${a} x ${b} - ${c}) x ${multiplier} - sqrt(${root ** 2})`,
      answer: quotient + (a * b - c) * multiplier - root,
    });
  }

  if (type === 6) {
    const a = randomInt(11, 18);
    const b = randomInt(4, 10);
    const c = randomInt(3, 9);
    const d = randomInt(8, 16);
    const e = randomInt(2, d - 2);
    const f = randomInt(2, 7);
    const g = randomInt(2, 7);
    const quotient = randomInt(8, 25);
    const multiplier = randomIntExcluding(2, 6, f + g);

    return withLargeAddSubtract({
      expression: `${a}^2 - (${b} + ${c}) x (${d} - ${e}) + ${(f + g) * quotient} / (${f} + ${g}) x ${multiplier}`,
      answer: a ** 2 - (b + c) * (d - e) + quotient * multiplier,
    });
  }

  if (type === 7) {
    const root = randomInt(4, 10);
    const a = randomInt(5, 16);
    const b = randomInt(3, 9);
    const cubedBase = randomInt(3, 6);
    const divisor = randomInt(2, 6);
    const maximumQuotient = Math.floor((cubedBase ** 3 - 2) / divisor);
    const quotient = randomInt(3, Math.min(24, maximumQuotient));
    const adjustment = cubedBase ** 3 - divisor * quotient;
    const tail = randomInt(10, 50);

    return withLargeAddSubtract({
      expression: `sqrt(${root ** 2}) x (${a} + ${b}^2) - (${cubedBase}^3 - ${adjustment}) / ${divisor} + ${tail}`,
      answer: root * (a + b ** 2) - quotient + tail,
    });
  }

  if (type === 8) {
    const divisor = randomInt(3, 5);
    const total = divisor * randomInt(4, 7);
    const a = randomInt(2, 3);
    const b = randomInt(2, 3);
    const c = total - a * b;
    const d = randomInt(6, 12);
    const e = randomInt(4, 20);
    const f = randomInt(3, 12);
    const g = randomInt(2, 9);

    return withLargeAddSubtract({
      expression: `(${a} x ${b} + ${c})^2 / ${divisor} - (${d}^2 - ${e}) + ${f} x ${g}`,
      answer: total ** 2 / divisor - (d ** 2 - e) + f * g,
    });
  }

  if (type === 9) {
    const start = randomInt(220, 380);
    const a = randomInt(4, 10);
    const b = randomInt(3, 9);
    const c = randomInt(4, 10);
    const d = randomInt(3, 9);
    const divisor = randomInt(2, 6);
    const quotient = Math.ceil((c * d) / divisor) + randomInt(4, 10);
    const adjustment = divisor * quotient - c * d;
    const cubedBase = randomInt(2, 5);
    const root = randomInt(4, 14);

    return withLargeAddSubtract({
      expression: `${start} - (${a} + ${b})^2 + (${c} x ${d} + ${adjustment}) / ${divisor} - ${cubedBase}^3 + sqrt(${root ** 2})`,
      answer: start - (a + b) ** 2 + quotient - cubedBase ** 3 + root,
    });
  }

  if (type === 10) {
    const a = randomInt(4, 14);
    const b = randomInt(3, 9);
    const c = randomInt(3, 9);
    const d = randomInt(2, Math.min(20, b * c - 1));
    const multiplier = randomInt(2, 7);
    const squaredBase = randomInt(4, 10);
    const offset = randomInt(3, 20);
    const quotient = randomInt(8, 24);
    const divisor = randomInt(2, 8);
    const root = randomInt(3, 12);

    return withLargeAddSubtract({
      expression: `(${a} + (${b} x ${c} - ${d})) x ${multiplier} - (${squaredBase}^2 + ${offset}) + ${quotient * divisor} / ${divisor} - sqrt(${root ** 2})`,
      answer: (a + (b * c - d)) * multiplier - (squaredBase ** 2 + offset) + quotient - root,
    });
  }

  const a = randomInt(3, 10);
  const b = randomInt(3, 10);
  const multiplier = randomInt(2, 7);
  const divisor = randomInt(2, 7);
  const quotient = randomInt(8, 25);
  const start = divisor * quotient + (a + b) * multiplier;
  const d = randomInt(3, 9);
  const e = randomInt(3, 9);
  const root = randomInt(4, 13);

  return withLargeAddSubtract({
    expression: `(${start} - (${a} + ${b}) x ${multiplier}) / ${divisor} + (${d} + ${e})^2 - sqrt(${root ** 2})`,
    answer: quotient + (d + e) ** 2 - root,
  });
}
