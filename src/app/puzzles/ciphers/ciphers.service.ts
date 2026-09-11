import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RecentRandomPicker } from '../shared/recent-random-picker';
import {
  CREE_LEARNING_SYMBOLS,
  type CreeSyllabicCell,
  encodeFrenchTextAsEasternCree,
  encodeFrenchWordAsEasternCree,
} from './cree-syllabics.data';

export type CipherType =
  | 'caesar'
  | 'pigpen'
  | 'a1z26'
  | 'morse'
  | 'braille'
  | 'atbash'
  | 'tap-code'
  | 'semaphore'
  | 'nato'
  | 'cree-syllabics';

export type NatoMode = 'letter-to-code' | 'decode-word';

export type CreeMode = 'word' | 'symbol';

export type CipherPuzzle = {
  answer: string;
  normalizedAnswer: string;
  cipher: CipherType;
  encoded: string[];
  note: string;
  caesarShift: number | null;
  encodedReadings?: string[];
  encodedAudioKeys?: string[];
  romanApproximation?: string;
  answerChoices?: string[];
  morseDigitPractice?: MorseDigitPractice[];
};

export type CipherOption = {
  type: CipherType;
  label: string;
};

export type CipherLegendItem = {
  letter: string;
  symbol: string;
};

export type MorseDigitPractice = {
  digit: string;
  code: string;
};

export type CipherTransformStep = {
  type: CipherType;
  caesarShift?: number;
};

// Positions used by the semaphore drawings:
// 0 = gauche, 1 = haut-gauche, 2 = haut, 3 = haut-droite,
// 4 = droite, 5 = bas-droite, 6 = bas, 7 = bas-gauche.
export const SEMAPHORE_POSITIONS_BY_LETTER: Record<string, string> = {
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
};

export type SemaphoreOrientationGroup = {
  id: string;
  title: string;
  description: string;
  letters: readonly string[];
};

export const SEMAPHORE_ORIENTATION_GROUPS: readonly SemaphoreOrientationGroup[] = [
  {
    id: 'nearby-arms',
    title: 'Bras rapprochés',
    description: 'Les deux bras forment un angle de 45°.',
    letters: ['A', 'G', 'H', 'O', 'T', 'W', 'Z'],
  },
  {
    id: 'right-angle',
    title: 'Angle droit',
    description: 'Les bras forment un angle droit dans les directions principales.',
    letters: ['B', 'F', 'J', 'P'],
  },
  {
    id: 'shifted-right-angle',
    title: 'Angle droit décalé',
    description: 'Le même angle droit, tourné d’un cran de 45°.',
    letters: ['I', 'N', 'U', 'X'],
  },
  {
    id: 'wide-angle',
    title: 'Angle ouvert',
    description: 'Les deux bras forment un angle de 135°.',
    letters: ['C', 'E', 'K', 'M', 'Q', 'S', 'V', 'Y'],
  },
  {
    id: 'opposite-arms',
    title: 'Bras opposés',
    description: 'Les bras sont alignés en sens opposés.',
    letters: ['D', 'L', 'R'],
  },
];

@Injectable({
  providedIn: 'root',
})
export class CiphersService {
  private readonly http = inject(HttpClient);
  private readonly randomWords = new RecentRandomPicker<string>(50);
  private readonly randomCreeSymbols = new RecentRandomPicker<CreeSyllabicCell>(50);

  private words: string[] = [];

  readonly cipherOptions: CipherOption[] = [
    { type: 'caesar', label: 'César' },
    { type: 'pigpen', label: 'Pigpen' },
    { type: 'a1z26', label: 'A1Z26' },
    { type: 'morse', label: 'Morse' },
    { type: 'braille', label: 'Braille' },
    { type: 'atbash', label: 'Atbash' },
    { type: 'tap-code', label: 'Tap code' },
    { type: 'semaphore', label: 'Sémaphore' },
    { type: 'nato', label: 'NATO' },
    { type: 'cree-syllabics', label: 'Syllabique cri' },
  ];

