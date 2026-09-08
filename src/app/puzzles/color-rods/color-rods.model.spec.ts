import { describe, expect, it } from 'vitest';
import {
  COLORED_ROD_COLORS,
  ColoredRod,
  countColoredRodSolutions,
  createColoredRodsPuzzle,
  findColoredRodConflict,
  isColoredRodSequenceValid,
} from './color-rods.model';

describe('color rods', () => {
  it('detects a repeated color at its exact level', () => {
    const first = rod('red', 'blue', 'green');
    const second = rod('yellow', 'blue', 'purple');

    expect(findColoredRodConflict(first, second)).toEqual({ level: 'milieu', color: 'blue' });
  });

  it('accepts only sequences with a color change at every level', () => {
    const validSequence = [rod('red', 'blue', 'green'), rod('blue', 'green', 'red')];
    const invalidSequence = [rod('red', 'blue', 'green'), rod('blue', 'blue', 'red')];

    expect(isColoredRodSequenceValid(validSequence)).toBe(true);
    expect(isColoredRodSequenceValid(invalidSequence)).toBe(false);
  });

  it('creates a shuffled puzzle with a guaranteed valid solution', () => {
    const puzzle = createColoredRodsPuzzle(() => 0.47);
    const rodsById = new Map(puzzle.rods.map((rod) => [rod.id, rod]));
    const solution = puzzle.solutionIds.map((rodId) => rodsById.get(rodId)!);

    expect(puzzle.rods).toHaveLength(6);
    expect(new Set(puzzle.rods.map((rod) => rod.id)).size).toBe(6);
    expect(solution.every((rod) => rod !== undefined)).toBe(true);
    expect(isColoredRodSequenceValid([puzzle.start, ...solution, puzzle.finish])).toBe(true);
    expect(countColoredRodSolutions(puzzle)).toBe(1);
    expect(puzzle.start.colors).toHaveLength(3);
    expect(puzzle.finish.colors).toHaveLength(3);
    expect(puzzle.start.colors.every((color) => COLORED_ROD_COLORS.includes(color))).toBe(true);
  });
});

function rod(
  top: ColoredRod['colors'][number],
  middle: ColoredRod['colors'][number],
  bottom: ColoredRod['colors'][number],
): ColoredRod {
  return { id: `${top}-${middle}-${bottom}`, colors: [top, middle, bottom] };
}
