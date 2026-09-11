import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  CustomKeyboardComponent,
  CustomKeyboardKey,
} from '../shared/custom-keyboard/custom-keyboard.component';
import { PuzzleSuccessPopupComponent } from '../shared/puzzle-success-popup/puzzle-success-popup.component';
import { CreeSyllabicsAudioService } from './cree-syllabics-audio.service';
import { CreeSyllabicsLegendComponent } from './cree-syllabics-legend.component';
import {
  CipherLegendItem,
  CipherPuzzle,
  CipherType,
  CiphersService,
  CreeMode,
  NatoMode,
  SEMAPHORE_ORIENTATION_GROUPS,
  SEMAPHORE_POSITIONS_BY_LETTER,
} from './ciphers.service';

@Component({
  selector: 'app-ciphers-page',
  imports: [
    RouterLink,
    PuzzleSuccessPopupComponent,
    CustomKeyboardComponent,
    CreeSyllabicsLegendComponent,
  ],
  templateUrl: './ciphers.page.html',
  styleUrl: './ciphers.page.scss',
})
export class CiphersPage implements OnDestroy {
  @ViewChild('answerField')
  private readonly answerField?: ElementRef<HTMLInputElement>;
  @ViewChildren('letterField')
  private readonly letterFields?: QueryList<ElementRef<HTMLInputElement>>;
  private suppressNextSelection = false;

  private readonly route = inject(ActivatedRoute);
  private readonly ciphersService = inject(CiphersService);
  private readonly creeAudio = inject(CreeSyllabicsAudioService);