  async loadWords(): Promise<void> {
    if (this.words.length > 0) {
      return;
    }

    const text = await firstValueFrom(
      this.http.get('words.txt', {
        responseType: 'text',
      }),
    );

    this.words = text
      .split(/\r?\n/)
      .map((word) => word.trim())
      .filter((word) => {
        const normalizedWord = this.normalize(word);
        return (
          normalizedWord.length >= 4 &&
          normalizedWord.length <= 12 &&
          /^[a-z]+$/.test(normalizedWord)
        );
      });
  }

  createPuzzle(
    cipher: CipherType,
    natoMode: NatoMode = 'letter-to-code',
    creeMode: CreeMode = 'word',
  ): CipherPuzzle {
    if (cipher === 'nato' && natoMode === 'letter-to-code') {
      return this.createNatoCodePuzzle();
    }

    if (cipher === 'cree-syllabics' && creeMode === 'symbol') {
      return this.createCreeSymbolPuzzle();
    }

    if (this.words.length === 0) {
      throw new Error('Cipher words have not been loaded yet.');
    }

    const wordPool = this.wordPoolFor(cipher);
    const answer = this.randomWords.pick(wordPool, (word) => `${cipher}:${this.normalize(word)}`);
    const normalizedAnswer = this.normalize(answer);
    const caesarShift = cipher === 'caesar' ? this.randomCaesarShift() : null;
    const creeEncoding = cipher === 'cree-syllabics' ? encodeFrenchWordAsEasternCree(answer) : null;
    const morseDigitPractice = cipher === 'morse' ? this.createMorseDigitPractice() : null;

    return {
      answer,
      normalizedAnswer,
      cipher,
      encoded: creeEncoding
        ? creeEncoding.tokens.map((token) => token.glyph)
        : this.encode(normalizedAnswer, cipher, caesarShift === null ? 0 : -caesarShift),
      note: this.noteFor(cipher, natoMode, creeMode),
      caesarShift,
      ...(creeEncoding
        ? {
            encodedReadings: creeEncoding.tokens.map((token) => token.reading),
            encodedAudioKeys: creeEncoding.tokens.map((token) => token.audioKey),
            romanApproximation: creeEncoding.roman,
          }
        : {}),
      ...(morseDigitPractice ? { morseDigitPractice } : {}),
    };
  }

  isCorrectAnswer(input: string, answer: string): boolean {
    return this.normalizeComparableAnswer(input) === this.normalizeComparableAnswer(answer);
  }

  legendFor(cipher: CipherType): CipherLegendItem[] {
    if (cipher === 'pigpen') {
      return this.createLegend(this.identityLetters);
    }

    if (cipher === 'morse') {
      return this.createLegend({ ...this.morseCodes, ...this.morseDigitCodes });
    }

    if (cipher === 'braille') {
      return this.createLegend(this.identityLetters);
    }

    if (cipher === 'tap-code') {
      return this.createLegend(this.tapCodeLetters);
    }

    if (cipher === 'semaphore') {
      return this.createLegend(this.semaphoreLetters);
    }

    if (cipher === 'nato') {
      return this.createLegend(this.natoWords);
    }

    return [];
  }

  normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toLowerCase();
  }

  transformText(value: string, steps: readonly CipherTransformStep[]): string {
    return steps.reduce((output, step) => this.transformStep(output, step), value);
  }

  private encode(word: string, cipher: CipherType, shift = 0): string[] {
    if (cipher === 'caesar') {
      return word.split('').map((letter) => this.shiftLetter(letter, shift));
    }

    if (cipher === 'pigpen') {
      return word.split('');
    }

    if (cipher === 'a1z26') {
      return word.split('').map((letter) => String(letter.charCodeAt(0) - 96));
    }

    if (cipher === 'morse') {
      return word.split('').map((letter) => this.morseCodes[letter] ?? letter);
    }

    if (cipher === 'braille') {
      return word.split('');
    }

    if (cipher === 'atbash') {
      return word.split('').map((letter) => this.atbashLetter(letter));
    }

    if (cipher === 'tap-code') {
      return word.split('').map((letter) => this.tapCodeLetters[letter] ?? letter);
    }

    if (cipher === 'semaphore') {
      return word.split('');
    }

    return word.split('').map((letter) => this.natoWords[letter] ?? letter);
  }

  private transformStep(value: string, step: CipherTransformStep): string {
    if (step.type === 'cree-syllabics') {
      return encodeFrenchTextAsEasternCree(value);
    }

    if (step.type === 'caesar') {
      const shift = Math.max(-25, Math.min(25, Math.trunc(step.caesarShift ?? 1)));
      return this.mapLetters(value, (letter) => this.shiftLetter(letter, shift).toUpperCase());
    }

    if (step.type === 'atbash') {
      return this.mapLetters(value, (letter) => this.atbashLetter(letter).toUpperCase());
    }

    if (step.type === 'a1z26') {
      return this.mapWordTokens(value, (letter) => String(letter.charCodeAt(0) - 96));
    }

    if (step.type === 'morse') {
      return this.mapWordTokens(value, (letter) => this.morseCodes[letter] ?? letter);
    }

    if (step.type === 'tap-code') {
      return this.mapWordTokens(value, (letter) => this.tapCodeLetters[letter] ?? letter);
    }

    if (step.type === 'nato') {
      return this.mapWordTokens(value, (letter) => this.natoWords[letter] ?? letter);
    }

    if (step.type === 'braille') {
      return this.mapWordTokens(value, (letter) => this.brailleSymbolFor(letter));
    }

    if (step.type === 'pigpen') {
      return this.mapWordTokens(value, (letter) => this.pigpenSymbols[letter] ?? letter);
    }

    return this.mapWordTokens(value, (letter) => this.semaphoreLetters[letter] ?? letter);
  }

  private mapLetters(value: string, map: (letter: string) => string): string {
    return this.removeDiacritics(value).replace(/[a-z]/gi, (letter) => map(letter.toLowerCase()));
  }

  private mapWordTokens(value: string, map: (letter: string) => string): string {
    return this.removeDiacritics(value)
      .split(/(\s+)/)
      .map((part) => {
        if (/^\s+$/.test(part)) {
          return ' / ';
        }

        return part.replace(/[a-z]+/gi, (word) =>
          word
            .toLowerCase()
            .split('')
            .map((letter) => map(letter))
            .join(' '),
        );
      })
      .join('');
  }

  private removeDiacritics(value: string): string {
    return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  private brailleSymbolFor(letter: string): string {
    const dots = this.brailleDotsByLetter[letter] ?? [];
    const codePoint = dots.reduce((code, dot) => code + 2 ** (dot - 1), 0x2800);
    return String.fromCodePoint(codePoint);
  }

  private shiftLetter(letter: string, shift: number): string {
    const alphabetIndex = letter.charCodeAt(0) - 97;
    const shiftedIndex = (((alphabetIndex + shift) % 26) + 26) % 26;
    return String.fromCharCode(shiftedIndex + 97);
  }

  private randomCaesarShift(): number {
    return -(Math.floor(Math.random() * 25) + 1);
  }

  private wordPoolFor(cipher: CipherType): string[] {
    if (cipher === 'tap-code') {
      return this.words.filter((word) => !this.normalize(word).includes('j'));
    }

    if (cipher === 'cree-syllabics') {
      return this.words.filter((word) => {
        const encoding = encodeFrenchWordAsEasternCree(word);
        return (
          encoding.tokens.length >= 2 &&
          encoding.tokens.length <= 12 &&
          encoding.tokens.some((token) => !token.isFinal)
        );
      });
    }

    return this.words;
  }

  private atbashLetter(letter: string): string {
    const alphabetIndex = letter.charCodeAt(0) - 97;
    return String.fromCharCode(122 - alphabetIndex);
  }

  private createLegend(symbolsByLetter: Record<string, string>): CipherLegendItem[] {
    return Object.entries(symbolsByLetter).map(([letter, symbol]) => ({
      letter: letter.toUpperCase(),
      symbol,
    }));
  }

  private createMorseDigitPractice(): MorseDigitPractice[] {
    const digits = Array.from({ length: 10 }, (_, index) => String(index));

    for (let index = digits.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [digits[index], digits[swapIndex]] = [digits[swapIndex], digits[index]];
    }

    return digits.slice(0, 3).map((digit) => ({
      digit,
      code: this.morseDigitCodes[digit],
    }));
  }

  private createNatoCodePuzzle(): CipherPuzzle {
    const letter = this.randomWords.pick(
      Object.keys(this.natoWords),
      (value) => `nato-code:${value}`,
    );
    const answer = this.natoWords[letter];

    return {
      answer,
      normalizedAnswer: this.normalizeComparableAnswer(answer),
      cipher: 'nato',
      encoded: [letter.toUpperCase()],
      note: 'Écris le mot-code NATO correspondant à la lettre affichée.',
      caesarShift: null,
    };
  }

  private createCreeSymbolPuzzle(): CipherPuzzle {
    const symbol = this.randomCreeSymbols.pick(
      CREE_LEARNING_SYMBOLS,
      (item) => `cree-symbol:${item.reading}:${item.glyph}`,
    );

    return {
      answer: symbol.reading,
      normalizedAnswer: this.normalizeComparableAnswer(symbol.reading),
      cipher: 'cree-syllabics',
      encoded: [symbol.glyph],
      note: 'Lis le symbole cri et choisis sa lecture romanisée parmi les réponses.',
      caesarShift: null,
      encodedReadings: [symbol.reading],
      encodedAudioKeys: [symbol.audioKey],
      romanApproximation: symbol.reading,
      answerChoices: this.createCreeSymbolChoices(symbol.reading),
    };
  }

  private createCreeSymbolChoices(correctReading: string): string[] {
    const readings = [...new Set(CREE_LEARNING_SYMBOLS.map((symbol) => symbol.reading))].filter(
      (reading) => reading !== correctReading,
    );

    for (let index = readings.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [readings[index], readings[swapIndex]] = [readings[swapIndex], readings[index]];
    }

    const choices = [correctReading, ...readings.slice(0, 3)];
    for (let index = choices.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [choices[index], choices[swapIndex]] = [choices[swapIndex], choices[index]];
    }

    return choices;
  }

  private normalizeComparableAnswer(value: string): string {
    return this.normalize(value).replace(/[^a-z0-9]/g, '');
  }

  private noteFor(cipher: CipherType, natoMode: NatoMode, creeMode: CreeMode): string {
    if (cipher === 'caesar') return 'Chaque lettre est décalée dans l’alphabet.';
    if (cipher === 'pigpen')
      return 'Chaque lettre est remplacée par un symbole de la grille Pigpen.';
    if (cipher === 'a1z26') return 'A=1, B=2, C=3, jusqu’à Z=26.';
    if (cipher === 'morse') return 'Points et traits : une case correspond à une lettre.';
    if (cipher === 'braille') return 'Chaque symbole braille correspond à une lettre de A à Z.';
    if (cipher === 'atbash')
      return 'Alphabet inverse : A devient Z, B devient Y, et ainsi de suite.';
    if (cipher === 'tap-code')
      return 'Chaque code indique la ligne et la colonne dans une grille 5 x 5. I et J partagent la même case.';
    if (cipher === 'semaphore') return 'Chaque lettre est montrée par deux positions de drapeaux.';
    if (cipher === 'cree-syllabics') {
      return creeMode === 'symbol'
        ? 'Lis le symbole cri et choisis sa lecture romanisée parmi les réponses.'
        : 'Lis les syllabes à l’oreille : le mot français est rapproché des sons du cri oriental du Sud.';
    }
    return natoMode === 'letter-to-code'
      ? 'Écris le mot-code NATO correspondant à la lettre affichée.'
      : 'Chaque lettre est remplacée par son mot de l’alphabet radio NATO.';
  }

  private readonly morseCodes: Record<string, string> = {
    a: '.-',
    b: '-...',
    c: '-.-.',
    d: '-..',
    e: '.',
    f: '..-.',
    g: '--.',
    h: '....',
    i: '..',
    j: '.---',
    k: '-.-',
    l: '.-..',
    m: '--',
    n: '-.',
    o: '---',
    p: '.--.',
    q: '--.-',
    r: '.-.',
    s: '...',
    t: '-',
    u: '..-',
    v: '...-',
    w: '.--',
    x: '-..-',
    y: '-.--',
    z: '--..',
  };

  private readonly morseDigitCodes: Record<string, string> = {
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

  private readonly tapCodeLetters: Record<string, string> = {
    a: '1-1',
    b: '1-2',
    c: '1-3',
    d: '1-4',
    e: '1-5',
    f: '2-1',
    g: '2-2',
    h: '2-3',
    i: '2-4',
    j: '2-4',
    k: '2-5',
    l: '3-1',
    m: '3-2',
    n: '3-3',
    o: '3-4',
    p: '3-5',
    q: '4-1',
    r: '4-2',
    s: '4-3',
    t: '4-4',
    u: '4-5',
    v: '5-1',
    w: '5-2',
    x: '5-3',
    y: '5-4',
    z: '5-5',
  };

  private readonly semaphoreLetters = SEMAPHORE_POSITIONS_BY_LETTER;

  private readonly brailleDotsByLetter: Record<string, number[]> = {
    a: [1],
    b: [1, 2],
    c: [1, 4],
    d: [1, 4, 5],
    e: [1, 5],
    f: [1, 2, 4],
    g: [1, 2, 4, 5],
    h: [1, 2, 5],
    i: [2, 4],
    j: [2, 4, 5],
    k: [1, 3],
    l: [1, 2, 3],
    m: [1, 3, 4],
    n: [1, 3, 4, 5],
    o: [1, 3, 5],
    p: [1, 2, 3, 4],
    q: [1, 2, 3, 4, 5],
    r: [1, 2, 3, 5],
    s: [2, 3, 4],
    t: [2, 3, 4, 5],
    u: [1, 3, 6],
    v: [1, 2, 3, 6],
    w: [2, 4, 5, 6],
    x: [1, 3, 4, 6],
    y: [1, 3, 4, 5, 6],
    z: [1, 3, 5, 6],
  };

  private readonly pigpenSymbols: Record<string, string> = {
    a: '┌',
    b: '┬',
    c: '┐',
    d: '├',
    e: '┼',
    f: '┤',
    g: '└',
    h: '┴',
    i: '┘',
    j: '┌•',
    k: '┬•',
    l: '┐•',
    m: '├•',
    n: '┼•',
    o: '┤•',
    p: '└•',
    q: '┴•',
    r: '┘•',
    s: '⌄',
    t: '<',
    u: '>',
    v: '⌃',
    w: '⌄•',
    x: '<•',
    y: '>•',
    z: '⌃•',
  };

  private readonly natoWords: Record<string, string> = {
    a: 'Alpha',
    b: 'Bravo',
    c: 'Charlie',
    d: 'Delta',
    e: 'Echo',
    f: 'Foxtrot',
    g: 'Golf',
    h: 'Hotel',
    i: 'India',
    j: 'Juliett',
    k: 'Kilo',
    l: 'Lima',
    m: 'Mike',
    n: 'November',
    o: 'Oscar',
    p: 'Papa',
    q: 'Quebec',
    r: 'Romeo',
    s: 'Sierra',
    t: 'Tango',
    u: 'Uniform',
    v: 'Victor',
    w: 'Whiskey',
    x: 'X-ray',
    y: 'Yankee',
    z: 'Zulu',
  };

  private readonly identityLetters: Record<string, string> = Object.fromEntries(
    'abcdefghijklmnopqrstuvwxyz'.split('').map((letter) => [letter, letter]),
  );
}
