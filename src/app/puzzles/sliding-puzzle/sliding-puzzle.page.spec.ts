import '@angular/compiler';
import { beforeEach, describe, expect, it } from 'vitest';
import { SlidingPuzzlePage } from './sliding-puzzle.page';

describe('SlidingPuzzlePage', () => {
  let page: any;

  beforeEach(() => {
    page = new SlidingPuzzlePage() as any;
  });

  it('considers identical image pieces equal when validating the board', () => {
    page.mode.set('image');
    page.hasStarted.set(true);
    page.imageTileSignatures.set([
      'same',
      'same',
      ...Array.from({ length: 13 }, (_, index) => `piece-${index + 3}`),
    ]);
    page.board.set([2, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]);

    expect(page.isSolved()).toBe(true);
  });

  it('keeps numeric validation based on the exact tile positions', () => {
    page.mode.set('numbers');
    page.hasStarted.set(true);
    page.board.set([2, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]);

    expect(page.isSolved()).toBe(false);
  });

  it('includes the piece number in image-mode labels when debug numbers are enabled', () => {
    page.mode.set('image');
    page.showImageTileNumbers.set(true);

    expect(page.tileLabel(7)).toBe('Morceau d’image 7, numéro 7');
  });
});
