import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZebraPage } from './zebra.page';

describe('ZebraPage', () => {
  let page: any;

  beforeEach(() => {
    page = new ZebraPage() as any;
  });

  it('supports the new spatial deduction types', () => {
    const assignments = {
      person: { Nora: 0, Omar: 2 },
      color: { Orange: 1, Violette: 2 },
    };

    expect(
      page.clueMatches(
        {
          type: 'adjacent',
          firstCategoryId: 'person',
          firstValue: 'Nora',
          secondCategoryId: 'color',
          secondValue: 'Orange',
          text: '',
        },
        assignments,
      ),
    ).toBe(true);
    expect(
      page.clueMatches(
        {
          type: 'leftOf',
          leftCategoryId: 'person',
          leftValue: 'Nora',
          rightCategoryId: 'color',
          rightValue: 'Violette',
          text: '',
        },
        assignments,
      ),
    ).toBe(true);
    expect(
      page.clueMatches(
        {
          type: 'oneBetween',
          firstCategoryId: 'person',
          firstValue: 'Nora',
          secondCategoryId: 'color',
          secondValue: 'Violette',
          text: '',
        },
        assignments,
      ),
    ).toBe(true);
  });

  it('rejects spatial relations that do not match the positions', () => {
    const assignments = {
      person: { Nora: 0, Omar: 2 },
      color: { Orange: 1, Violette: 2 },
    };

    expect(
      page.clueMatches(
        {
          type: 'adjacent',
          firstCategoryId: 'person',
          firstValue: 'Nora',
          secondCategoryId: 'color',
          secondValue: 'Violette',
          text: '',
        },
        assignments,
      ),
    ).toBe(false);
    expect(
      page.clueMatches(
        {
          type: 'leftOf',
          leftCategoryId: 'person',
          leftValue: 'Omar',
          rightCategoryId: 'color',
          rightValue: 'Orange',
          text: '',
        },
        assignments,
      ),
    ).toBe(false);
    expect(
      page.clueMatches(
        {
          type: 'oneBetween',
          firstCategoryId: 'person',
          firstValue: 'Nora',
          secondCategoryId: 'color',
          secondValue: 'Orange',
          text: '',
        },
        assignments,
      ),
    ).toBe(false);
  });

  it('generates candidates for every deduction type and keeps a unique solution', () => {
    const puzzle = page.puzzle();
    const candidates = page.createCandidateClues(puzzle.categories, puzzle.solution);
    const candidateTypes = new Set(candidates.map((clue: any) => clue.type));

    expect(candidateTypes).toEqual(
      new Set([
        'same',
        'notSame',
        'position',
        'notPosition',
        'adjacentRight',
        'adjacent',
        'leftOf',
        'oneBetween',
      ]),
    );
    expect(page.countMatchingSolutions(puzzle.categories, puzzle.logicalClues, 2)).toBe(1);
  });

  it('removes a direct clue when spatial clues already force the solution', () => {
    const categories = [
      { id: 'house', label: 'Maison', values: ['Maison 1', 'Maison 2', 'Maison 3'] },
      { id: 'person', label: 'Personne', values: ['Alice', 'Bruno', 'Clara'] },
      { id: 'color', label: 'Couleur', values: ['Rouge', 'Bleu', 'Vert'] },
    ];
    const spatialClues = [
      {
        type: 'adjacentRight',
        leftCategoryId: 'person',
        leftValue: 'Alice',
        rightCategoryId: 'color',
        rightValue: 'Bleu',
        text: '',
      },
      {
        type: 'adjacentRight',
        leftCategoryId: 'person',
        leftValue: 'Bruno',
        rightCategoryId: 'color',
        rightValue: 'Vert',
        text: '',
      },
      {
        type: 'oneBetween',
        firstCategoryId: 'person',
        firstValue: 'Alice',
        secondCategoryId: 'color',
        secondValue: 'Vert',
        text: '',
      },
    ];
    const directClue = {
      type: 'position',
      categoryId: 'person',
      value: 'Alice',
      houseIndex: 0,
      text: '',
    };

    const compactClues = page.removeRedundantDirectClues(
      [...spatialClues, directClue],
      categories,
    );

    expect(compactClues).toHaveLength(spatialClues.length);
    expect(compactClues.every((clue: any) => page.isSpatialClue(clue))).toBe(true);
  });

  it('keeps a unique solution at every grid size', () => {
    for (const level of [3, 4, 5]) {
      page.setLevel(level);
      const puzzle = page.puzzle();

      expect(page.countMatchingSolutions(puzzle.categories, puzzle.logicalClues, 2)).toBe(1);
    }
  });

  it('toggles used clues and clears them when restarting', () => {
    expect(page.isClueUsed(0)).toBe(false);

    page.toggleClue(0);
    expect(page.isClueUsed(0)).toBe(true);

    page.toggleClue(0);
    expect(page.isClueUsed(0)).toBe(false);

    page.toggleClue(1);
    expect(page.isClueUsed(1)).toBe(true);

    page.resetPuzzle();
    expect(page.isClueUsed(1)).toBe(false);
  });

  it('uses house-based wording for spatial clues', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    try {
      expect(page.describeLeftOfClue({ id: 'person' }, 'Félix', { id: 'pet' }, 'Hamster')).toBe(
        'La maison de Félix se trouve quelque part à gauche de la maison où vit le hamster.',
      );
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('makes one-between clues explicit for small grids', () => {
    const randomSpy = vi.spyOn(Math, 'random');

    try {
      for (const randomValue of [0, 0.2, 0.4, 0.6, 0.8]) {
        randomSpy.mockReturnValue(randomValue);

        expect(
          page.describeOneBetweenClue(
            { id: 'color' },
            'Violette',
            { id: 'person' },
            'Bruno',
          ),
        ).toMatch(/une seule maison/i);
      }
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('keeps every spatial clue anchored to house positions', () => {
    const randomSpy = vi.spyOn(Math, 'random');

    try {
      for (const randomValue of [0, 0.2, 0.4, 0.6, 0.8, 0.999]) {
        randomSpy.mockReturnValue(randomValue);

        const clues = [
          page.describeAdjacentClue({ id: 'person' }, 'Félix', { id: 'pet' }, 'Hamster'),
          page.describeNeighborClue({ id: 'person' }, 'Félix', { id: 'pet' }, 'Hamster'),
          page.describeLeftOfClue({ id: 'person' }, 'Félix', { id: 'pet' }, 'Hamster'),
          page.describeOneBetweenClue({ id: 'person' }, 'Félix', { id: 'pet' }, 'Hamster'),
        ];

        expect(clues.every((clue: string) => clue.toLowerCase().includes('maison'))).toBe(true);
        expect(
          clues.every(
            (clue: string) => clue.includes('Félix') && clue.toLowerCase().includes('hamster'),
          ),
        ).toBe(true);
        expect(clues.some((clue: string) => /Félix (précède|est) le hamster/i.test(clue))).toBe(
          false,
        );
      }
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('spells out direction and distance in spatial hint explanations', () => {
    expect(
      page.explainClueRule({
        type: 'adjacentRight',
        leftCategoryId: 'person',
        leftValue: 'Félix',
        rightCategoryId: 'pet',
        rightValue: 'Hamster',
        text: '',
      }),
    ).toContain('le numéro de droite vaut celui de gauche + 1');
    expect(
      page.explainClueRule({
        type: 'adjacent',
        firstCategoryId: 'person',
        firstValue: 'Félix',
        secondCategoryId: 'pet',
        secondValue: 'Hamster',
        text: '',
      }),
    ).toContain('leurs numéros diffèrent de 1');
    expect(
      page.explainClueRule({
        type: 'oneBetween',
        firstCategoryId: 'person',
        firstValue: 'Félix',
        secondCategoryId: 'pet',
        secondValue: 'Hamster',
        text: '',
      }),
    ).toContain('leurs numéros diffèrent exactement de 2');
  });

  it('uses natural articles for drinks and hobbies', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    try {
      expect(page.describeSameClue({ id: 'person' }, 'Félix', { id: 'drink' }, 'Cafe')).toBe(
        'Félix boit du café.',
      );
      expect(page.describeSameClue({ id: 'person' }, 'Félix', { id: 'hobby' }, 'Jardin')).toBe(
        'Félix pratique le jardinage.',
      );
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('explains a direct hint with numbered, actionable steps', () => {
    const categories = [
      { id: 'house', label: 'Maison', values: ['Maison 1', 'Maison 2', 'Maison 3'] },
      { id: 'person', label: 'Personne', values: ['Alice', 'Bruno', 'Clara'] },
      { id: 'color', label: 'Couleur', values: ['Rouge', 'Bleu', 'Vert'] },
    ];
    const directClue = {
      type: 'same',
      firstCategoryId: 'person',
      firstValue: 'Alice',
      secondCategoryId: 'color',
      secondValue: 'Rouge',
      text: 'Alice habite la maison rouge.',
    };

    page.activePuzzle.set({
      level: 3,
      title: 'Test',
      intro: '',
      positions: categories[0].values,
      categories,
      clues: [directClue.text],
      logicalClues: [directClue],
      solution: [
        { house: 'Maison 1', person: 'Alice', color: 'Rouge' },
        { house: 'Maison 2', person: 'Bruno', color: 'Bleu' },
        { house: 'Maison 3', person: 'Clara', color: 'Vert' },
      ],
    });

    page.showHint();

    expect(page.hintMessage()).toContain('Indice utilisé :');
    expect(page.hintMessage()).toContain('« Alice habite la maison rouge. »');
    expect(page.hintMessage()).toContain('1. Cet indice affirme');
    expect(page.hintMessage()).toContain('Conclusion :');
    expect(page.hintMessage()).toContain('✓');
  });

  it('names every clue used for a multi-step deduction', () => {
    const categories = [
      { id: 'house', label: 'Maison', values: ['Maison 1', 'Maison 2', 'Maison 3'] },
      { id: 'person', label: 'Personne', values: ['Alice', 'Bruno', 'Clara'] },
      { id: 'color', label: 'Couleur', values: ['Rouge', 'Bleu', 'Vert'] },
      { id: 'pet', label: 'Animal', values: ['Chat', 'Chien', 'Oiseau'] },
    ];
    const logicalClues = [
      {
        type: 'same',
        firstCategoryId: 'person',
        firstValue: 'Alice',
        secondCategoryId: 'color',
        secondValue: 'Rouge',
        text: 'Alice habite la maison rouge.',
      },
      {
        type: 'same',
        firstCategoryId: 'color',
        firstValue: 'Rouge',
        secondCategoryId: 'pet',
        secondValue: 'Chat',
        text: 'Le chat vit dans la maison rouge.',
      },
    ];

    page.activePuzzle.set({
      level: 3,
      title: 'Test',
      intro: '',
      positions: categories[0].values,
      categories,
      clues: logicalClues.map((clue) => clue.text),
      logicalClues,
      solution: [
        { house: 'Maison 1', person: 'Alice', color: 'Rouge', pet: 'Chat' },
        { house: 'Maison 2', person: 'Bruno', color: 'Bleu', pet: 'Chien' },
        { house: 'Maison 3', person: 'Clara', color: 'Vert', pet: 'Oiseau' },
      ],
    });

    const explanation = page.explainHint({
      firstCategory: categories[1],
      firstValue: 'Alice',
      secondCategory: categories[3],
      secondValue: 'Chat',
    });

    expect(explanation).toContain('Indices à combiner :');
    expect(explanation).toContain('« Alice habite la maison rouge. »');
    expect(explanation).toContain('« Le chat vit dans la maison rouge. »');
    expect(explanation).toContain('Chacune de ces possibilités crée une contradiction');
    expect(explanation).toContain('Conclusion : seule « Chat » reste possible');
  });

  it('allows only one three-clue support before requiring shorter hints', () => {
    const categories = [
      { id: 'house', label: 'Maison', values: ['Maison 1', 'Maison 2', 'Maison 3'] },
      { id: 'person', label: 'Personne', values: ['Alice', 'Bruno', 'Clara'] },
      { id: 'color', label: 'Couleur', values: ['Rouge', 'Bleu', 'Vert'] },
      { id: 'pet', label: 'Animal', values: ['Chat', 'Chien', 'Oiseau'] },
      { id: 'hobby', label: 'Loisir', values: ['Échecs', 'Peinture', 'Course'] },
    ];
    const logicalClues = [
      {
        type: 'same',
        firstCategoryId: 'person',
        firstValue: 'Alice',
        secondCategoryId: 'color',
        secondValue: 'Rouge',
        text: 'Alice habite la maison rouge.',
      },
      {
        type: 'same',
        firstCategoryId: 'color',
        firstValue: 'Rouge',
        secondCategoryId: 'pet',
        secondValue: 'Chat',
        text: 'Le chat vit dans la maison rouge.',
      },
      {
        type: 'same',
        firstCategoryId: 'pet',
        firstValue: 'Chat',
        secondCategoryId: 'hobby',
        secondValue: 'Échecs',
        text: 'La personne qui joue aux échecs a le chat.',
      },
    ];

    page.activePuzzle.set({
      level: 5,
      title: 'Test',
      intro: '',
      positions: categories[0].values,
      categories,
      clues: logicalClues.map((clue) => clue.text),
      logicalClues,
      solution: [
        {
          house: 'Maison 1',
          person: 'Alice',
          color: 'Rouge',
          pet: 'Chat',
          hobby: 'Échecs',
        },
        {
          house: 'Maison 2',
          person: 'Bruno',
          color: 'Bleu',
          pet: 'Chien',
          hobby: 'Peinture',
        },
        {
          house: 'Maison 3',
          person: 'Clara',
          color: 'Vert',
          pet: 'Oiseau',
          hobby: 'Course',
        },
      ],
    });

    const relation = {
      firstCategory: categories[1],
      firstValue: 'Alice',
      secondCategory: categories[4],
      secondValue: 'Échecs',
    };

    expect(page.supportingCluesFor(relation)).toHaveLength(3);

    page.complexHintCount = 1;
    expect(page.supportingCluesFor(relation)).toBeNull();
  });

  it('keeps finding a hint through several 4x4 game states', () => {
    for (let puzzleIndex = 0; puzzleIndex < 3; puzzleIndex += 1) {
      page.setLevel(4);

      for (let hintIndex = 0; hintIndex < 20; hintIndex += 1) {
        page.showHint();
        const message = page.hintMessage() ?? '';

        expect(message).not.toContain('Les indices restants ne donnent pas');

        if (page.isSolved()) {
          break;
        }
      }
    }
  });
});