  protected readonly selectedCipher = signal<CipherType>('caesar');
  protected readonly natoMode = signal<NatoMode>('letter-to-code');
  protected readonly creeMode = signal<CreeMode>('word');
  protected readonly puzzle = signal<CipherPuzzle | null>(null);
  protected readonly answerInput = signal('');
  protected readonly answerLetters = signal<string[]>([]);
  protected readonly letterByLetter = signal(true);
  protected readonly activeLetterIndex = signal(0);
  protected readonly revealedLetterIndex = signal<number | null>(null);
  protected readonly revealedMorseDigitIndex = signal<number | null>(null);
  protected readonly hintLevel = signal(0);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly keyboardVisible = signal(false);
  protected readonly letterKeyboardRows: CustomKeyboardKey[][] = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'backspace'],
    ['clear'],
  ];
  protected readonly pigpenSquareKeys = [
    [
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
      ['G', 'H', 'I'],
    ],
    [
      ['J', 'K', 'L'],
      ['M', 'N', 'O'],
      ['P', 'Q', 'R'],
    ],
  ];
  protected readonly pigpenXKeys = [
    { top: 'S', right: 'U', bottom: 'V', left: 'T', dotted: false },
    { top: 'W', right: 'Y', bottom: 'Z', left: 'X', dotted: true },
  ];
  protected readonly tapCodeGrid = [
    ['A', 'B', 'C', 'D', 'E'],
    ['F', 'G', 'H', 'I/J', 'K'],
    ['L', 'M', 'N', 'O', 'P'],
    ['Q', 'R', 'S', 'T', 'U'],
    ['V', 'W', 'X', 'Y', 'Z'],
  ];
  private revealTimer: number | null = null;

  protected readonly isCorrect = computed(() => {
    const puzzle = this.puzzle();
    return puzzle
      ? this.ciphersService.isCorrectAnswer(this.answerInput(), puzzle.normalizedAnswer)
      : false;
  });

  protected readonly selectedCipherLabel = computed(
    () =>
      this.ciphersService.cipherOptions.find((option) => option.type === this.selectedCipher())
        ?.label ?? 'Cipher',
  );

  protected readonly isNatoLetterMode = computed(
    () => this.selectedCipher() === 'nato' && this.natoMode() === 'letter-to-code',
  );

  protected readonly isCreeSyllabics = computed(() => this.selectedCipher() === 'cree-syllabics');
  protected readonly isCreeSymbolMode = computed(
    () => this.isCreeSyllabics() && this.creeMode() === 'symbol',
  );

  protected readonly introText = computed(() => {
    if (this.isNatoLetterMode()) {
      return 'Trouve le mot-code de l’alphabet radio NATO correspondant à la lettre affichée.';
    }

    if (this.isCreeSyllabics()) {
      return this.isCreeSymbolMode()
        ? 'Entraîne-toi à reconnaître une syllabe crie à la fois.'
        : 'Retrouve le mot français transcrit à l’oreille avec les caractères syllabiques cris.';
    }

    return 'Retrouve le mot de la liste après transformation par un cipher simple.';
  });

  protected readonly cipherLegend = computed(() =>
    this.ciphersService.legendFor(this.selectedCipher()),
  );
  protected readonly semaphoreLegend: CipherLegendItem[] =
    this.ciphersService.legendFor('semaphore');
  protected readonly semaphoreOrientationGroups = SEMAPHORE_ORIENTATION_GROUPS.map((group) => ({
    ...group,
    items: this.semaphoreItemsFor(group.letters),
  }));

  protected readonly hintText = computed(() => {
    const puzzle = this.puzzle();
    if (!puzzle || this.hintLevel() === 0) {
      return '';
    }

    return `Indice: ${this.partialWordHint(puzzle)}`;
  });

  protected readonly maxHintLevel = computed(() => this.puzzle()?.normalizedAnswer.length ?? 0);

  protected pigpenSymbolClass(letter: string): string {
    const normalizedLetter = letter.toLowerCase();
    const baseClass = this.pigpenBaseClasses[normalizedLetter] ?? '';
    const dottedClass = this.pigpenHasDot(normalizedLetter) ? ' dotted' : '';

    return `pigpen-symbol ${baseClass}${dottedClass}`;
  }

  protected pigpenHasDot(letter: string): boolean {
    return /^[j-rw-z]$/.test(letter.toLowerCase());
  }

  protected isBrailleDotActive(letter: string, dot: number): boolean {
    return this.brailleDotsByLetter[letter.toLowerCase()]?.includes(dot) ?? false;
  }

  protected semaphoreArmClassesForLetter(letter: string): string[] {
    return this.semaphoreArmClasses(this.semaphorePositionsByLetter[letter.toLowerCase()] ?? '');
  }

  protected semaphoreArmClasses(symbol: string): string[] {
    return symbol
      .split(',')
      .map((position) => position.trim())
      .filter(Boolean)
      .map((position) => `position-${position}`);
  }

  private semaphoreItemsFor(letters: readonly string[]): CipherLegendItem[] {
    return letters.flatMap((letter) => {
      const item = this.semaphoreLegend.find((candidate) => candidate.letter === letter);
      return item ? [item] : [];
    });
  }

  protected handleLegendClick(): void {
    if (this.isCreeSyllabics()) {
      this.hideKeyboard();
    }
  }

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const nextCipher = this.cipherFromRoute(params.get('cipher'));

      if (this.selectedCipher() === nextCipher) {
        return;
      }

      this.selectedCipher.set(nextCipher);
      if (nextCipher === 'nato') {
        this.natoMode.set('letter-to-code');
        this.letterByLetter.set(false);
      }

      if (!this.isLoading() && !this.loadError()) {
        this.nextPuzzle();
      }
    });

    void this.loadPuzzle();
  }

  protected updateAnswer(value: string): void {
    this.answerInput.set(value);
  }

  protected setNatoMode(mode: NatoMode): void {
    if (this.natoMode() === mode) return;

    this.natoMode.set(mode);
    if (mode === 'letter-to-code') {
      this.letterByLetter.set(false);
    }
    this.nextPuzzle();
  }

  protected setCreeMode(mode: CreeMode): void {
    if (this.creeMode() === mode) return;

    this.creeMode.set(mode);
    // A symbol reading can contain several roman letters, so the compact
    // full-answer field is more useful than one input per character here.
    this.letterByLetter.set(mode === 'word');
    this.nextPuzzle();
  }

  protected chooseCreeAnswer(choice: string): void {
    if (!this.isCreeSymbolMode() || this.isCorrect()) return;

    this.answerInput.set(choice);
    this.keyboardVisible.set(false);
  }

  protected updateAnswerFromEvent(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.updateAnswer(event.target.value);
    }
  }

  protected toggleInputMode(): void {
    const nextMode = !this.letterByLetter();

    if (nextMode) {
      const length = this.puzzle()?.normalizedAnswer.length ?? 0;
      const letters = this.lettersFromValue(this.answerInput(), length);
      this.answerLetters.set(letters);
      this.letterByLetter.set(true);

      const firstEmptyIndex = letters.findIndex((letter) => !letter);
      this.focusLetterField(firstEmptyIndex >= 0 ? firstEmptyIndex : Math.max(0, length - 1));
      return;
    }

    this.answerInput.set(this.answerLetters().join(''));
    this.letterByLetter.set(false);
    this.focusAnswerField(false);
  }

  protected updateAnswerLetterFromEvent(event: Event, index: number): void {
    if (!(event.target instanceof HTMLInputElement)) return;

    const letter = event.target.value
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 1);
    this.setAnswerLetter(index, letter);
    event.target.value = letter;

    if (letter && index < this.answerLetters().length - 1) {
      this.focusLetterField(index + 1);
    }
  }

  protected selectLetterInput(event: Event, index: number): void {
    this.activeLetterIndex.set(index);
    this.keyboardVisible.set(true);

    if (event.target instanceof HTMLInputElement) {
      event.target.select();
    }
  }

  protected handleAnswerLetterKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.focusLetterField(index - 1);
      return;
    }

    if (event.key === 'ArrowRight' && index < this.answerLetters().length - 1) {
      event.preventDefault();
      this.focusLetterField(index + 1);
      return;
    }

    if (event.key === 'Backspace' && !this.answerLetters()[index] && index > 0) {
      event.preventDefault();
      this.setAnswerLetter(index - 1, '');
      this.focusLetterField(index - 1);
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      this.setAnswerLetter(index, '');
    }
  }

  protected revealLetter(index: number): void {
    this.revealedLetterIndex.set(index);
    this.revealedMorseDigitIndex.set(null);

    this.startRevealTimer();
  }

  protected revealMorseDigit(index: number): void {
    this.revealedLetterIndex.set(null);
    this.revealedMorseDigitIndex.set(index);

    this.startRevealTimer();
  }

  protected isMorseDigitRevealed(index: number): boolean {
    return this.revealedMorseDigitIndex() === index;
  }

  private startRevealTimer(): void {
    if (this.revealTimer !== null) {
      window.clearTimeout(this.revealTimer);
    }

    this.revealTimer = window.setTimeout(() => {
      this.revealedLetterIndex.set(null);
      this.revealedMorseDigitIndex.set(null);
      this.revealTimer = null;
    }, 3000);
  }

  protected isLetterRevealed(index: number): boolean {
    return this.revealedLetterIndex() === index;
  }

  protected revealedLetterFor(puzzle: CipherPuzzle, index: number): string {
    return puzzle.normalizedAnswer[index]?.toUpperCase() ?? '';
  }

  protected creeReadingFor(puzzle: CipherPuzzle, index: number): string {
    return puzzle.encodedReadings?.[index] ?? '';
  }

  protected playCreeToken(puzzle: CipherPuzzle, index: number): void {
    this.revealLetter(index);
    const audioKey = puzzle.encodedAudioKeys?.[index];
    if (audioKey) {
      void this.creeAudio.play(audioKey);
    }
  }

  protected handleKeyboardKey(key: CustomKeyboardKey): void {
    if (this.isCorrect()) return;

    if (this.letterByLetter()) {
      this.handleLetterKeyboardKey(key);
      return;
    }

    if (key === 'backspace') {
      this.answerInput.update((answer) => answer.slice(0, -1));
      this.focusAnswerField(false);
      return;
    }

    if (key === 'clear') {
      this.answerInput.set('');
      this.focusAnswerField(false);
      return;
    }

    if (key === 'space') return;

    this.answerInput.update((answer) => `${answer}${key}`);
    this.focusAnswerField(false);
  }

  protected selectInputContent(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.keyboardVisible.set(true);
      if (this.suppressNextSelection) {
        this.suppressNextSelection = false;
        return;
      }
      event.target.select();
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  protected hideKeyboardWhenClickingAway(event: PointerEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (
      target.closest('.cipher-workspace') ||
      target.closest('button') ||
      target.closest('app-custom-keyboard') ||
      target.closest('app-puzzle-success-popup')
    ) {
      return;
    }
    this.keyboardVisible.set(false);
  }

  protected showHint(): void {
    this.hintLevel.update((level) => Math.min(level + 1, this.maxHintLevel()));
  }

  protected hideKeyboard(): void {
    this.keyboardVisible.set(false);
  }

  protected nextPuzzle(): void {
    this.clearReveal();
    const nextPuzzle = this.ciphersService.createPuzzle(
      this.selectedCipher(),
      this.natoMode(),
      this.creeMode(),
    );
    this.puzzle.set(nextPuzzle);
    this.answerInput.set('');
    this.answerLetters.set(Array.from({ length: nextPuzzle.normalizedAnswer.length }, () => ''));
    this.activeLetterIndex.set(0);
    this.hintLevel.set(0);

    if (this.letterByLetter()) {
      this.focusLetterField(0);
    } else {
      this.focusAnswerField(false);
    }
  }

  ngOnDestroy(): void {
    this.clearReveal();
    this.creeAudio.stop();
  }

  private clearReveal(): void {
    if (this.revealTimer !== null) {
      window.clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }

    this.revealedLetterIndex.set(null);
    this.revealedMorseDigitIndex.set(null);
  }

  private async loadPuzzle(): Promise<void> {
    try {
      await this.ciphersService.loadWords();
      this.selectedCipher.set(this.cipherFromRoute(this.route.snapshot.paramMap.get('cipher')));
      this.nextPuzzle();
    } catch {
      this.loadError.set('Impossible de charger la liste de mots codés.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private focusAnswerField(selectOnFocus = true): void {
    this.suppressNextSelection = !selectOnFocus;
    window.setTimeout(() => this.answerField?.nativeElement.focus());
  }

  private focusLetterField(index: number): void {
    window.setTimeout(() => {
      const fieldIndex = Math.max(0, Math.min(index, (this.letterFields?.length ?? 1) - 1));
      const field = this.letterFields?.get(fieldIndex)?.nativeElement;
      if (!field) return;

      this.activeLetterIndex.set(fieldIndex);
      field.focus();
      field.select();
    });
  }

  private handleLetterKeyboardKey(key: CustomKeyboardKey): void {
    const index = this.activeLetterIndex();

    if (key === 'backspace') {
      if (this.answerLetters()[index]) {
        this.setAnswerLetter(index, '');
      } else if (index > 0) {
        this.setAnswerLetter(index - 1, '');
        this.focusLetterField(index - 1);
      }
      return;
    }

    if (key === 'clear') {
      this.answerLetters.update((letters) => letters.map(() => ''));
      this.answerInput.set('');
      this.focusLetterField(index);
      return;
    }

    if (key === 'space') return;

    const letter = key
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 1);
    if (!letter || index >= this.answerLetters().length) return;

    this.setAnswerLetter(index, letter);
    if (index < this.answerLetters().length - 1) {
      this.focusLetterField(index + 1);
    }
  }

  private setAnswerLetter(index: number, letter: string): void {
    this.answerLetters.update((letters) => {
      if (index < 0 || index >= letters.length) return letters;

      const nextLetters = [...letters];
      nextLetters[index] = letter;
      return nextLetters;
    });
    this.answerInput.set(this.answerLetters().join(''));
  }

  private lettersFromValue(value: string, length: number): string[] {
    const letters = value
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .split('');
    return Array.from({ length }, (_, index) => letters[index] ?? '');
  }

  private cipherFromRoute(value: string | null): CipherType {
    const matchingOption = this.ciphersService.cipherOptions.find(
      (option) => option.type === value,
    );

    return matchingOption?.type ?? 'caesar';
  }

  private partialWordHint(puzzle: CipherPuzzle): string {
    const answer = this.isNatoLetterMode()
      ? puzzle.answer.replace(/[^\p{Letter}]/gu, '')
      : puzzle.answer;
    const revealedLength = Math.min(this.hintLevel(), answer.length);

    return answer
      .split('')
      .map((letter, index) => (index < revealedLength ? letter : '_'))
      .join(' ');
  }

  private readonly pigpenBaseClasses: Record<string, string> = {
    a: 'grid right bottom',
    b: 'grid right bottom left',
    c: 'grid bottom left',
    d: 'grid top right bottom',
    e: 'grid top right bottom left',
    f: 'grid top bottom left',
    g: 'grid top right',
    h: 'grid top right left',
    i: 'grid top left',
    j: 'grid right bottom',
    k: 'grid right bottom left',
    l: 'grid bottom left',
    m: 'grid top right bottom',
    n: 'grid top right bottom left',
    o: 'grid top bottom left',
    p: 'grid top right',
    q: 'grid top right left',
    r: 'grid top left',
    s: 'angle angle-bottom',
    t: 'angle angle-left',
    u: 'angle angle-right',
    v: 'angle angle-top',
    w: 'angle angle-bottom',
    x: 'angle angle-left',
    y: 'angle angle-right',
    z: 'angle angle-top',
  };

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

  private readonly semaphorePositionsByLetter = SEMAPHORE_POSITIONS_BY_LETTER;
}
