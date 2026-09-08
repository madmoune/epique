export const COLORED_ROD_LEVELS = ['haut', 'milieu', 'bas'] as const;
export type ColoredRodLevel = (typeof COLORED_ROD_LEVELS)[number];

export const COLORED_ROD_COLORS = ['red', 'blue', 'yellow', 'green', 'purple', 'orange'] as const;
export type ColoredRodColor = (typeof COLORED_ROD_COLORS)[number];

export const COLORED_ROD_COUNT = 6;

export type ColoredRod = {
  id: string;
  colors: readonly [ColoredRodColor, ColoredRodColor, ColoredRodColor];
};

export type ColoredRodsPuzzle = {
  start: ColoredRod;
  finish: ColoredRod;
  rods: readonly ColoredRod[];
  solutionIds: readonly string[];
};

export type ColoredRodConflict = {
  level: ColoredRodLevel;
  color: ColoredRodColor;
};

type RodCode = readonly [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2];

const UNIQUE_SOLUTION_CODES: readonly RodCode[] = [
  [0, 0, 0],
  [1, 1, 1],
  [0, 0, 2],
  [1, 1, 0],
  [0, 2, 1],
  [1, 0, 0],
  [0, 1, 2],
  [1, 0, 1],
];

export function findColoredRodConflict(
  first: ColoredRod,
  second: ColoredRod,
): ColoredRodConflict | null {
  for (let index = 0; index < COLORED_ROD_LEVELS.length; index += 1) {
    if (first.colors[index] === second.colors[index]) {
      return {
        level: COLORED_ROD_LEVELS[index],
        color: first.colors[index],
      };
    }
  }

  return null;
}

export function isColoredRodSequenceValid(sequence: readonly ColoredRod[]): boolean {
  return sequence.every(
    (rod, index) => index === 0 || findColoredRodConflict(sequence[index - 1], rod) === null,
  );
}

export function countColoredRodSolutions(puzzle: ColoredRodsPuzzle): number {
  let solutionCount = 0;

  const search = (lastRod: ColoredRod, remaining: ColoredRod[]): void => {
    if (remaining.length === 0) {
      if (findColoredRodConflict(lastRod, puzzle.finish) === null) {
        solutionCount += 1;
      }
      return;
    }

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];

      if (findColoredRodConflict(lastRod, candidate) !== null) {
        continue;
      }

      search(candidate, [...remaining.slice(0, index), ...remaining.slice(index + 1)]);
    }
  };

  search(puzzle.start, [...puzzle.rods]);
  return solutionCount;
}

export function createColoredRodsPuzzle(random: () => number = Math.random): ColoredRodsPuzzle {
  const colorMaps = COLORED_ROD_LEVELS.map((_, level) =>
    shuffle(COLORED_ROD_COLORS, random).slice(0, 3),
  );
  const codes = random() < 0.5 ? [...UNIQUE_SOLUTION_CODES].reverse() : UNIQUE_SOLUTION_CODES;
  const sequence = codes.map((code, index) =>
    createRod(
      index === 0 ? 'start' : index === codes.length - 1 ? 'finish' : 'rod-' + index,
      code,
      colorMaps,
    ),
  );
  const start = sequence[0];
  const finish = sequence.at(-1);
  const solution = sequence.slice(1, -1);

  if (!start || !finish || solution.length !== COLORED_ROD_COUNT) {
    throw new Error('La génération des tiges colorées a produit une chaîne incomplète.');
  }

  return {
    start,
    finish,
    rods: shuffle(solution, random),
    solutionIds: solution.map((rod) => rod.id),
  };
}

function createRod(
  id: string,
  code: RodCode,
  colorMaps: readonly (readonly ColoredRodColor[])[],
): ColoredRod {
  const colors = COLORED_ROD_LEVELS.map((_, index) => colorMaps[index][code[index]]) as [
    ColoredRodColor,
    ColoredRodColor,
    ColoredRodColor,
  ];

  return { id, colors };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.max(0, Math.min(index, Math.floor(random() * (index + 1))));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}
