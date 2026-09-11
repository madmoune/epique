import '@angular/compiler';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CiphersService,
  SEMAPHORE_ORIENTATION_GROUPS,
  SEMAPHORE_POSITIONS_BY_LETTER,
} from './ciphers.service';

describe('CiphersService NATO modes', () => {
  let service: CiphersService;

  beforeEach(() => {
    const testService = Object.create(CiphersService.prototype) as any;
    testService.words = ['chat'];
    testService.randomWords = {
      pick: (items: readonly string[]) => items[0],
    };
    testService.randomCreeSymbols = {
      pick: (items: readonly any[]) => items[0],
    };
    testService.natoWords = {
      a: 'Alpha',
      c: 'Charlie',
      h: 'Hotel',
      t: 'Tango',
      x: 'X-ray',
    };
    service = testService as CiphersService;
  });

  it('uses letter-to-code as the default NATO mode', () => {
    (service as any).words = [];
    const puzzle = service.createPuzzle('nato');

    expect(puzzle).toEqual({
      answer: 'Alpha',
      normalizedAnswer: 'alpha',
      cipher: 'nato',
      encoded: ['A'],
      note: 'Écris le mot-code NATO correspondant à la lettre affichée.',
      caesarShift: null,
    });
  });

  it('keeps the existing NATO word-decoding mode', () => {
    const puzzle = service.createPuzzle('nato', 'decode-word');

    expect(puzzle.answer).toBe('chat');
    expect(puzzle.encoded).toEqual(['Charlie', 'Hotel', 'Alpha', 'Tango']);
  });

  it('adds three distinct digit codes to Morse puzzles and their legend', () => {
    const morseDigitCodes = {
      '0': '-----',
      '1': '.----',
      '2': '..---',
      '3': '...--',
      '4': '....-',
      '5': '.....',
      '6': '-....',
      '7': '--...',
      '8': '---..',
      '9': '----.',
    };
    const testService = service as any;
    testService.morseCodes = { c: '-.-.', h: '....', a: '.-', t: '-' };
    testService.morseDigitCodes = morseDigitCodes;

    const puzzle = service.createPuzzle('morse');
    const practice = puzzle.morseDigitPractice ?? [];

    expect(practice).toHaveLength(3);
    expect(new Set(practice.map((item: { digit: string }) => item.digit)).size).toBe(3);
    expect(
      practice.every(
        (item: { digit: string; code: string }) =>
          item.code === morseDigitCodes[item.digit as keyof typeof morseDigitCodes],
      ),
    ).toBe(true);
    expect(
      service.legendFor('morse').filter((item: { letter: string }) => /^\d$/.test(item.letter)),
    ).toEqual(
      Object.entries(morseDigitCodes).map(([letter, symbol]) => ({
        letter,
        symbol,
      })),
    );
  });

  it('accepts NATO codes regardless of case or hyphen', () => {
    expect(service.isCorrectAnswer('xray', 'xray')).toBe(true);
    expect(service.isCorrectAnswer('X-Ray', 'xray')).toBe(true);
    expect(service.isCorrectAnswer('x ray', 'xray')).toBe(true);
  });

  it('applies text transformer steps in order', () => {
    expect(
      service.transformText('abc', [{ type: 'caesar', caesarShift: 1 }, { type: 'atbash' }]),
    ).toBe('YXW');
    expect(service.transformText('Été', [{ type: 'a1z26' }])).toBe('5 20 5');
  });

  it('creates a syllabic puzzle from the sound of a words.txt entry', () => {
    (service as any).words = ['vtt', 'canotage'];

    const puzzle = service.createPuzzle('cree-syllabics');

    expect(puzzle.answer).toBe('canotage');
    expect(puzzle.encoded.join('')).toBe('ᑳᓍᑖᔥ');
    expect(puzzle.encodedReadings).toEqual(['kaa', 'nwaa', 'taa', 'sh']);
    expect(puzzle.romanApproximation).toBe('kaa·nwaa·taa·sh');
  });

  it('creates a one-symbol syllabic practice puzzle', () => {
    const puzzle = service.createPuzzle('cree-syllabics', 'letter-to-code', 'symbol');

    expect(puzzle.answer).toBe('e');
    expect(puzzle.encoded).toEqual(['ᐁ']);
    expect(puzzle.encodedReadings).toEqual(['e']);
    expect(puzzle.encodedAudioKeys).toEqual(['e']);
    expect(puzzle.note).toBe(
      'Lis le symbole cri et choisis sa lecture romanisée parmi les réponses.',
    );
    expect(puzzle.answerChoices).toHaveLength(4);
    expect(puzzle.answerChoices).toContain('e');
    expect(new Set(puzzle.answerChoices).size).toBe(4);
  });
});

describe('Semaphore positions', () => {
  it('uses the standard A-Z flag combinations', () => {
    expect(SEMAPHORE_POSITIONS_BY_LETTER).toEqual({
      a: '6,7',
      b: '0,6',
      c: '1,6',
      d: '2,6',
      e: '3,6',
      f: '4,6',
      g: '5,6',
      h: '0,7',
      i: '1,7',
      j: '2,4',
      k: '2,7',
      l: '3,7',
      m: '4,7',
      n: '5,7',
      o: '0,1',
      p: '0,2',
      q: '0,3',
      r: '0,4',
      s: '0,5',
      t: '1,2',
      u: '1,3',
      v: '2,5',
      w: '3,4',
      x: '3,5',
      y: '1,4',
      z: '4,5',
    });
  });

  it('groups all semaphore letters by similar arm orientations', () => {
    const groupedLetters = SEMAPHORE_ORIENTATION_GROUPS.flatMap((group) => group.letters);

    expect(groupedLetters).toHaveLength(26);
    expect(new Set(groupedLetters).size).toBe(26);
    expect(
      SEMAPHORE_ORIENTATION_GROUPS.find((group) => group.id === 'right-angle')?.letters,
    ).toEqual(['B', 'F', 'J', 'P']);
    expect(
      SEMAPHORE_ORIENTATION_GROUPS.find((group) => group.id === 'shifted-right-angle')?.letters,
    ).toEqual(['I', 'N', 'U', 'X']);
  });
});
