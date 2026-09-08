import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApprovalState, PuzzleExample, PuzzleType, PuzzleVariant } from './lab.model';
import { LAB_PUZZLE_TYPES } from './lab.puzzle-types';
import { FirebasePuzzleCatalogService } from '../../shared/firebase/firebase-puzzle-catalog.service';
import {
  CLOCK_LETTER_DEFINITIONS,
  CLOCK_LETTER_FALLBACK_WORDS,
} from '../../puzzles/puzzlehunt/ClockLetters/clock-letters.data';
import { FAUX_WORD_DEFINITIONS, FauxWordDefinition } from './puzzle-types/faux-words.puzzle-type';
import {
  SEGMENT_PHRASE_DEFINITIONS,
  SegmentPhraseDefinition,
} from './puzzle-types/segment-phrase.puzzle-type';
import {
  COLOR_CHAIN_CHALLENGE_WORD,
  COLOR_CHAIN_WORDS,
} from './puzzle-types/color-chain.puzzle-type';
import {
  HIDDEN_COLOR_DEFINITIONS,
  HiddenColorDefinition,
  HiddenColorDirection,
} from './puzzle-types/hidden-colors.puzzle-type';
import {
  applySyllabicRotationMapping,
  createSyllabicRotationMapping,
  SYLLABIC_ROTATION_CHALLENGE,
  SYLLABIC_ROTATION_EXAMPLES,
  SyllabicRotationMapping,
  SyllabicRotationWord,
} from './puzzle-types/syllabic-rotation.puzzle-type';
import { SyllabicRotationVisualComponent } from './puzzle-types/syllabic-rotation-visual.component';
import { PuzzlePlayHistoryService } from '../../puzzle-play-history.service';
import { PuzzleAnswerComponent } from '../../puzzles/shared/puzzle-answer';
import { AppStorageService } from '../../shared/storage/app-storage.service';

type SegmentKind = 'horizontal' | 'vertical' | 'slash' | 'backslash';
type FigureSide = 'top' | 'right' | 'bottom' | 'left';
type TriangleOrientation = 'up' | 'down' | 'left' | 'right';
type TriangleSize = 'small' | 'medium' | 'large';
type GeometricShapeKind = 'triangle' | 'square' | 'rectangle' | 'diamond' | 'region';
type NetworkNode = { x: number; y: number };

type PuzzleSegment = {
  id: string;
  kind: SegmentKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type SevenSegmentPart = PuzzleSegment & {
  lit: boolean;
};

type GeometricShape = {
  id: string;
  kind: GeometricShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  orientation?: TriangleOrientation;
  size?: TriangleSize;
  area?: number;
};

type SevenSegmentDisplay = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  segments: boolean[];
  missing?: boolean;
};

type SegmentPhraseLetter = SevenSegmentDisplay & {
  missingSegments: boolean[];
};

type SegmentPhrasePart = SevenSegmentPart & {
  missing: boolean;
};

type SegmentPhraseWord = {
  id: string;
  viewBox: string;
  width: number;
  height: number;
  letters: SegmentPhraseLetter[];
};

type ColorChainColor = {
  value: string;
  label: string;
};

type ColorChainCell = {
  id: string;
  position: number;
  letter: string;
  backgroundColor: string;
  backgroundLabel: string;
  textColor: string;
  textLabel: string;
};

type ColorChainAnswerHint = {
  letter: string;
  color?: string;
  revealed: boolean;
};

type HiddenColorSlot =
  | {
      id: string;
      kind: 'letter';
      index: number;
      letter: string;
      extraction: boolean;
    }
  | {
      id: string;
      kind: 'color';
      color: string;
      colorLabel: string;
      colorHex: string;
      direction: HiddenColorDirection;
    };

type HiddenColorEntry = HiddenColorDefinition & {
  slots: HiddenColorSlot[];
};

type FigureTextLine = {
  id: string;
  x: number;
  y: number;
  text: string;
};

type NetworkGraph = {
  nodes: Map<string, NetworkNode>;
  adjacency: Map<string, Set<string>>;
  edges: PuzzleSegment[];
};

type NetworkComponent = {
  nodes: Set<string>;
  edges: PuzzleSegment[];
};

type FigureMarker = {
  id: string;
  x: number;
  y: number;
  label: string;
};

type FigureBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PuzzleExampleFigure = {
  id: string;
  example?: PuzzleExample;
  viewBox: string;
  frame: FigureBox;
  gridSize: number;
  baseLine?: PuzzleSegment;
  segments: PuzzleSegment[];
  shapes: GeometricShape[];
  sevenSegmentDigits?: SevenSegmentDisplay[];
  notes?: FigureTextLine[];
  markers: FigureMarker[];
  code: string;
  displayMode?:
    | 'standard'
    | 'seven-segment'
    | 'navigation'
    | 'clock-letters'
    | 'word-split'
    | 'segment-phrase'
    | 'color-chain'
    | 'hidden-colors'
    | 'syllabic-rotation';
  imageSrc?: string;
  clue?: string;
  clockLetters?: ClockLetterFigure[];
  wordSplitEntries?: FauxWordDefinition[];
  wordSplitShowAnswers?: boolean;
  segmentPhraseDefinition?: string;
  segmentPhraseWords?: SegmentPhraseWord[];
  colorChainStartLetter?: string;
  colorChainStartColor?: string;
  colorChainAnswerColors?: string[];
  colorChainCells?: ColorChainCell[];
  hiddenColorEntries?: HiddenColorEntry[];
  syllabicWord?: SyllabicRotationWord;
};

type ClockLetterFigure = {
  id: string;
  time: string;
  staticLines: PuzzleSegment[];
  clockHands: PuzzleSegment[];
};

type GeneratedFigure = {
  segments?: PuzzleSegment[];
  shapes?: GeometricShape[];
  sevenSegmentDigits?: SevenSegmentDisplay[];
  notes?: FigureTextLine[];
  markers?: FigureMarker[];
  code: string;
  gridSize?: number;
  displayMode?: 'standard' | 'seven-segment' | 'navigation' | 'clock-letters';
  imageSrc?: string;
  clue?: string;
};

type LabInstance = {
  solution: string;
  exampleFigures: PuzzleExampleFigure[];
  challengeFigure: PuzzleExampleFigure;
};

type SeededRandom = () => number;
type ExampleFeedback = 'correct' | 'incorrect' | 'partial';
type TypeViewMode = 'cards' | 'lines';
type PuzzleSortMode =
  | 'name-asc'
  | 'name-desc'
  | 'created-desc'
  | 'created-asc'
  | 'updated-desc'
  | 'updated-asc'
  | 'status-asc'
  | 'status-desc';

const SEGMENT_PHRASE_LETTER_MASKS: Record<string, boolean[]> = {
  // Ordre : haut, droite-haut, droite-bas, bas, gauche-bas, gauche-haut, milieu.
  // Seules les lettres lisibles sur un affichage à sept segments sont utilisées.
  A: [true, true, true, false, true, true, true],
  B: [false, false, true, true, true, true, true],
  C: [true, false, false, true, true, true, false],
  D: [false, true, true, true, true, false, true],
  E: [true, false, false, true, true, true, true],
  F: [true, false, false, false, true, true, true],
  G: [true, false, true, true, true, true, true],
  H: [false, true, true, false, true, true, true],
  I: [false, true, true, false, false, false, false],
  J: [false, true, true, true, false, false, false],
  L: [false, false, false, true, true, true, false],
  O: [true, true, true, true, true, true, false],
  P: [true, true, false, false, true, true, true],
  S: [true, false, true, true, false, true, true],
  U: [false, true, true, true, true, true, false],
};

const COLOR_CHAIN_COLORS: ColorChainColor[] = [
  { value: '#ef4444', label: 'rouge' },
  { value: '#2563eb', label: 'bleu' },
  { value: '#eab308', label: 'jaune' },
  { value: '#16a34a', label: 'vert' },
  { value: '#9333ea', label: 'violet' },
  { value: '#06b6d4', label: 'cyan' },
  { value: '#db2777', label: 'magenta' },
  { value: '#f97316', label: 'orange' },
  { value: '#65a30d', label: 'lime' },
];

const COLOR_CHAIN_TERMINAL_COLOR: ColorChainColor = {
  value: '#334155',
  label: 'ardoise',
};

@Component({
  selector: 'app-lab-page',
  imports: [RouterLink, PuzzleAnswerComponent, SyllabicRotationVisualComponent],
  templateUrl: './lab.page.html',
  styleUrl: './lab.page.scss',
})
export class LabPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly storage = inject(AppStorageService);
  private readonly selectedTypeStorageKey = 'epique-lab-selected-type';
  private readonly selectedVariantStorageKey = 'epique-lab-selected-variant';
  private readonly typeViewModeStorageKey = 'epique-lab-type-view-mode';
  private readonly typeNameFilterStorageKey = 'epique-lab-type-name-filter';
  private readonly typeStatusFilterStorageKey = 'epique-lab-type-status-filter';
  private readonly puzzleSortModeStorageKey = 'epique-lab-puzzle-sort-mode';
  protected readonly puzzleTypes = LAB_PUZZLE_TYPES;
  protected readonly clockLegend = Object.entries(CLOCK_LETTER_DEFINITIONS).map(
    ([letter, definition]) => ({
      letter,
      time: definition.time,
      staticLines: definition.staticLines.map((line, index) => ({
        id: `legend-${letter}-static-${index}`,
        kind: 'horizontal' as SegmentKind,
        x1: line[0],
        y1: line[1],
        x2: line[2],
        y2: line[3],
      })),
      clockHands: this.clockHands(definition.time, `legend-${letter}`),
    }),
  );
  protected readonly approvalStates: ApprovalState[] = ['approved', 'pending', 'deleted'];
  protected readonly isPlayPage = signal(this.route.snapshot.url[0]?.path === 'play');
  protected readonly isTypeDetailPage = signal(this.route.snapshot.paramMap.has('typeId'));
  protected readonly typeViewMode = signal<TypeViewMode>(this.readTypeViewMode());
  protected readonly typeNameFilter = signal(this.readTypeNameFilter());
  protected readonly typeStatusFilter = signal<ApprovalState | 'all'>(this.readTypeStatusFilter());
  protected readonly puzzleSortMode = signal<PuzzleSortMode>(this.readPuzzleSortMode());
  protected readonly visiblePuzzleTypes = computed(() => {
    const filter = this.typeNameFilter().trim().toLocaleLowerCase('fr-CA');
    const status = this.typeStatusFilter();
    const filteredTypes = this.puzzleTypes.filter(
      (type) =>
        (!filter || this.typeName(type).toLocaleLowerCase('fr-CA').includes(filter)) &&
        (status === 'all' || this.typeState(type) === status),
    );

    return [...filteredTypes].sort((first, second) => this.comparePuzzleTypes(first, second));
  });
  protected readonly selectedTypeId = signal(this.readInitialTypeId());
  protected readonly selectedVariantId = signal(this.readStoredVariantId(this.selectedTypeId()));
  private readonly difficulty = 2;
  protected readonly seed = signal(this.createSeed());
  protected readonly firebaseStatus = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly firebaseMessage = signal('Synchronisation des états…');
  private readonly firebaseCatalog = inject(FirebasePuzzleCatalogService);
  private readonly playHistory = inject(PuzzlePlayHistoryService);
  private readonly typeNameOverrides = signal<Record<string, string>>({});
  private readonly typeStatusOverrides = signal<Record<string, ApprovalState>>({});
  private readonly typeCreatedAtOverrides = signal<Record<string, number>>({});
  private readonly typeUpdatedAtOverrides = signal<Record<string, number>>({});
  private readonly typeDescriptionOverrides = signal<Record<string, string>>({});
  private readonly variantStatusOverrides = signal<Record<string, Record<string, ApprovalState>>>(
    {},
  );
  private readonly variantNameOverrides = signal<Record<string, Record<string, string>>>({});
  private readonly variantDescriptionOverrides = signal<Record<string, Record<string, string>>>({});
  private readonly variantDescriptionDrafts = signal<Record<string, Record<string, string>>>({});
  private readonly typeCommentOverrides = signal<Record<string, string>>({});
  private readonly variantCommentOverrides = signal<Record<string, Record<string, string>>>({});
  private readonly variantExampleCountOverrides = signal<Record<string, Record<string, number>>>(
    {},
  );
  private readonly clockWordPool = signal<string[]>(CLOCK_LETTER_FALLBACK_WORDS);
  private readonly challengeSolutionShown = signal(false);
  private readonly challengeAnswerState = signal('');
  private readonly challengeFeedbackState = signal<ExampleFeedback | undefined>(undefined);
  private readonly challengePartialMessageState = signal('');
  private readonly wordSplitHintCount = signal(0);
  private readonly segmentPhraseHintCount = signal(0);
  private readonly colorChainHintCount = signal(0);
  private readonly hiddenColorLettersState = signal<Record<string, string[]>>({});
  protected readonly editingTypeName = signal(false);
  protected readonly editingVariantName = signal(false);

  constructor() {
    this.storage.changes$.subscribe((change) => {
      if (change.source !== 'remote') {
        return;
      }

      switch (change.key) {
        case this.typeViewModeStorageKey:
          this.typeViewMode.set(this.readTypeViewMode());
          break;
        case this.typeNameFilterStorageKey:
          this.typeNameFilter.set(this.readTypeNameFilter());
          break;
        case this.typeStatusFilterStorageKey:
          this.typeStatusFilter.set(this.readTypeStatusFilter());
          break;
        case this.puzzleSortModeStorageKey:
          this.puzzleSortMode.set(this.readPuzzleSortMode());
          break;
        case this.selectedTypeStorageKey: {
          const nextTypeId = this.readStoredTypeId();
          this.selectedTypeId.set(nextTypeId);
          this.selectedVariantId.set(this.readStoredVariantId(nextTypeId));
          break;
        }
        case this.selectedVariantStorageKey:
          this.selectedVariantId.set(this.readStoredVariantId(this.selectedTypeId()));
          break;
      }
    });

    void this.loadPersistedStatuses();
    void this.loadClockWords();
  }

  protected readonly selectedType = computed(
    () => this.puzzleTypes.find((type) => type.id === this.selectedTypeId()) ?? this.puzzleTypes[0],
  );

  protected readonly selectedVariant = computed(
    () =>
      this.selectedType().variants.find((variant) => variant.id === this.selectedVariantId()) ??
      this.selectedType().variants[0],
  );

  protected readonly instance = computed(() =>
    this.generateInstance(
      this.selectedType(),
      this.selectedVariant(),
      this.selectedExampleCount(),
      this.difficulty,
      this.seed(),
    ),
  );

  protected selectType(type: PuzzleType): void {
    this.editingTypeName.set(false);
    this.editingVariantName.set(false);
    this.selectedTypeId.set(type.id);
    this.selectedVariantId.set(type.variants[0].id);
    this.saveSelection(type.id, type.variants[0].id);
    this.resetExampleAttempts();
    void this.router.navigate(['/lab', type.id]);
  }

  protected setTypeViewMode(mode: TypeViewMode): void {
    this.typeViewMode.set(mode);

    try {
      this.storage.set(this.typeViewModeStorageKey, mode);
    } catch {
      // The selected view still applies for the current page when storage is unavailable.
    }
  }

  protected setTypeNameFilter(event: Event): void {
    const filter = (event.target as HTMLInputElement).value;
    this.typeNameFilter.set(filter);

    try {
      this.storage.set(this.typeNameFilterStorageKey, filter);
    } catch {
      // Le filtre continue de fonctionner pour la session courante.
    }
  }

  protected setTypeStatusFilter(event: Event): void {
    const status = (event.target as HTMLSelectElement).value;

    if (status === 'all' || this.isApprovalState(status)) {
      this.typeStatusFilter.set(status);

      try {
        this.storage.set(this.typeStatusFilterStorageKey, status);
      } catch {
        // Le filtre continue de fonctionner pour la session courante.
      }
    }
  }

  protected setPuzzleSortMode(event: Event): void {
    const mode = (event.target as HTMLSelectElement).value;

    if (!this.isPuzzleSortMode(mode)) {
      return;
    }

    this.puzzleSortMode.set(mode);

    try {
      this.storage.set(this.puzzleSortModeStorageKey, mode);
    } catch {
      // The selected sort still applies for the current page when storage is unavailable.
    }
  }

  protected selectVariant(variant: PuzzleVariant): void {
    this.editingVariantName.set(false);
    this.selectedVariantId.set(variant.id);
    this.saveSelection(this.selectedTypeId(), variant.id);
    this.resetExampleAttempts();
  }

  protected setVariant(event: Event): void {
    const variantId = (event.target as HTMLSelectElement).value;
    const variant = this.selectedType().variants.find((candidate) => candidate.id === variantId);

    if (variant) {
      this.selectVariant(variant);
    }
  }

  protected randomizeSeed(): void {
    this.seed.set(this.createSeed());
    this.resetExampleAttempts();
  }

  protected challengeAnswer(): string {
    return this.challengeAnswerState();
  }

  protected setChallengeAnswer(event: Event): void {
    const rawAnswer = (event.target as HTMLInputElement).value;
    const answer = this.isTextAnswer()
      ? this.normalizeChallengeAnswer(rawAnswer).slice(
          0,
          this.selectedType().id === 'faux-words' ? undefined : 20,
        )
      : rawAnswer.replace(/\D/g, '').slice(0, 4);
    this.challengeAnswerState.set(answer);
    this.challengeFeedbackState.set(undefined);
    this.challengePartialMessageState.set('');
  }

  protected isTextAnswer(): boolean {
    return (
      this.selectedType().id === 'navigation' ||
      this.selectedType().id === 'image-only-symbols' ||
      this.selectedType().id === 'clock-letters' ||
      this.selectedType().id === 'faux-words' ||
      this.selectedType().id === 'segment-phrase' ||
      this.selectedType().id === 'color-chain' ||
      this.selectedType().id === 'hidden-colors' ||
      this.selectedType().id === 'syllabic-rotation'
    );
  }

  protected wordSplitEntryIsRevealed(figure: PuzzleExampleFigure, index: number): boolean {
    return Boolean(figure.wordSplitShowAnswers) || index <= this.wordSplitHintCount();
  }

  protected wordSplitUnknownAnswer(entry: FauxWordDefinition): string {
    return `→ ${'?'.repeat(entry.firstAnswer.length + entry.secondAnswer.length)}`;
  }

  protected canRevealWordSplitHint(): boolean {
    const entries = this.instance().challengeFigure.wordSplitEntries ?? [];

    return this.wordSplitHintCount() < entries.length - 1;
  }

  protected revealWordSplitHint(): void {
    if (!this.canRevealWordSplitHint()) {
      return;
    }

    this.wordSplitHintCount.update((count) => count + 1);
  }

  protected segmentPhraseWordIsRevealed(figure: PuzzleExampleFigure, index: number): boolean {
    return figure.example?.id === 'challenge' && index < this.segmentPhraseHintCount();
  }

  protected canRevealSegmentPhraseHint(): boolean {
    const words = this.instance().challengeFigure.segmentPhraseWords ?? [];

    return this.segmentPhraseHintCount() < words.length;
  }

  protected revealSegmentPhraseHint(): void {
    if (!this.canRevealSegmentPhraseHint()) {
      return;
    }

    this.segmentPhraseHintCount.update((count) => count + 1);
  }

  protected colorChainAnswerHintsFor(figure: PuzzleExampleFigure): ColorChainAnswerHint[] {
    const remainingAnswer = [...figure.code.slice(1)];
    const remainingColors = figure.colorChainAnswerColors?.slice(1) ?? [];
    const revealedCount = figure.example?.id === 'challenge' ? this.colorChainHintCount() : 0;

    return remainingAnswer.map((letter, index) => ({
      letter: index < revealedCount ? letter : '?',
      color: index < revealedCount ? remainingColors[index] : undefined,
      revealed: index < revealedCount,
    }));
  }

  protected canRevealColorChainHint(): boolean {
    return this.colorChainHintCount() < Math.max(this.instance().solution.length - 1, 0);
  }

  protected revealColorChainHint(): void {
    if (!this.canRevealColorChainHint()) {
      return;
    }

    this.colorChainHintCount.update((count) => count + 1);
  }

  protected hiddenColorLetter(entryId: string, index: number): string {
    return this.hiddenColorLettersState()[entryId]?.[index] ?? '';
  }

  protected setHiddenColorLetter(entryId: string, index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = this.normalizeChallengeAnswer(input.value).slice(0, 1);
    input.value = value;

    this.hiddenColorLettersState.update((entries) => {
      const nextLetters = [...(entries[entryId] ?? [])];
      nextLetters[index] = value;

      return {
        ...entries,
        [entryId]: nextLetters,
      };
    });
  }

  protected hiddenColorExtractionAnswer(figure: PuzzleExampleFigure): string {
    return (figure.hiddenColorEntries ?? [])
      .map((entry) => this.hiddenColorLetter(entry.id, entry.extractedSlotIndex) || '?')
      .join('');
  }

  protected checkChallenge(): void {
    const partialAnswers = this.challengePartialAnswers();
    const partialAnswer = partialAnswers.find(
      (partial) => this.normalizeChallengeAnswer(partial.answer) === this.challengeAnswerState(),
    );

    if (partialAnswer) {
      this.challengePartialMessageState.set(partialAnswer.message);
      this.challengeFeedbackState.set('partial');
      return;
    }

    const isCorrect = this.isTextAnswer()
      ? this.challengeAnswerState() === this.normalizeChallengeAnswer(this.instance().solution)
      : this.challengeAnswerState() === this.instance().solution;
    this.challengeFeedbackState.set(isCorrect ? 'correct' : 'incorrect');

    if (isCorrect && this.isPlayPage()) {
      this.playHistory.markSolved(this.selectedType().playRoute);
    }
  }

  protected challengePartialAnswers() {
    return this.selectedType().id === 'faux-words'
      ? FAUX_WORD_DEFINITIONS.filter(
          (entry, index, entries) =>
            entries.findIndex((candidate) => candidate.fauxWord === entry.fauxWord) === index,
        ).map((entry) => ({
          answer: entry.fauxWord,
          message: 'C’est une définition valide.',
        }))
      : this.selectedVariant().partialAnswers;
  }

  protected markPlaySolved(): void {
    if (this.isPlayPage()) {
      this.playHistory.markSolved(this.selectedType().playRoute);
    }
  }

  protected challengeFeedbackMessage(feedback: ExampleFeedback): string {
    if (feedback === 'correct') {
      return 'Bonne réponse.';
    }

    if (feedback === 'partial') {
      return this.challengePartialMessageState();
    }

    return 'À revoir.';
  }

  private normalizeChallengeAnswer(answer: string): string {
    return answer
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase();
  }

  protected challengeFeedback(): ExampleFeedback | undefined {
    return this.challengeFeedbackState();
  }

  protected challengeSolution(): string {
    return this.challengeSolutionShown()
      ? this.instance().solution
      : '?'.repeat(this.instance().solution.length);
  }

  protected challengeSolutionIsShown(): boolean {
    return this.challengeSolutionShown();
  }

  protected revealChallengeSolution(): void {
    this.challengeSolutionShown.set(true);
  }

  protected toggleTypeNameEdit(): void {
    this.editingTypeName.update((editing) => !editing);
  }

  protected toggleVariantNameEdit(): void {
    this.editingVariantName.update((editing) => !editing);
  }

  protected async saveTypeName(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const type = this.selectedType();
    const name = input.value.trim();

    if (!name || name.length > 120) {
      input.value = this.typeName(type);
      return;
    }

    const previousName = this.typeNameOverrides()[type.id];
    this.typeNameOverrides.update((names) => ({ ...names, [type.id]: name }));

    try {
      await this.firebaseCatalog.saveTypeName(type.id, name);
      this.markTypeUpdated(type.id);
      this.setFirebaseReady('Nom de l’énigme sauvegardé.');
    } catch (error) {
      this.typeNameOverrides.update((names) => {
        const nextNames = { ...names };
        if (previousName) nextNames[type.id] = previousName;
        else delete nextNames[type.id];
        return nextNames;
      });
      input.value = this.typeName(type);
      this.setFirebaseError(error);
    }
  }

  protected async saveVariantName(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const type = this.selectedType();
    const variant = this.selectedVariant();
    const name = input.value.trim();

    if (!name || name.length > 120) {
      input.value = this.variantName(variant);
      return;
    }

    const previousName = this.variantNameOverrides()[type.id]?.[variant.id];
    this.variantNameOverrides.update((names) => ({
      ...names,
      [type.id]: { ...names[type.id], [variant.id]: name },
    }));

    try {
      await this.firebaseCatalog.saveVariantName(type.id, variant.id, name);
      this.markTypeUpdated(type.id);
      this.setFirebaseReady('Nom de l’étape sauvegardé.');
    } catch (error) {
      this.variantNameOverrides.update((names) => ({
        ...names,
        [type.id]: { ...names[type.id], [variant.id]: previousName ?? variant.name },
      }));
      input.value = this.variantName(variant);
      this.setFirebaseError(error);
    }
  }

  protected async saveTypeDescription(event: Event): Promise<void> {
    const input = event.target as HTMLTextAreaElement;
    const type = this.selectedType();
    const description = input.value.trim();
    const previousDescription = this.typeDescriptionOverrides()[type.id];

    this.typeDescriptionOverrides.update((descriptions) => ({
      ...descriptions,
      [type.id]: description,
    }));

    try {
      await this.firebaseCatalog.saveTypeDescription(type.id, description);
      this.markTypeUpdated(type.id);
      this.setFirebaseReady('Description de l’énigme sauvegardée.');
    } catch (error) {
      this.typeDescriptionOverrides.update((descriptions) => {
        const nextDescriptions = { ...descriptions };
        if (previousDescription !== undefined) nextDescriptions[type.id] = previousDescription;
        else delete nextDescriptions[type.id];
        return nextDescriptions;
      });
      input.value = this.typeDescription(type);
      this.setFirebaseError(error);
    }
  }

  protected updateTypeDescription(event: Event): void {
    const type = this.selectedType();
    const description = (event.target as HTMLTextAreaElement).value;
    this.typeDescriptionOverrides.update((descriptions) => ({
      ...descriptions,
      [type.id]: description,
    }));
  }

  protected async saveVariantDescription(event: Event): Promise<void> {
    const input = event.target as HTMLTextAreaElement;
    const type = this.selectedType();
    const variant = this.selectedVariant();
    const description = input.value.trim();
    const previousDescription = this.variantDescriptionOverrides()[type.id]?.[variant.id];

    this.variantDescriptionOverrides.update((descriptions) => ({
      ...descriptions,
      [type.id]: { ...descriptions[type.id], [variant.id]: description },
    }));
    this.variantDescriptionDrafts.update((descriptions) => {
      const nextDescriptions = { ...descriptions };
      delete nextDescriptions[type.id]?.[variant.id];
      return nextDescriptions;
    });

    try {
      await this.firebaseCatalog.saveVariantDescription(type.id, variant.id, description);
      this.markTypeUpdated(type.id);
      this.setFirebaseReady('Flavor text sauvegardé.');
    } catch (error) {
      this.variantDescriptionOverrides.update((descriptions) => ({
        ...descriptions,
        [type.id]: {
          ...descriptions[type.id],
          [variant.id]: previousDescription ?? variant.description,
        },
      }));
      this.variantDescriptionDrafts.update((descriptions) => {
        const nextDescriptions = { ...descriptions };
        delete nextDescriptions[type.id]?.[variant.id];
        return nextDescriptions;
      });
      input.value = this.variantDescription(variant);
      this.setFirebaseError(error);
    }
  }

  protected updateVariantDescription(event: Event): void {
    const type = this.selectedType();
    const variant = this.selectedVariant();
    const description = (event.target as HTMLTextAreaElement).value;
    this.variantDescriptionDrafts.update((descriptions) => ({
      ...descriptions,
      [type.id]: { ...descriptions[type.id], [variant.id]: description },
    }));
  }

  protected typeState(type: PuzzleType): ApprovalState {
    return this.typeStatusOverrides()[type.id] ?? type.state;
  }

  protected typeName(type: PuzzleType): string {
    return this.typeNameOverrides()[type.id] ?? type.name;
  }

  protected typeDescription(type: PuzzleType): string {
    return this.typeDescriptionOverrides()[type.id] ?? type.description;
  }

  protected typeCreatedAt(type: PuzzleType): string {
    return this.formatDate(this.typeCreatedAtOverrides()[type.id] ?? type.createdAt);
  }

  protected typeUpdatedAt(type: PuzzleType): string {
    return this.formatDate(this.typeUpdatedAtOverrides()[type.id] ?? type.updatedAt);
  }

  protected variantState(variant: PuzzleVariant): ApprovalState {
    return this.variantStatusOverrides()[this.selectedType().id]?.[variant.id] ?? variant.state;
  }

  protected variantName(variant: PuzzleVariant): string {
    return this.variantNameOverrides()[this.selectedType().id]?.[variant.id] ?? variant.name;
  }

  protected variantDescription(variant: PuzzleVariant): string {
    return (
      this.variantDescriptionDrafts()[this.selectedType().id]?.[variant.id] ??
      this.variantDescriptionOverrides()[this.selectedType().id]?.[variant.id] ??
      variant.description
    );
  }

  protected savedVariantDescription(variant: PuzzleVariant): string {
    return (
      this.variantDescriptionOverrides()[this.selectedType().id]?.[variant.id] ??
      variant.description
    );
  }

  protected typeComment(type: PuzzleType): string {
    return this.typeCommentOverrides()[type.id] ?? '';
  }

  protected variantComment(variant: PuzzleVariant): string {
    return this.variantCommentOverrides()[this.selectedType().id]?.[variant.id] ?? '';
  }

  protected hasTypeComment(type: PuzzleType): boolean {
    if (this.typeComment(type).trim().length > 0) {
      return true;
    }

    return Object.values(this.variantCommentOverrides()[type.id] ?? {}).some(
      (comment) => comment.trim().length > 0,
    );
  }

  protected hasVariantComment(variant: PuzzleVariant): boolean {
    return this.variantComment(variant).trim().length > 0;
  }

  protected selectedExampleCount(): number {
    const type = this.selectedType();
    const variant = this.selectedVariant();
    const savedCount = this.variantExampleCountOverrides()[type.id]?.[variant.id];
    return Math.min(variant.examples.length, savedCount ?? variant.exampleCount);
  }

  protected async setExampleCount(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const type = this.selectedType();
    const variant = this.selectedVariant();
    const count = Number(input.value);

    if (!Number.isInteger(count) || count < 0 || count > variant.examples.length) {
      input.value = String(this.selectedExampleCount());
      return;
    }

    const previousOverrides = this.variantExampleCountOverrides()[type.id];
    this.variantExampleCountOverrides.update((overrides) => ({
      ...overrides,
      [type.id]: { ...overrides[type.id], [variant.id]: count },
    }));
    this.resetExampleAttempts();

    try {
      await this.firebaseCatalog.saveVariantExampleCount(type.id, variant.id, count);
      this.markTypeUpdated(type.id);
      this.setFirebaseReady('Nombre d’exemples sauvegardé.');
    } catch (error) {
      this.variantExampleCountOverrides.update((overrides) => {
        const nextOverrides = { ...overrides };

        if (previousOverrides) {
          nextOverrides[type.id] = previousOverrides;
        } else {
          delete nextOverrides[type.id];
        }

        return nextOverrides;
      });
      input.value = String(this.selectedExampleCount());
      this.setFirebaseError(error);
    }
  }

  protected async setTypeState(event: Event): Promise<void> {
    const nextState = (event.target as HTMLSelectElement).value;

    if (!this.isApprovalState(nextState)) {
      return;
    }

    const type = this.selectedType();
    const previousOverride = this.typeStatusOverrides()[type.id];
    this.typeStatusOverrides.update((overrides) => ({ ...overrides, [type.id]: nextState }));

    try {
      await this.firebaseCatalog.saveTypeStatus(type.id, nextState);
      this.markTypeUpdated(type.id);
      this.setFirebaseReady('État de l’énigme sauvegardé.');
    } catch (error) {
      this.restoreTypeState(type.id, previousOverride);
      this.setFirebaseError(error);
    }
  }

  protected async setVariantState(event: Event): Promise<void> {
    const nextState = (event.target as HTMLSelectElement).value;

    if (!this.isApprovalState(nextState)) {
      return;
    }

    const type = this.selectedType();
    const variant = this.selectedVariant();
    const previousOverrides = this.variantStatusOverrides()[type.id];
    const previousOverride = previousOverrides?.[variant.id];

    this.variantStatusOverrides.update((overrides) => ({
      ...overrides,
      [type.id]: { ...overrides[type.id], [variant.id]: nextState },
    }));

    try {
      await this.firebaseCatalog.saveVariantStatus(type.id, variant.id, nextState);
      this.markTypeUpdated(type.id);
      this.setFirebaseReady('État de l’étape sauvegardé.');
    } catch (error) {
      this.restoreVariantState(type.id, variant.id, previousOverrides, previousOverride);
      this.setFirebaseError(error);
    }
  }

  protected async saveTypeComment(event: Event): Promise<void> {
    const type = this.selectedType();
    const comment = (event.target as HTMLTextAreaElement).value.trim();
    const previousComment = this.typeCommentOverrides()[type.id] ?? '';

    this.typeCommentOverrides.update((comments) => ({ ...comments, [type.id]: comment }));

    try {
      await this.firebaseCatalog.saveTypeComment(type.id, comment);
      this.markTypeUpdated(type.id);
      this.setFirebaseReady('Commentaire de l’énigme sauvegardé.');
    } catch (error) {
      this.typeCommentOverrides.update((comments) => ({ ...comments, [type.id]: previousComment }));
      this.setFirebaseError(error);
    }
  }

  protected updateTypeComment(event: Event): void {
    const type = this.selectedType();
    const comment = (event.target as HTMLTextAreaElement).value;
    this.typeCommentOverrides.update((comments) => ({ ...comments, [type.id]: comment }));
  }

  protected async saveVariantComment(event: Event): Promise<void> {
    const type = this.selectedType();
    const variant = this.selectedVariant();
    const comment = (event.target as HTMLTextAreaElement).value.trim();
    const previousComment = this.variantCommentOverrides()[type.id]?.[variant.id] ?? '';

    this.variantCommentOverrides.update((comments) => ({
      ...comments,
      [type.id]: { ...comments[type.id], [variant.id]: comment },
    }));

    try {
      await this.firebaseCatalog.saveVariantComment(type.id, variant.id, comment);
      this.markTypeUpdated(type.id);
      this.setFirebaseReady('Commentaire de l’étape sauvegardé.');
    } catch (error) {
      this.variantCommentOverrides.update((comments) => ({
        ...comments,
        [type.id]: { ...comments[type.id], [variant.id]: previousComment },
      }));
      this.setFirebaseError(error);
    }
  }

  protected updateVariantComment(event: Event): void {
    const type = this.selectedType();
    const variant = this.selectedVariant();
    const comment = (event.target as HTMLTextAreaElement).value;
    this.variantCommentOverrides.update((comments) => ({
      ...comments,
      [type.id]: { ...comments[type.id], [variant.id]: comment },
    }));
  }

  protected stateLabel(state: ApprovalState): string {
    const labels: Record<ApprovalState, string> = {
      approved: 'Approuvé',
      pending: 'En approbation',
      deleted: 'Supprimé',
    };

    return labels[state];
  }

  private async loadPersistedStatuses(): Promise<void> {
    if (!this.firebaseCatalog.isConfigured) {
      this.setFirebaseError(new Error('Firebase n’est pas configuré.'));
      return;
    }

    try {
      const overrides = await this.firebaseCatalog.loadStatuses();
      const typeNames = { ...overrides.typeNames };
      const savedCountTypeName = typeNames['count-by-symbol'];
      if (savedCountTypeName?.trim().toLocaleLowerCase('fr-CA') === 'compter') {
        typeNames['count-by-symbol'] = 'Segments';
        void this.firebaseCatalog
          .saveTypeName('count-by-symbol', 'Segments')
          .catch(() => undefined);
      }
      this.typeNameOverrides.set(typeNames);
      this.typeStatusOverrides.set(overrides.typeStates);
      this.typeCreatedAtOverrides.set(overrides.typeCreatedAt);
      this.typeUpdatedAtOverrides.set(overrides.typeUpdatedAt);
      this.typeDescriptionOverrides.set(overrides.typeDescriptions);
      this.variantStatusOverrides.set(overrides.variantStates);
      this.variantNameOverrides.set(overrides.variantNames);
      this.variantDescriptionOverrides.set(overrides.variantDescriptions);
      this.typeCommentOverrides.set(overrides.typeComments);
      this.variantCommentOverrides.set(overrides.variantComments);
      this.variantExampleCountOverrides.set(overrides.variantExampleCounts);
      await Promise.all(
        this.puzzleTypes.map((type) =>
          this.firebaseCatalog.ensureTypeDates(type.id, type.createdAt, type.updatedAt),
        ),
      );
      this.setFirebaseReady('États synchronisés avec Firebase.');
    } catch (error) {
      this.setFirebaseError(error);
    }
  }

  private async loadClockWords(): Promise<void> {
    try {
      const response = await fetch('words.txt');
      if (!response.ok) {
        return;
      }

      const sourceWords = (await response.text())
        .split(/\r?\n/)
        .map((word) => word.trim())
        .filter(Boolean);
      const words = sourceWords
        .map((word) =>
          word
            .trim()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toUpperCase(),
        )
        .filter(
          (word, index, allWords) =>
            /^[AEFHIKLMNTUVXY]{4,8}$/.test(word) && allWords.indexOf(word) === index,
        );

      if (words.length > 0) {
        this.clockWordPool.set(words);
      }

    } catch {
      // Les mots de secours permettent de continuer à générer l’exemple hors ligne.
    }
  }

  private setFirebaseReady(message: string): void {
    this.firebaseStatus.set('ready');
    this.firebaseMessage.set(message);
  }

  private setFirebaseError(error: unknown): void {
    this.firebaseStatus.set('error');
    this.firebaseMessage.set(
      error instanceof Error ? error.message : 'Impossible de synchroniser les états.',
    );
  }

  private restoreTypeState(typeId: string, previousOverride: ApprovalState | undefined): void {
    this.typeStatusOverrides.update((overrides) => {
      const nextOverrides = { ...overrides };

      if (previousOverride) {
        nextOverrides[typeId] = previousOverride;
      } else {
        delete nextOverrides[typeId];
      }

      return nextOverrides;
    });
  }

  private restoreVariantState(
    typeId: string,
    variantId: string,
    previousOverrides: Record<string, ApprovalState> | undefined,
    previousOverride: ApprovalState | undefined,
  ): void {
    this.variantStatusOverrides.update((overrides) => {
      const nextOverrides = { ...overrides };

      if (previousOverrides) {
        nextOverrides[typeId] = previousOverrides;
      } else {
        const typeOverrides = { ...nextOverrides[typeId] };
        delete typeOverrides[variantId];

        if (Object.keys(typeOverrides).length) {
          nextOverrides[typeId] = typeOverrides;
        } else {
          delete nextOverrides[typeId];
        }
      }

      if (previousOverride && previousOverrides) {
        nextOverrides[typeId] = { ...previousOverrides, [variantId]: previousOverride };
      }

      return nextOverrides;
    });
  }

  private isApprovalState(value: string): value is ApprovalState {
    return value === 'approved' || value === 'pending' || value === 'deleted';
  }

  private generateInstance(
    type: PuzzleType,
    variant: PuzzleVariant,
    exampleCount: number,
    difficulty: number,
    seed: string,
  ): LabInstance {
    const random = this.seededRandom(`${type.id}-${variant.id}-${difficulty}-${seed}`);
    const syllabicRotationMapping =
      variant.id === 'syllabic-rotation-main' ? createSyllabicRotationMapping(random) : undefined;
    const shouldShuffleCode =
      !variant.id.startsWith('3-') &&
      variant.id !== 'navigation-main' &&
      variant.id !== 'image-only-symbols-main' &&
      variant.id !== 'clock-letters-main' &&
      variant.id !== 'faux-words-main' &&
      variant.id !== 'segment-phrase-main' &&
      variant.id !== 'color-chain-main' &&
      variant.id !== 'hidden-colors-main' &&
      variant.id !== 'syllabic-rotation-main';
    const digitOrder = shouldShuffleCode ? this.shuffle([0, 1, 2, 3], random) : [0, 1, 2, 3];
    const sharedSegmentConfiguration =
      variant.id === '3-1-broken-segment'
        ? this.shuffle([0, 1, 2, 3, 4, 5, 6], random).slice(0, 2)
        : undefined;
    const createFigure = (example: PuzzleExample): PuzzleExampleFigure => {
      const figure = this.createFigureForVariant(
        random,
        difficulty,
        example,
        variant.id,
        sharedSegmentConfiguration,
        syllabicRotationMapping,
      );

      return shouldShuffleCode
        ? { ...figure, code: this.reorderCodeDigits(figure.code, digitOrder) }
        : figure;
    };
    const examples = variant.examples.slice(0, exampleCount);
    const shouldValidateExamples = shouldShuffleCode && examples.length >= 2;
    let exampleFigures = examples.map(createFigure);

    for (
      let attempt = 0;
      shouldValidateExamples &&
      attempt < 200 &&
      (!this.exampleCategoriesCovered(exampleFigures) ||
        !this.exampleDigitsVary(exampleFigures) ||
        !this.exampleDigitPositionsAreDistinguishable(exampleFigures));
      attempt += 1
    ) {
      exampleFigures = examples.map(createFigure);
    }
    const challengeExample = new PuzzleExample({
      id: 'challenge',
      name: 'Défi',
      description: 'Figure à résoudre.',
    });
    const challengeFigure = createFigure(challengeExample);
    const solution = challengeFigure.code;

    return {
      solution,
      exampleFigures,
      challengeFigure,
    };
  }

  private reorderCodeDigits(code: string, digitOrder: number[]): string {
    if (code.length < 4) {
      return code;
    }

    return digitOrder.map((index) => code[index] ?? '0').join('') + code.slice(4);
  }

  private exampleCategoriesCovered(figures: PuzzleExampleFigure[]): boolean {
    if (figures.length === 0) {
      return false;
    }

    return [0, 1, 2, 3].every((digitIndex) =>
      figures.some((figure) => Number(figure.code[digitIndex] ?? 0) > 0),
    );
  }

  private exampleDigitsVary(figures: PuzzleExampleFigure[]): boolean {
    return [0, 1, 2, 3].every(
      (digitIndex) => new Set(figures.map((figure) => figure.code[digitIndex])).size > 1,
    );
  }

  private exampleDigitPositionsAreDistinguishable(figures: PuzzleExampleFigure[]): boolean {
    const signatures = [0, 1, 2, 3].map((digitIndex) =>
      figures.map((figure) => figure.code[digitIndex] ?? '0').join('|'),
    );

    return new Set(signatures).size === signatures.length;
  }

  private createFigureForVariant(
    random: SeededRandom,
    difficulty: number,
    example: PuzzleExample,
    variantId: string,
    sharedSegmentConfiguration?: number[],
    syllabicRotationMapping?: SyllabicRotationMapping,
  ): PuzzleExampleFigure {
    if (variantId === 'navigation-main') {
      return this.createNavigationFigure(example);
    }
    if (variantId === 'image-only-symbols-main') {
      return this.createImageOnlyFigure(example);
    }
    if (variantId === 'clock-letters-main') {
      return this.createClockLettersFigure(random, example);
    }
    if (variantId === 'faux-words-main') {
      return this.createFauxWordsFigure(example);
    }
    if (variantId === 'segment-phrase-main') {
      return this.createSegmentPhraseFigure(random, example);
    }
    if (variantId === 'color-chain-main') {
      return this.createColorChainFigure(random, example);
    }
    if (variantId === 'hidden-colors-main') {
      return this.createHiddenColorsFigure(example);
    }
    if (variantId === 'syllabic-rotation-main') {
      return this.createSyllabicRotationFigure(
        example,
        syllabicRotationMapping,
      );
    }
    if (variantId.startsWith('3-')) {
      return this.createSevenSegmentFigure(
        random,
        difficulty,
        example,
        variantId,
        sharedSegmentConfiguration,
      );
    }
    if (variantId.startsWith('2-')) {
      return this.createGeometricFigure(random, difficulty, example, variantId);
    }
    return this.createCountBySymbolFigure(random, difficulty, example, variantId);
  }

  private createNavigationFigure(example: PuzzleExample): PuzzleExampleFigure {
    return {
      id: `example-${example.id}`,
      example,
      viewBox: '0 0 1 1',
      frame: { x: 0, y: 0, width: 1, height: 1 },
      gridSize: 1,
      segments: [],
      shapes: [],
      markers: [],
      code: 'POULIE',
      displayMode: 'navigation',
      imageSrc: 'puzzles/navigation.png',
      clue: 'Les itinéraires devraient m’indiquer ce dont j’ai besoin pour la suite.',
    };
  }

  private createImageOnlyFigure(example: PuzzleExample): PuzzleExampleFigure {
    return {
      id: `example-${example.id}`,
      example,
      viewBox: '0 0 1 1',
      frame: { x: 0, y: 0, width: 1, height: 1 },
      gridSize: 1,
      segments: [],
      shapes: [],
      markers: [],
      code: 'ARC-EN-CIEL',
      displayMode: 'navigation',
      imageSrc: 'puzzles/image-symboles.png',
    };
  }

  private createClockLettersFigure(
    random: SeededRandom,
    example: PuzzleExample,
  ): PuzzleExampleFigure {
    const word = this.pick(this.clockWordPool(), random);
    const clockLetters = [...word].map((letter, index) => {
      const definition = CLOCK_LETTER_DEFINITIONS[letter] ?? CLOCK_LETTER_DEFINITIONS['I'];
      const staticLines = definition.staticLines.map((line, lineIndex) => ({
        id: `clock-${example.id}-${index}-static-${lineIndex}`,
        kind: 'horizontal' as SegmentKind,
        x1: line[0],
        y1: line[1],
        x2: line[2],
        y2: line[3],
      }));

      return {
        id: `clock-${example.id}-${index}`,
        time: definition.time,
        staticLines,
        clockHands: this.clockHands(definition.time, `clock-${example.id}-${index}`),
      };
    });

    return {
      id: `example-${example.id}`,
      example,
      viewBox: '0 0 1 1',
      frame: { x: 0, y: 0, width: 1, height: 1 },
      gridSize: 1,
      segments: [],
      shapes: [],
      markers: [],
      code: word,
      displayMode: 'clock-letters',
      clockLetters,
    };
  }

  private createFauxWordsFigure(example: PuzzleExample): PuzzleExampleFigure {
    return {
      id: `example-${example.id}`,
      example,
      viewBox: '0 0 1 1',
      frame: { x: 0, y: 0, width: 1, height: 1 },
      gridSize: 1,
      segments: [],
      shapes: [],
      markers: [],
      code: 'SORT',
      displayMode: 'word-split',
      wordSplitEntries: FAUX_WORD_DEFINITIONS,
      wordSplitShowAnswers: example.id !== 'challenge',
    };
  }

  private createSegmentPhraseFigure(
    random: SeededRandom,
    example: PuzzleExample,
  ): PuzzleExampleFigure {
    const definition: SegmentPhraseDefinition =
      SEGMENT_PHRASE_DEFINITIONS.find((candidate) =>
        example.id.endsWith(`-${candidate.id}`),
      ) ?? this.pick(SEGMENT_PHRASE_DEFINITIONS, random);
    const words = definition.definition.split(/\s+/).filter(Boolean);
    const answerIndexByWord = new Map(
      definition.answerWordIndexes.map((wordIndex, answerIndex) => [wordIndex, answerIndex]),
    );
    const segmentPhraseWords = words.map((word, wordIndex) => {
      const letters = [...this.normalizeChallengeAnswer(word)];
      const fullMasks = letters.map((letter) => this.segmentPhraseLetterMask(letter));
      const answerIndex = answerIndexByWord.get(wordIndex);
      const missingMasks =
        answerIndex === undefined
          ? fullMasks.map((mask) => mask.map(() => false))
          : this.segmentPhraseMissingMasks(
              fullMasks,
              this.segmentPhraseLetterMask(definition.answer[answerIndex] ?? 'E'),
              random,
            );
      const letterWidth = 18;
      const letterGap = 22;
      const wordHeight = 30;
      const wordWidth = letters.length * letterGap + 4;

      return {
        id: `segment-phrase-${example.id}-word-${wordIndex}`,
        viewBox: `0 0 ${wordWidth} 36`,
        width: wordWidth,
        height: 36,
        letters: letters.map((_, letterIndex) => ({
          id: `segment-phrase-${example.id}-word-${wordIndex}-letter-${letterIndex}`,
          x: 4 + letterIndex * letterGap,
          y: 3,
          width: letterWidth,
          height: wordHeight,
          segments: fullMasks[letterIndex].map(
            (lit, segmentIndex) => lit && !missingMasks[letterIndex][segmentIndex],
          ),
          missingSegments: fullMasks[letterIndex].map(
            (lit, segmentIndex) => lit && missingMasks[letterIndex][segmentIndex],
          ),
        })),
      } satisfies SegmentPhraseWord;
    });

    return {
      id: `example-${example.id}`,
      example,
      viewBox: '0 0 1 1',
      frame: { x: 0, y: 0, width: 1, height: 1 },
      gridSize: 1,
      segments: [],
      shapes: [],
      markers: [],
      code: definition.answer,
      displayMode: 'segment-phrase',
      segmentPhraseDefinition: definition.definition,
      segmentPhraseWords,
    };
  }

  private createColorChainFigure(
    random: SeededRandom,
    example: PuzzleExample,
  ): PuzzleExampleFigure {
    const word =
      example.id === 'challenge'
        ? COLOR_CHAIN_CHALLENGE_WORD
        : this.pick([...COLOR_CHAIN_WORDS], random);
    const gridCellCount = 9;
    const positions = this.shuffle(
      Array.from({ length: gridCellCount }, (_, position) => position),
      random,
    );
    const pathPositions = positions.slice(0, word.length);
    const decoyLetters =
      example.id === 'challenge'
        ? ['R']
        : [...'RAMEURKAYAKSPORT'].filter((letter) => !word.includes(letter));
    const decoyBackgroundColors = [
      COLOR_CHAIN_COLORS[0],
      COLOR_CHAIN_COLORS[7],
      COLOR_CHAIN_COLORS[8],
    ].slice(0, gridCellCount - word.length);
    const decoyTextColors = COLOR_CHAIN_COLORS.slice(
      word.length,
      word.length + gridCellCount - word.length,
    );
    const pathCells: ColorChainCell[] = [...word].map((letter, index) => {
      const textColor = COLOR_CHAIN_COLORS[index % COLOR_CHAIN_COLORS.length];
      const nextColor =
        index + 1 < word.length
          ? COLOR_CHAIN_COLORS[(index + 1) % COLOR_CHAIN_COLORS.length]
          : COLOR_CHAIN_TERMINAL_COLOR;

      return {
        id: `color-chain-${example.id}-path-${index}`,
        position: pathPositions[index],
        letter,
        backgroundColor: nextColor.value,
        backgroundLabel: nextColor.label,
        textColor: textColor.value,
        textLabel: textColor.label,
      };
    });
    const decoyCells: ColorChainCell[] = positions.slice(word.length).map((position, index) => {
      const backgroundColor = decoyBackgroundColors[index];
      const textColor = decoyTextColors[index];

      return {
        id: `color-chain-${example.id}-decoy-${index}`,
        position,
        letter: decoyLetters[index % decoyLetters.length],
        backgroundColor: backgroundColor.value,
        backgroundLabel: backgroundColor.label,
        textColor: textColor.value,
        textLabel: textColor.label,
      };
    });

    return {
      id: `example-${example.id}`,
      example,
      viewBox: '0 0 1 1',
      frame: { x: 0, y: 0, width: 1, height: 1 },
      gridSize: 3,
      segments: [],
      shapes: [],
      markers: [],
      code: word,
      displayMode: 'color-chain',
      colorChainStartLetter: word[0],
      colorChainStartColor: pathCells[0]?.textColor,
      colorChainAnswerColors: pathCells.map((cell) => cell.textColor),
      colorChainCells: [...pathCells, ...decoyCells].sort(
        (first, second) => first.position - second.position,
      ),
    };
  }

  private createHiddenColorsFigure(example: PuzzleExample): PuzzleExampleFigure {
    const hiddenColorEntries = HIDDEN_COLOR_DEFINITIONS.map((definition) => ({
      ...definition,
      slots: this.hiddenColorSlots(definition, example.id),
    }));

    return {
      id: `example-${example.id}`,
      example,
      viewBox: '0 0 1 1',
      frame: { x: 0, y: 0, width: 1, height: 1 },
      gridSize: 1,
      segments: [],
      shapes: [],
      markers: [],
      code: 'NATURE',
      displayMode: 'hidden-colors',
      hiddenColorEntries,
    };
  }

  private createSyllabicRotationFigure(
    example: PuzzleExample,
    mapping?: SyllabicRotationMapping,
  ): PuzzleExampleFigure {
    const exampleIndex = Number(example.id.match(/(\d+)$/)?.[1] ?? 1) - 1;
    const baseWord =
      example.id === 'challenge'
        ? SYLLABIC_ROTATION_CHALLENGE
        : (SYLLABIC_ROTATION_EXAMPLES[exampleIndex] ?? SYLLABIC_ROTATION_EXAMPLES[0]);
    const word = mapping ? applySyllabicRotationMapping(baseWord, mapping) : baseWord;

    return {
      id: `example-${example.id}`,
      example,
      viewBox: '0 0 1 1',
      frame: { x: 0, y: 0, width: 1, height: 1 },
      gridSize: 1,
      segments: [],
      shapes: [],
      markers: [],
      code: word.word,
      displayMode: 'syllabic-rotation',
      syllabicWord: word,
    };
  }

  private hiddenColorSlots(
    definition: HiddenColorDefinition,
    figureId: string,
  ): HiddenColorSlot[] {
    const slots: HiddenColorSlot[] = [];
    const colorEnd = definition.colorStart + definition.colorLength;
    let letterIndex = 0;

    for (let answerIndex = 0; answerIndex < definition.answer.length; answerIndex += 1) {
      if (answerIndex === definition.colorStart) {
        slots.push({
          id: `hidden-color-${figureId}-${definition.id}-color`,
          kind: 'color',
          color: definition.color,
          colorLabel: definition.colorLabel,
          colorHex: definition.colorHex,
          direction: definition.direction,
        });
      }

      if (answerIndex >= definition.colorStart && answerIndex < colorEnd) {
        continue;
      }

      slots.push({
        id: `hidden-color-${figureId}-${definition.id}-letter-${letterIndex}`,
        kind: 'letter',
        index: letterIndex,
        letter: definition.answer[answerIndex],
        extraction: letterIndex === definition.extractedSlotIndex,
      });
      letterIndex += 1;
    }

    return slots;
  }

  private segmentPhraseLetterMask(letter: string): boolean[] {
    return [
      ...(SEGMENT_PHRASE_LETTER_MASKS[letter] ?? SEGMENT_PHRASE_LETTER_MASKS['E']),
    ];
  }

  private segmentPhraseMissingMasks(
    fullMasks: boolean[][],
    targetMask: boolean[],
    random: SeededRandom,
  ): boolean[][] {
    const missingMasks = fullMasks.map((mask) =>
      Array.from({ length: mask.length }, () => false),
    );
    const maxMissingSegmentsPerLetter = 1;
    const minimumVisibleSegments = 3;
    const targetSegments = targetMask
      .map((isLit, segmentIndex) => (isLit ? segmentIndex : -1))
      .filter((segmentIndex): segmentIndex is number => segmentIndex >= 0)
      .sort(
        (first, second) =>
          fullMasks.filter((mask) => mask[first]).length -
          fullMasks.filter((mask) => mask[second]).length,
      );

    for (const segmentIndex of targetSegments) {
      const candidates = fullMasks
        .map((mask, letterIndex) => ({ letterIndex, mask }))
        .filter(({ mask }) => mask[segmentIndex]);

      if (candidates.length === 0) {
        continue;
      }

      const remainingSegments = ({ letterIndex, mask }: (typeof candidates)[number]): number =>
        this.countLitSegments(mask) - this.countLitSegments(missingMasks[letterIndex]);
      const missingSegmentCount = ({ letterIndex }: (typeof candidates)[number]): number =>
        this.countLitSegments(missingMasks[letterIndex]);
      const groupedReadableCandidates = candidates.filter(
        (candidate) =>
          missingSegmentCount(candidate) < maxMissingSegmentsPerLetter &&
          remainingSegments(candidate) >= minimumVisibleSegments,
      );
      const readableCandidates = candidates.filter(
        (candidate) => remainingSegments(candidate) >= minimumVisibleSegments,
      );
      const availableCandidates = groupedReadableCandidates.length
        ? groupedReadableCandidates
        : readableCandidates.length
          ? readableCandidates
          : candidates;
      const leastDamaged = Math.min(...availableCandidates.map(missingSegmentCount));
      const leastDamagedCandidates = availableCandidates.filter(
        (candidate) => missingSegmentCount(candidate) === leastDamaged,
      );
      const mostReadable = Math.max(...leastDamagedCandidates.map(remainingSegments));
      const bestCandidates = leastDamagedCandidates.filter(
        (candidate) => remainingSegments(candidate) === mostReadable,
      );
      const selected = this.pick(bestCandidates, random);
      missingMasks[selected.letterIndex][segmentIndex] = true;
    }

    return missingMasks;
  }

  private countLitSegments(segments: boolean[]): number {
    return segments.filter(Boolean).length;
  }

  private clockHands(time: string, id: string): PuzzleSegment[] {
    const [hours, minutes] = time.split(':').map(Number);
    const minuteAngle = (minutes / 60) * Math.PI * 2 - Math.PI / 2;
    const hourAngle = ((hours % 12) / 12) * Math.PI * 2 - Math.PI / 2;

    return [
      {
        id: `${id}-hour`,
        kind: 'slash',
        x1: 50,
        y1: 50,
        x2: 50 + Math.cos(hourAngle) * 20,
        y2: 50 + Math.sin(hourAngle) * 20,
      },
      {
        id: `${id}-minute`,
        kind: 'backslash',
        x1: 50,
        y1: 50,
        x2: 50 + Math.cos(minuteAngle) * 20,
        y2: 50 + Math.sin(minuteAngle) * 20,
      },
    ];
  }

  protected segmentClass(kind: SegmentKind): string {
    return `segment ${kind}`;
  }

  private pick<T>(items: T[], random: SeededRandom): T {
    return items[Math.floor(random() * items.length)];
  }

  private createCountBySymbolFigure(
    random: SeededRandom,
    difficulty: number,
    example: PuzzleExample,
    variantId: string,
  ): PuzzleExampleFigure {
    const id = `example-${example.id}`;
    const generated = this.generateVariantFigure(random, difficulty, id, variantId, example.id);

    return {
      id,
      example,
      viewBox: '0 0 130 130',
      frame: { x: 14, y: 14, width: 102, height: 102 },
      gridSize: generated.gridSize ?? 3,
      segments: this.shuffle(generated.segments ?? [], random),
      shapes: generated.shapes ?? [],
      markers: generated.markers ?? [],
      code: generated.code,
    };
  }

  private createGeometricFigure(
    random: SeededRandom,
    difficulty: number,
    example: PuzzleExample,
    variantId: string,
  ): PuzzleExampleFigure {
    const id = `example-${example.id}`;
    const generated = this.generateGeometricVariantFigure(
      random,
      difficulty,
      id,
      variantId,
      example.id !== 'challenge',
    );

    return {
      id,
      example,
      viewBox: '0 0 130 130',
      frame: { x: 14, y: 14, width: 102, height: 102 },
      gridSize: generated.gridSize ?? 4,
      segments: [],
      shapes: generated.shapes ?? [],
      markers: generated.markers ?? [],
      code: generated.code,
    };
  }

  private createSevenSegmentFigure(
    random: SeededRandom,
    difficulty: number,
    example: PuzzleExample,
    variantId: string,
    sharedSegmentConfiguration?: number[],
  ): PuzzleExampleFigure {
    const id = `example-${example.id}`;
    const generated = this.generateSevenSegmentVariantFigure(
      random,
      difficulty,
      id,
      variantId,
      example.id !== 'challenge',
      sharedSegmentConfiguration,
    );

    return {
      id,
      example,
      viewBox: '0 0 130 130',
      frame: { x: 14, y: 14, width: 102, height: 102 },
      gridSize: generated.gridSize ?? 4,
      segments: [],
      shapes: [],
      sevenSegmentDigits: generated.sevenSegmentDigits ?? [],
      notes: generated.notes ?? [],
      markers: generated.markers ?? [],
      code: generated.code,
      displayMode: 'seven-segment',
    };
  }

  protected sevenSegmentParts(display: SevenSegmentDisplay): SevenSegmentPart[] {
    const { x, y, width, height } = display;
    const middle = y + height / 2;
    const inset = 2;
    const parts: PuzzleSegment[] = [
      {
        id: `${display.id}-a`,
        kind: 'horizontal',
        x1: x + inset,
        y1: y,
        x2: x + width - inset,
        y2: y,
      },
      {
        id: `${display.id}-b`,
        kind: 'vertical',
        x1: x + width,
        y1: y + inset,
        x2: x + width,
        y2: middle - 1,
      },
      {
        id: `${display.id}-c`,
        kind: 'vertical',
        x1: x + width,
        y1: middle + 1,
        x2: x + width,
        y2: y + height - inset,
      },
      {
        id: `${display.id}-d`,
        kind: 'horizontal',
        x1: x + inset,
        y1: y + height,
        x2: x + width - inset,
        y2: y + height,
      },
      {
        id: `${display.id}-e`,
        kind: 'vertical',
        x1: x,
        y1: middle + 1,
        x2: x,
        y2: y + height - inset,
      },
      { id: `${display.id}-f`, kind: 'vertical', x1: x, y1: y + inset, x2: x, y2: middle - 1 },
      {
        id: `${display.id}-g`,
        kind: 'horizontal',
        x1: x + inset,
        y1: middle,
        x2: x + width - inset,
        y2: middle,
      },
    ];

    return parts.map((part, index) => ({ ...part, lit: display.segments[index] ?? false }));
  }

  protected segmentPhraseParts(display: SegmentPhraseLetter): SegmentPhrasePart[] {
    const { x, y, width, height } = display;
    const middle = y + height / 2;
    const inset = 2;
    const parts: PuzzleSegment[] = [
      {
        id: `${display.id}-top`,
        kind: 'horizontal',
        x1: x + inset,
        y1: y + inset,
        x2: x + width - inset,
        y2: y + inset,
      },
      {
        id: `${display.id}-upper-right`,
        kind: 'vertical',
        x1: x + width - inset,
        y1: y + inset,
        x2: x + width - inset,
        y2: middle - inset,
      },
      {
        id: `${display.id}-lower-right`,
        kind: 'vertical',
        x1: x + width - inset,
        y1: middle + inset,
        x2: x + width - inset,
        y2: y + height - inset,
      },
      {
        id: `${display.id}-bottom`,
        kind: 'horizontal',
        x1: x + inset,
        y1: y + height - inset,
        x2: x + width - inset,
        y2: y + height - inset,
      },
      {
        id: `${display.id}-lower-left`,
        kind: 'vertical',
        x1: x + inset,
        y1: middle + inset,
        x2: x + inset,
        y2: y + height - inset,
      },
      {
        id: `${display.id}-upper-left`,
        kind: 'vertical',
        x1: x + inset,
        y1: y + inset,
        x2: x + inset,
        y2: middle - inset,
      },
      {
        id: `${display.id}-middle`,
        kind: 'horizontal',
        x1: x + inset,
        y1: middle,
        x2: x + width - inset,
        y2: middle,
      },
    ];

    return parts.map((part, index) => ({
      ...part,
      lit: display.segments[index] ?? false,
      missing: display.missingSegments[index] ?? false,
    }));
  }

  protected gridCoordinates(gridSize: number): number[] {
    const cellSize = 102 / gridSize;
    return Array.from({ length: gridSize - 1 }, (_, index) => 14 + (index + 1) * cellSize);
  }

  protected shapePoints(shape: GeometricShape): string {
    const { x, y, width, height } = shape;

    if (shape.kind === 'triangle') {
      switch (shape.orientation) {
        case 'down':
          return `${x},${y} ${x + width},${y} ${x + width / 2},${y + height}`;
        case 'left':
          return `${x},${y + height / 2} ${x + width},${y} ${x + width},${y + height}`;
        case 'right':
          return `${x + width},${y + height / 2} ${x},${y} ${x},${y + height}`;
        case 'up':
        default:
          return `${x + width / 2},${y} ${x + width},${y + height} ${x},${y + height}`;
      }
    }

    if (shape.kind === 'diamond') {
      return `${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`;
    }

    return `${x},${y} ${x + width},${y} ${x + width},${y + height} ${x},${y + height}`;
  }

  private generateGeometricVariantFigure(
    random: SeededRandom,
    difficulty: number,
    figureId: string,
    variantId: string,
    isExample: boolean,
  ): GeneratedFigure {
    switch (variantId) {
      case '2-1-triangles-by-orientation':
        return this.createTrianglesByOrientationFigure(random, figureId, isExample);
      case '2-2-triangles-by-size':
        return this.createTrianglesBySizeFigure(random, figureId, isExample);
      case '2-3-closed-shape-types':
        return this.createClosedShapeTypesFigure(random, figureId, isExample);
      case '2-4-rectangles-by-width':
        return this.createRectanglesByWidthFigure(random, figureId, isExample);
      case '2-5-regions-by-area':
        return this.createRegionsByAreaFigure(random, figureId, isExample);
      default:
        return this.createTrianglesByOrientationFigure(random, figureId, isExample);
    }
  }

  private createTrianglesByOrientationFigure(
    random: SeededRandom,
    figureId: string,
    isExample: boolean,
  ): GeneratedFigure {
    const orientations: TriangleOrientation[] = ['up', 'down', 'left', 'right'];
    const counts = orientations.map(() =>
      isExample ? this.randomInt(random, 1, 2) : this.randomInt(random, 0, 3),
    );
    const availableCells = this.shuffle(
      Array.from({ length: 16 }, (_, index) => ({
        row: Math.floor(index / 4),
        column: index % 4,
      })),
      random,
    );
    let cellIndex = 0;
    const shapes = orientations.flatMap((orientation, orientationIndex) =>
      Array.from({ length: counts[orientationIndex] }, (_, index) =>
        this.createTriangleInGridCell(
          random,
          figureId,
          `${orientationIndex}-${index}`,
          orientation,
          availableCells[cellIndex++],
        ),
      ),
    );

    return { segments: [], shapes, code: counts.join(''), gridSize: 4 };
  }

  private createTriangleInGridCell(
    random: SeededRandom,
    figureId: string,
    index: string,
    orientation: TriangleOrientation,
    cell: { row: number; column: number },
  ): GeometricShape {
    const cellSize = 102 / 4;
    const size = this.pick(['small', 'medium', 'large'] as TriangleSize[], random);
    const dimensions: Record<TriangleSize, number> = { small: 10, medium: 16, large: 21 };
    const dimension = dimensions[size];
    const jitter = 2;

    return {
      id: `${figureId}-triangle-${index}`,
      kind: 'triangle',
      x:
        14 +
        cell.column * cellSize +
        (cellSize - dimension) / 2 +
        this.randomInt(random, -jitter, jitter),
      y:
        14 +
        cell.row * cellSize +
        (cellSize - dimension) / 2 +
        this.randomInt(random, -jitter, jitter),
      width: dimension,
      height: dimension,
      orientation,
      size,
    };
  }

  private createTrianglesBySizeFigure(
    random: SeededRandom,
    figureId: string,
    isExample: boolean,
  ): GeneratedFigure {
    const sizes: TriangleSize[] = ['small', 'medium', 'large'];
    const counts = sizes.map(() =>
      isExample ? this.randomInt(random, 1, 2) : this.randomInt(random, 0, 3),
    );
    const availableCells = this.shuffle(
      Array.from({ length: 16 }, (_, index) => ({
        row: Math.floor(index / 4),
        column: index % 4,
      })),
      random,
    );
    let cellIndex = 0;
    const shapes = sizes.flatMap((size, sizeIndex) =>
      Array.from({ length: counts[sizeIndex] }, (_, index) =>
        this.createSizedTriangleInGridCell(
          random,
          figureId,
          `${sizeIndex}-${index}`,
          size,
          availableCells[cellIndex++],
        ),
      ),
    );

    return { segments: [], shapes, code: `${counts.join('')}${shapes.length}`, gridSize: 4 };
  }

  private createSizedTriangleInGridCell(
    random: SeededRandom,
    figureId: string,
    index: string,
    size: TriangleSize,
    cell: { row: number; column: number },
  ): GeometricShape {
    const cellSize = 102 / 4;
    const dimensions: Record<TriangleSize, number> = { small: 10, medium: 16, large: 21 };
    const dimension = dimensions[size];
    const jitter = 1;

    return {
      id: `${figureId}-triangle-${index}`,
      kind: 'triangle',
      x:
        14 +
        cell.column * cellSize +
        (cellSize - dimension) / 2 +
        this.randomInt(random, -jitter, jitter),
      y:
        14 +
        cell.row * cellSize +
        (cellSize - dimension) / 2 +
        this.randomInt(random, -jitter, jitter),
      width: dimension,
      height: dimension,
      orientation: this.pick(['up', 'down', 'left', 'right'], random),
      size,
    };
  }

  private createClosedShapeTypesFigure(
    random: SeededRandom,
    figureId: string,
    isExample: boolean,
  ): GeneratedFigure {
    const kinds: GeometricShapeKind[] = ['square', 'rectangle', 'diamond', 'triangle'];
    const counts = kinds.map(() =>
      isExample ? this.randomInt(random, 1, 2) : this.randomInt(random, 0, 3),
    );
    const availableCells = this.shuffle(
      Array.from({ length: 16 }, (_, index) => ({
        row: Math.floor(index / 4),
        column: index % 4,
      })),
      random,
    );
    let cellIndex = 0;
    const shapes = kinds.flatMap((kind, kindIndex) =>
      Array.from({ length: counts[kindIndex] }, (_, index) =>
        this.createShapeByKindInGridCell(
          random,
          figureId,
          `${kindIndex}-${index}`,
          kind,
          availableCells[cellIndex++],
        ),
      ),
    );

    return { segments: [], shapes, code: counts.join(''), gridSize: 4 };
  }

  private createRectanglesByWidthFigure(
    random: SeededRandom,
    figureId: string,
    isExample: boolean,
  ): GeneratedFigure {
    const counts = [1, 2, 3, 4].map(() =>
      isExample ? this.randomInt(random, 1, 2) : this.randomInt(random, 0, 3),
    );
    const items = this.shuffle(
      counts.flatMap((count, widthIndex) =>
        Array.from({ length: count }, (_, index) => ({
          index: `${widthIndex}-${index}`,
          widthInCells: widthIndex + 1,
        })),
      ),
      random,
    ).sort((first, second) => second.widthInCells - first.widthInCells);
    const lanes: Array<Array<{ start: number; end: number }>> = Array.from({ length: 8 }, () => []);
    const cellSize = 102 / 4;
    const shapes: GeometricShape[] = [];

    for (const item of items) {
      const candidate = this.findOpenRectangleLane(item.widthInCells, lanes, random);

      if (!candidate) continue;

      lanes[candidate.lane].push({
        start: candidate.column,
        end: candidate.column + item.widthInCells,
      });
      shapes.push({
        id: `${figureId}-rectangle-width-${item.index}`,
        kind: 'rectangle',
        x: 14 + candidate.column * cellSize,
        y: 14 + Math.floor(candidate.lane / 2) * cellSize + (candidate.lane % 2 === 0 ? 1 : 13.5),
        width: item.widthInCells * cellSize,
        height: 11,
      });
    }

    return { segments: [], shapes, code: counts.join(''), gridSize: 4 };
  }

  private findOpenRectangleLane(
    widthInCells: number,
    lanes: Array<Array<{ start: number; end: number }>>,
    random: SeededRandom,
  ): { lane: number; column: number } | undefined {
    const laneOrder = this.shuffle(
      Array.from({ length: lanes.length }, (_, index) => index),
      random,
    );
    const columns = this.shuffle(
      Array.from({ length: 5 - widthInCells }, (_, index) => index),
      random,
    );

    for (const lane of laneOrder) {
      for (const column of columns) {
        const end = column + widthInCells;
        const overlaps = lanes[lane].some(
          (occupied) => column < occupied.end && end > occupied.start,
        );

        if (!overlaps) {
          return { lane, column };
        }
      }
    }

    return undefined;
  }

  private createRegionsByAreaFigure(
    random: SeededRandom,
    figureId: string,
    isExample: boolean,
  ): GeneratedFigure {
    const counts = [1, 2, 3, 4].map(() =>
      isExample ? this.randomInt(random, 1, 2) : this.randomInt(random, 0, 3),
    );
    const items = this.shuffle(
      counts.flatMap((count, areaIndex) =>
        Array.from({ length: count }, (_, index) => ({
          index: `${areaIndex}-${index}`,
          area: areaIndex + 1,
        })),
      ),
      random,
    ).sort((first, second) => second.area - first.area);
    const occupied = new Set<string>();
    const shapes: GeometricShape[] = [];
    const subgridSize = 8;
    const subcellSize = 102 / subgridSize;
    const dimensions: Record<number, [number, number]> = {
      1: [1, 1],
      2: [2, 1],
      3: [3, 1],
      4: [2, 2],
    };

    for (const item of items) {
      const [widthInSubcells, heightInSubcells] = dimensions[item.area];
      const candidates = this.shuffle(
        Array.from(
          { length: (subgridSize - widthInSubcells + 1) * (subgridSize - heightInSubcells + 1) },
          (_, index) => ({
            row: Math.floor(index / (subgridSize - widthInSubcells + 1)),
            column: index % (subgridSize - widthInSubcells + 1),
          }),
        ),
        random,
      );
      const position = candidates.find((candidate) =>
        this.regionPositionIsOpen(candidate, widthInSubcells, heightInSubcells, occupied),
      );

      if (!position) continue;

      for (let row = position.row; row < position.row + heightInSubcells; row += 1) {
        for (
          let column = position.column;
          column < position.column + widthInSubcells;
          column += 1
        ) {
          occupied.add(`${row}:${column}`);
        }
      }

      shapes.push({
        id: `${figureId}-region-${item.index}`,
        kind: 'region',
        x: 14 + position.column * subcellSize,
        y: 14 + position.row * subcellSize,
        width: widthInSubcells * subcellSize,
        height: heightInSubcells * subcellSize,
        area: item.area,
      });
    }

    return { segments: [], shapes, code: counts.join(''), gridSize: 4 };
  }

  private regionPositionIsOpen(
    position: { row: number; column: number },
    width: number,
    height: number,
    occupied: Set<string>,
  ): boolean {
    for (let row = position.row; row < position.row + height; row += 1) {
      for (let column = position.column; column < position.column + width; column += 1) {
        if (occupied.has(`${row}:${column}`)) return false;
      }
    }

    return true;
  }

  private createTriangleShape(
    random: SeededRandom,
    figureId: string,
    index: string,
    orientation?: TriangleOrientation,
    size: TriangleSize = this.pick(['small', 'medium', 'large'], random),
  ): GeometricShape {
    const dimensions: Record<TriangleSize, number> = { small: 14, medium: 21, large: 28 };
    const dimension = dimensions[size];

    return {
      id: `${figureId}-triangle-${index}`,
      kind: 'triangle',
      x: this.randomInt(random, 18, 116 - dimension),
      y: this.randomInt(random, 18, 116 - dimension),
      width: dimension,
      height: dimension,
      orientation: orientation ?? this.pick(['up', 'down', 'left', 'right'], random),
      size,
    };
  }

  private createShapeByKindInGridCell(
    random: SeededRandom,
    figureId: string,
    index: string,
    kind: GeometricShapeKind,
    cell: { row: number; column: number },
  ): GeometricShape {
    const cellSize = 102 / 4;
    const triangleDimension = this.pick([10, 16, 21], random);
    const dimensions: Record<Exclude<GeometricShapeKind, 'region'>, [number, number]> = {
      square: [16, 16],
      rectangle: [20, 11],
      diamond: [17, 17],
      triangle: [triangleDimension, triangleDimension],
    };
    const [width, height] = dimensions[kind as Exclude<GeometricShapeKind, 'region'>];
    const x = 14 + cell.column * cellSize + (cellSize - width) / 2;
    const y = 14 + cell.row * cellSize + (cellSize - height) / 2;

    if (kind === 'triangle') {
      return {
        id: `${figureId}-triangle-closed-${index}`,
        kind,
        x,
        y,
        width,
        height,
        orientation: this.pick(['up', 'down', 'left', 'right'], random),
        size: width <= 10 ? 'small' : width <= 16 ? 'medium' : 'large',
      };
    }

    if (kind === 'square') {
      return { id: `${figureId}-square-${index}`, kind, x, y, width, height };
    }
    if (kind === 'rectangle') {
      return { id: `${figureId}-rectangle-${index}`, kind, x, y, width, height };
    }

    return { id: `${figureId}-diamond-${index}`, kind, x, y, width, height };
  }

  private createGridRectangle(
    random: SeededRandom,
    figureId: string,
    index: string,
    widthInCells: number,
  ): GeometricShape {
    const cellSize = 25.5;
    const column = this.randomInt(random, 0, 4 - widthInCells);
    const row = this.randomInt(random, 0, 3);

    return {
      id: `${figureId}-rectangle-width-${index}`,
      kind: 'rectangle',
      x: 14 + column * cellSize,
      y: 14 + row * cellSize,
      width: widthInCells * cellSize,
      height: cellSize,
    };
  }

  private createRegionShape(
    random: SeededRandom,
    figureId: string,
    index: string,
    area: number,
  ): GeometricShape {
    const cellSize = 25.5;
    const dimensions: Record<number, [number, number]> = {
      1: [1, 1],
      2: [2, 1],
      3: [3, 1],
      4: [2, 2],
    };
    const [widthInCells, heightInCells] = dimensions[area];
    const column = this.randomInt(random, 0, 4 - widthInCells);
    const row = this.randomInt(random, 0, 4 - heightInCells);

    return {
      id: `${figureId}-region-${index}`,
      kind: 'region',
      x: 14 + column * cellSize,
      y: 14 + row * cellSize,
      width: widthInCells * cellSize,
      height: heightInCells * cellSize,
      area,
    };
  }

  private networkNodeCoordinates(): number[] {
    return [14, 65, 116];
  }

  private networkEdgePool(figureId: string): PuzzleSegment[] {
    const coordinates = this.networkNodeCoordinates();
    const segments: PuzzleSegment[] = [];

    for (let row = 0; row < coordinates.length; row += 1) {
      for (let column = 0; column < coordinates.length - 1; column += 1) {
        segments.push({
          id: `${figureId}-network-h-${row}-${column}`,
          kind: 'horizontal',
          x1: coordinates[column],
          y1: coordinates[row],
          x2: coordinates[column + 1],
          y2: coordinates[row],
        });
      }
    }

    for (let row = 0; row < coordinates.length - 1; row += 1) {
      for (let column = 0; column < coordinates.length; column += 1) {
        segments.push({
          id: `${figureId}-network-v-${row}-${column}`,
          kind: 'vertical',
          x1: coordinates[column],
          y1: coordinates[row],
          x2: coordinates[column],
          y2: coordinates[row + 1],
        });
      }
    }

    return segments;
  }

  private createNetworkSegments(
    random: SeededRandom,
    figureId: string,
    connected: boolean,
  ): PuzzleSegment[] {
    const pool = this.networkEdgePool(figureId);

    if (!connected) {
      return this.shuffle(pool, random).slice(0, this.randomInt(random, 5, 9));
    }

    const selected = new Map<string, PuzzleSegment>();
    const coordinates = this.networkNodeCoordinates();

    for (let row = 0; row < coordinates.length; row += 1) {
      for (let column = 0; column < coordinates.length; column += 1) {
        if (row === 0 && column === 0) {
          continue;
        }

        const current = { x: coordinates[column], y: coordinates[row] };
        const previous: NetworkNode[] = [];

        if (column > 0) {
          previous.push({ x: coordinates[column - 1], y: coordinates[row] });
        }
        if (row > 0) {
          previous.push({ x: coordinates[column], y: coordinates[row - 1] });
        }

        const candidate = this.shuffle(
          pool.filter((segment) =>
            previous.some((node) => this.networkEdgeConnects(segment, current, node)),
          ),
          random,
        )[0];

        if (candidate) {
          selected.set(candidate.id, candidate);
        }
      }
    }

    if (random() > 0.35) {
      const extra = this.shuffle(
        pool.filter((segment) => !selected.has(segment.id)),
        random,
      )[0];
      if (extra) {
        selected.set(extra.id, extra);
      }
    }

    return [...selected.values()];
  }

  private networkEdgeConnects(
    segment: PuzzleSegment,
    first: NetworkNode,
    second: NetworkNode,
  ): boolean {
    return (
      (segment.x1 === first.x &&
        segment.y1 === first.y &&
        segment.x2 === second.x &&
        segment.y2 === second.y) ||
      (segment.x2 === first.x &&
        segment.y2 === first.y &&
        segment.x1 === second.x &&
        segment.y1 === second.y)
    );
  }

  private createNetworkGraph(segments: PuzzleSegment[]): NetworkGraph {
    const nodes = new Map<string, NetworkNode>();
    const adjacency = new Map<string, Set<string>>();

    for (const segment of segments) {
      const first = { x: segment.x1, y: segment.y1 };
      const second = { x: segment.x2, y: segment.y2 };
      const firstKey = this.networkKey(first);
      const secondKey = this.networkKey(second);
      nodes.set(firstKey, first);
      nodes.set(secondKey, second);
      if (!adjacency.has(firstKey)) adjacency.set(firstKey, new Set());
      if (!adjacency.has(secondKey)) adjacency.set(secondKey, new Set());
      adjacency.get(firstKey)?.add(secondKey);
      adjacency.get(secondKey)?.add(firstKey);
    }

    return { nodes, adjacency, edges: segments };
  }

  private networkKey(node: NetworkNode): string {
    return `${node.x},${node.y}`;
  }

  private networkComponents(graph: NetworkGraph): NetworkComponent[] {
    const remaining = new Set(graph.nodes.keys());
    const components: NetworkComponent[] = [];

    while (remaining.size) {
      const start = remaining.values().next().value as string;
      const nodes = new Set<string>([start]);
      const queue = [start];
      remaining.delete(start);

      while (queue.length) {
        const current = queue.shift() as string;
        for (const neighbor of graph.adjacency.get(current) ?? []) {
          if (!nodes.has(neighbor)) {
            nodes.add(neighbor);
            remaining.delete(neighbor);
            queue.push(neighbor);
          }
        }
      }

      components.push({
        nodes,
        edges: graph.edges.filter(
          (edge) =>
            nodes.has(this.networkKey({ x: edge.x1, y: edge.y1 })) &&
            nodes.has(this.networkKey({ x: edge.x2, y: edge.y2 })),
        ),
      });
    }

    return components;
  }

  private networkDegreeCounts(graph: NetworkGraph): number[] {
    const counts = [0, 0, 0, 0];
    for (const neighbors of graph.adjacency.values()) {
      const degree = Math.min(4, neighbors.size);
      if (degree > 0) counts[degree - 1] += 1;
    }
    return counts;
  }

  private networkNodeMarkers(graph: NetworkGraph, figureId: string): FigureMarker[] {
    return [...graph.nodes.values()].map((node, index) => ({
      id: `${figureId}-node-${index}`,
      x: node.x,
      y: node.y,
      label: '',
    }));
  }

  private withNetworkNodeMarkers(
    segments: PuzzleSegment[],
    markers: FigureMarker[],
    figureId: string,
  ): FigureMarker[] {
    const markedPositions = new Set(markers.map((marker) => `${marker.x},${marker.y}`));
    const graph = this.createNetworkGraph(segments);
    const nodeMarkers = this.networkNodeMarkers(graph, figureId).filter(
      (marker) => !markedPositions.has(`${marker.x},${marker.y}`),
    );

    return [...markers, ...nodeMarkers];
  }

  private networkJunctionCounts(graph: NetworkGraph): number[] {
    const counts = [0, 0, 0, 0];

    for (const [key, neighbors] of graph.adjacency.entries()) {
      const degree = neighbors.size;
      if (degree === 1) counts[0] += 1;
      if (degree === 3) counts[2] += 1;
      if (degree === 4) counts[3] += 1;
      if (degree === 2) {
        const node = graph.nodes.get(key) as NetworkNode;
        const [first, second] = [...neighbors].map(
          (neighbor) => graph.nodes.get(neighbor) as NetworkNode,
        );
        const isStraight =
          (first.x === node.x && second.x === node.x) ||
          (first.y === node.y && second.y === node.y);
        if (!isStraight) counts[1] += 1;
      }
    }

    return counts;
  }

  private networkCycleRank(graph: NetworkGraph): number {
    return Math.max(
      0,
      graph.edges.length - graph.nodes.size + this.networkComponents(graph).length,
    );
  }

  private networkCriticalPoints(graph: NetworkGraph): { articulations: number; bridges: number } {
    const discovery = new Map<string, number>();
    const low = new Map<string, number>();
    const articulationPoints = new Set<string>();
    let time = 0;
    let bridges = 0;

    const visit = (current: string, parent: string | undefined): void => {
      discovery.set(current, ++time);
      low.set(current, time);
      let children = 0;

      for (const neighbor of graph.adjacency.get(current) ?? []) {
        if (neighbor === parent) continue;
        if (!discovery.has(neighbor)) {
          children += 1;
          visit(neighbor, current);
          low.set(current, Math.min(low.get(current) as number, low.get(neighbor) as number));
          if (
            parent !== undefined &&
            (low.get(neighbor) as number) >= (discovery.get(current) as number)
          ) {
            articulationPoints.add(current);
          }
          if ((low.get(neighbor) as number) > (discovery.get(current) as number)) {
            bridges += 1;
          }
        } else {
          low.set(current, Math.min(low.get(current) as number, discovery.get(neighbor) as number));
        }
      }

      if (parent === undefined && children > 1) {
        articulationPoints.add(current);
      }
    };

    for (const node of graph.nodes.keys()) {
      if (!discovery.has(node)) visit(node, undefined);
    }

    return { articulations: articulationPoints.size, bridges };
  }

  private networkPairConnections(
    graph: NetworkGraph,
    firstPredicate: (node: NetworkNode) => boolean,
    secondPredicate: (node: NetworkNode) => boolean,
  ): number {
    return this.networkComponents(graph).filter((component) => {
      const touchesFirst = [...component.nodes].some((key) =>
        firstPredicate(graph.nodes.get(key) as NetworkNode),
      );
      const touchesSecond = [...component.nodes].some((key) =>
        secondPredicate(graph.nodes.get(key) as NetworkNode),
      );
      return touchesFirst && touchesSecond;
    }).length;
  }

  private networkRegionStats(graph: NetworkGraph): number[] {
    const coordinates = this.networkNodeCoordinates();
    let closed = 0;
    let openOneSide = 0;
    let openSeveralSides = 0;

    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 2; column += 1) {
        const top = this.networkHasEdge(
          graph,
          { x: coordinates[column], y: coordinates[row] },
          { x: coordinates[column + 1], y: coordinates[row] },
        );
        const right = this.networkHasEdge(
          graph,
          { x: coordinates[column + 1], y: coordinates[row] },
          { x: coordinates[column + 1], y: coordinates[row + 1] },
        );
        const bottom = this.networkHasEdge(
          graph,
          { x: coordinates[column], y: coordinates[row + 1] },
          { x: coordinates[column + 1], y: coordinates[row + 1] },
        );
        const left = this.networkHasEdge(
          graph,
          { x: coordinates[column], y: coordinates[row] },
          { x: coordinates[column], y: coordinates[row + 1] },
        );
        const sides = [top, right, bottom, left].filter(Boolean).length;

        if (sides === 4) closed += 1;
        else if (sides === 3) openOneSide += 1;
        else if (sides > 0) openSeveralSides += 1;
      }
    }

    return [closed, openOneSide, openSeveralSides, Math.max(0, this.networkCycleRank(graph) - 1)];
  }

  private networkHasEdge(graph: NetworkGraph, first: NetworkNode, second: NetworkNode): boolean {
    return graph.adjacency.get(this.networkKey(first))?.has(this.networkKey(second)) ?? false;
  }

  private createMarkedPathLengthsFigure(random: SeededRandom, figureId: string): GeneratedFigure {
    const graph = this.createNetworkGraph(this.createNetworkSegments(random, figureId, true));
    const component = this.networkComponents(graph)[0];
    const nodes = this.shuffle([...component.nodes], random).slice(0, 8);
    const markers: FigureMarker[] = [];
    const lengths: number[] = [];

    for (let index = 0; index < 8; index += 1) {
      const key = nodes[index];
      const node = graph.nodes.get(key) as NetworkNode;
      markers.push({
        id: `${figureId}-marker-${index}`,
        x: node.x,
        y: node.y,
        label: String.fromCharCode(65 + index),
      });
    }
    for (let index = 0; index < 8; index += 2) {
      lengths.push(this.networkShortestPath(graph, nodes[index], nodes[index + 1]));
    }

    return { segments: graph.edges, markers, code: lengths.join(''), gridSize: 2 };
  }

  private networkShortestPath(graph: NetworkGraph, first: string, second: string): number;
  private networkShortestPath(graph: NetworkGraph, first: NetworkNode, second: NetworkNode): number;
  private networkShortestPath(
    graph: NetworkGraph,
    first: string | NetworkNode,
    second: string | NetworkNode,
  ): number {
    const start = typeof first === 'string' ? first : this.networkKey(first);
    const target = typeof second === 'string' ? second : this.networkKey(second);
    const distances = new Map<string, number>([[start, 0]]);
    const queue = [start];

    while (queue.length) {
      const current = queue.shift() as string;
      if (current === target) return distances.get(current) as number;
      for (const neighbor of graph.adjacency.get(current) ?? []) {
        if (!distances.has(neighbor)) {
          distances.set(neighbor, (distances.get(current) as number) + 1);
          queue.push(neighbor);
        }
      }
    }

    return 0;
  }

  private createAccessibleDeadEndsFigure(random: SeededRandom, figureId: string): GeneratedFigure {
    const graph = this.createNetworkGraph(this.createNetworkSegments(random, figureId, true));
    const entries: NetworkNode[] = [
      { x: 14, y: 14 },
      { x: 116, y: 14 },
      { x: 116, y: 116 },
      { x: 14, y: 116 },
    ];
    const leaves = [...graph.adjacency.entries()]
      .filter(([, neighbors]) => neighbors.size === 1)
      .map(([key]) => key);
    const markers = entries.map((node, index) => ({
      id: `${figureId}-entry-${index}`,
      x: node.x,
      y: node.y,
      label: String(index + 1),
    }));
    const code = entries.map((entry) => {
      const entryKey = this.networkKey(entry);
      return graph.nodes.has(entryKey) ? leaves.length : 0;
    });

    return { segments: graph.edges, markers, code: code.join(''), gridSize: 2 };
  }

  private createDirectionalTraversalFigure(
    random: SeededRandom,
    figureId: string,
  ): GeneratedFigure {
    const coordinates = this.networkNodeCoordinates();
    const path: NetworkNode[] = [
      { x: coordinates[0], y: coordinates[0] },
      { x: coordinates[1], y: coordinates[0] },
      { x: coordinates[2], y: coordinates[0] },
      { x: coordinates[2], y: coordinates[1] },
      { x: coordinates[1], y: coordinates[1] },
      { x: coordinates[0], y: coordinates[1] },
      { x: coordinates[0], y: coordinates[2] },
      { x: coordinates[1], y: coordinates[2] },
      { x: coordinates[2], y: coordinates[2] },
    ];
    if (random() > 0.5) path.reverse();
    const pool = this.networkEdgePool(figureId);
    const segments = path
      .slice(0, -1)
      .map(
        (node, index) =>
          pool.find((segment) =>
            this.networkEdgeConnects(segment, node, path[index + 1]),
          ) as PuzzleSegment,
      );
    const counts = [0, 0, 0, 0];

    for (let index = 0; index < path.length - 1; index += 1) {
      const current = path[index];
      const next = path[index + 1];
      if (next.y < current.y) counts[0] += 1;
      if (next.x > current.x) counts[1] += 1;
      if (next.y > current.y) counts[2] += 1;
      if (next.x < current.x) counts[3] += 1;
    }

    return {
      segments,
      markers: [{ id: `${figureId}-start`, x: path[0].x, y: path[0].y, label: 'D' }],
      code: counts.join(''),
      gridSize: 2,
    };
  }

  private generateSevenSegmentVariantFigure(
    random: SeededRandom,
    difficulty: number,
    figureId: string,
    variantId: string,
    isExample: boolean,
    sharedSegmentConfiguration?: number[],
  ): GeneratedFigure {
    const digits = () => Array.from({ length: 4 }, () => this.randomInt(random, 0, 9));

    switch (variantId) {
      case '3-1-broken-segment': {
        const invertedSegments =
          sharedSegmentConfiguration ?? this.shuffle([0, 1, 2, 3, 4, 5, 6], random).slice(0, 2);
        let values = digits();
        const invertedKey = [...invertedSegments].sort((first, second) => first - second).join(',');

        for (let attempt = 0; attempt < 100; attempt += 1) {
          const candidateValues = digits();
          const candidateDisplays = candidateValues
            .slice(0, 2)
            .map((digit) =>
              this.sevenSegmentMask(digit).map((lit, index) =>
                invertedSegments.includes(index) ? !lit : lit,
              ),
            );
          const candidates = this.sevenSegmentInvertedPairCandidates(
            candidateValues.slice(0, 2),
            candidateDisplays,
          );

          values = candidateValues;
          if (candidates.length === 1 && candidates[0].join(',') === invertedKey) {
            break;
          }
        }
        return {
          sevenSegmentDigits: this.sevenSegmentRow(
            values.map((digit) =>
              this.sevenSegmentMask(digit).map((lit, index) =>
                invertedSegments.includes(index) ? !lit : lit,
              ),
            ),
            figureId,
            50,
          ),
          notes: [
            {
              id: `${figureId}-note`,
              x: 18,
              y: 32,
              text: 'Mêmes segments inversés sur chaque chiffre',
            },
          ],
          code: values.join(''),
          gridSize: 4,
        };
      }
      case '3-3-move-one-segment': {
        let initial = digits();
        let result = this.sevenSegmentBestMove(initial);

        for (let attempt = 0; attempt < 100 && !result; attempt += 1) {
          initial = digits();
          result = this.sevenSegmentBestMove(initial);
        }

        if (!result) {
          initial = [3, 4, 8, 5];
          result = this.sevenSegmentBestMove(initial) ?? [9, 4, 9, 5];
        }
        return {
          sevenSegmentDigits: this.sevenSegmentRow(initial, figureId, 50),
          notes: [
            { id: `${figureId}-note`, x: 18, y: 32, text: 'Deplacer 1 segment; plus grand nombre' },
          ],
          code: result.join(''),
          gridSize: 4,
        };
      }
      case '3-4-segment-sequence': {
        const values = random() < 0.5 ? [0, 8, 9, 8] : [8, 9, 8, 0];
        const shown = isExample ? values : [0, 8, 9, null];
        return {
          sevenSegmentDigits: this.sevenSegmentRow(shown, figureId, 50),
          notes: [
            { id: `${figureId}-note`, x: 18, y: 32, text: 'Regle: alterner ajout et retrait' },
          ],
          code: values.join(''),
          gridSize: 4,
        };
      }
      case '3-5-minimum-transition-cost': {
        const available = this.shuffle([0, 1, 8, 9], random);
        const route = this.sevenSegmentPermutations(available).sort(
          (first, second) => this.sevenSegmentRouteCost(first) - this.sevenSegmentRouteCost(second),
        )[0];
        return {
          sevenSegmentDigits: this.sevenSegmentRow(available, figureId, 50),
          notes: [{ id: `${figureId}-note`, x: 18, y: 32, text: 'Cout = segments changes' }],
          code: route.join(''),
          gridSize: 4,
        };
      }
      case '3-6-superimposed-digits': {
        const pairs = this.shuffle(
          [
            [0, 8],
            [2, 3],
            [4, 9],
            [5, 6],
          ],
          random,
        ).slice(0, 2);
        const displays = pairs.map((pair, index) => ({
          ...this.sevenSegmentDisplay(
            `${figureId}-super-${index}`,
            31 + index * 47,
            49,
            this.sevenSegmentUnion(this.sevenSegmentMask(pair[0]), this.sevenSegmentMask(pair[1])),
            26,
            43,
          ),
        }));
        return {
          sevenSegmentDigits: displays,
          notes: [
            { id: `${figureId}-note-a`, x: 18, y: 30, text: 'Deux chiffres par afficheur' },
            {
              id: `${figureId}-note-b`,
              x: 18,
              y: 40,
              text: `Indice: ${pairs[0][0]} est dans le premier`,
            },
          ],
          code: pairs.flat().join(''),
          gridSize: 4,
        };
      }
      case '3-7-common-segments': {
        const pairs = this.shuffle(
          [
            [0, 8],
            [2, 3],
            [4, 9],
            [5, 6],
          ],
          random,
        ).slice(0, 2);
        const displays = pairs.map((pair, index) =>
          this.sevenSegmentDisplay(
            `${figureId}-common-${index}`,
            31 + index * 47,
            49,
            this.sevenSegmentIntersection(
              this.sevenSegmentMask(pair[0]),
              this.sevenSegmentMask(pair[1]),
            ),
            26,
            43,
          ),
        );
        return {
          sevenSegmentDigits: displays,
          notes: [
            { id: `${figureId}-note-a`, x: 18, y: 30, text: 'Segments communs aux deux chiffres' },
            {
              id: `${figureId}-note-b`,
              x: 18,
              y: 40,
              text: `Indice: ${pairs[0][0]} est dans le premier`,
            },
          ],
          code: pairs.flat().join(''),
          gridSize: 4,
        };
      }
      case '3-8-segment-algebra': {
        const values = digits();
        return {
          sevenSegmentDigits: this.sevenSegmentRow(values, figureId, 66, 15, 28),
          notes: [
            { id: `${figureId}-note-a`, x: 18, y: 30, text: 'a+b=3, a=1  c+d=7, c=3' },
            { id: `${figureId}-note-b`, x: 18, y: 43, text: 'e+f=11, e=5  g=7' },
          ],
          code: values.join(''),
          gridSize: 4,
        };
      }
      case '3-9-segment-frequency-map': {
        const values = this.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], random).slice(0, 4);
        const frequencies = values.reduce(
          (counts, digit) =>
            counts.map((count, index) => count + Number(this.sevenSegmentMask(digit)[index])),
          [0, 0, 0, 0, 0, 0, 0],
        );
        return {
          sevenSegmentDigits: [],
          notes: [
            {
              id: `${figureId}-note-a`,
              x: 18,
              y: 34,
              text: `a:${frequencies[0]} b:${frequencies[1]} c:${frequencies[2]} d:${frequencies[3]}`,
            },
            {
              id: `${figureId}-note-b`,
              x: 18,
              y: 50,
              text: `e:${frequencies[4]} f:${frequencies[5]} g:${frequencies[6]}`,
            },
            {
              id: `${figureId}-note-c`,
              x: 18,
              y: 72,
              text: '4 chiffres distincts; debut 0, fin 9',
            },
          ],
          code: values.join(''),
          gridSize: 4,
        };
      }
      case '3-10-segment-path': {
        const route = random() < 0.5 ? [0, 8, 9, 3] : [3, 9, 8, 0];
        const distractors = [1, 4];
        return {
          sevenSegmentDigits: [
            ...this.sevenSegmentRow(route, `${figureId}-route`, 31, 18, 32),
            ...this.sevenSegmentRow(distractors, `${figureId}-decoy`, 78, 18, 32),
          ],
          notes: [
            { id: `${figureId}-note-a`, x: 18, y: 104, text: 'Relier si 1 segment change' },
            {
              id: `${figureId}-note-b`,
              x: 18,
              y: 113,
              text: `Depart ${route[0]} / arrivee ${route[3]}`,
            },
          ],
          code: route.join(''),
          gridSize: 4,
        };
      }
      default:
        return {
          sevenSegmentDigits: this.sevenSegmentRow([0, 8, 9, 3], figureId, 50),
          code: '0893',
          gridSize: 4,
        };
    }
  }

  private sevenSegmentMask(digit: number): boolean[] {
    const masks = [
      [true, true, true, true, true, true, false],
      [false, true, true, false, false, false, false],
      [true, true, false, true, true, false, true],
      [true, true, true, true, false, false, true],
      [false, true, true, false, false, true, true],
      [true, false, true, true, false, true, true],
      [true, false, true, true, true, true, true],
      [true, true, true, false, false, false, false],
      [true, true, true, true, true, true, true],
      [true, true, true, true, false, true, true],
    ];

    return [...masks[digit]];
  }

  private sevenSegmentDisplay(
    id: string,
    x: number,
    y: number,
    segments: boolean[],
    width = 17,
    height = 28,
  ): SevenSegmentDisplay {
    return { id, x, y, width, height, segments };
  }

  private sevenSegmentRow(
    values: Array<number | boolean[] | null>,
    figureId: string,
    y: number,
    width = 18,
    height = 40,
  ): SevenSegmentDisplay[] {
    const gap = values.length <= 2 ? 10 : 12;
    const startX = values.length <= 2 ? 31 : 10;

    return values.map((value, index) => ({
      ...this.sevenSegmentDisplay(
        `${figureId}-digit-${index}`,
        startX + index * (width + gap),
        y,
        value === null
          ? [false, false, false, false, false, false, false]
          : Array.isArray(value)
            ? value
            : this.sevenSegmentMask(value),
        width,
        height,
      ),
      missing: value === null,
    }));
  }

  private sevenSegmentUnion(first: boolean[], second: boolean[]): boolean[] {
    return first.map((lit, index) => lit || second[index]);
  }

  private sevenSegmentIntersection(first: boolean[], second: boolean[]): boolean[] {
    return first.map((lit, index) => lit && second[index]);
  }

  private sevenSegmentBestMove(digits: number[]): number[] | undefined {
    let bestResult: number[] | undefined;
    let bestValue = Number(digits.join(''));

    for (let sourcePosition = 0; sourcePosition < digits.length; sourcePosition += 1) {
      for (let targetPosition = 0; targetPosition < digits.length; targetPosition += 1) {
        if (sourcePosition === targetPosition) {
          continue;
        }

        const sourceMask = this.sevenSegmentMask(digits[sourcePosition]);
        const targetMask = this.sevenSegmentMask(digits[targetPosition]);

        for (let removed = 0; removed < 7; removed += 1) {
          if (!sourceMask[removed]) {
            continue;
          }

          const sourceResult = this.sevenSegmentDigitForMask(
            sourceMask.map((lit, index) => lit && index !== removed),
          );
          if (sourceResult === undefined) {
            continue;
          }

          for (let added = 0; added < 7; added += 1) {
            if (targetMask[added]) {
              continue;
            }

            const targetResult = this.sevenSegmentDigitForMask(
              targetMask.map((lit, index) => lit || index === added),
            );
            if (targetResult === undefined) {
              continue;
            }

            const candidate = [...digits];
            candidate[sourcePosition] = sourceResult;
            candidate[targetPosition] = targetResult;
            const candidateValue = Number(candidate.join(''));
            if (candidateValue > bestValue) {
              bestValue = candidateValue;
              bestResult = candidate;
            }
          }
        }
      }
    }

    return bestResult;
  }

  private sevenSegmentDigitForMask(mask: boolean[]): number | undefined {
    for (let digit = 0; digit <= 9; digit += 1) {
      if (this.sevenSegmentMask(digit).every((lit, index) => lit === mask[index])) {
        return digit;
      }
    }

    return undefined;
  }

  private sevenSegmentInvertedPairCandidates(digits: number[], displays: boolean[][]): number[][] {
    const candidates: number[][] = [];

    for (let first = 0; first < 7; first += 1) {
      for (let second = first + 1; second < 7; second += 1) {
        const matches = digits.every((digit, index) => {
          const mask = this.sevenSegmentMask(digit);
          const expected = mask.map((lit, segment) =>
            segment === first || segment === second ? !lit : lit,
          );
          return expected.every((lit, segment) => lit === displays[index][segment]);
        });

        if (matches) {
          candidates.push([first, second]);
        }
      }
    }

    return candidates;
  }

  private sevenSegmentPermutations(values: number[]): number[][] {
    if (values.length <= 1) {
      return [values];
    }

    return values.flatMap((value, index) =>
      this.sevenSegmentPermutations([...values.slice(0, index), ...values.slice(index + 1)]).map(
        (rest) => [value, ...rest],
      ),
    );
  }

  private sevenSegmentRouteCost(route: number[]): number {
    return route
      .slice(1)
      .reduce(
        (total, digit, index) =>
          total +
          this.sevenSegmentMask(digit).reduce(
            (cost, lit, segment) =>
              cost + Number(lit !== this.sevenSegmentMask(route[index])[segment]),
            0,
          ),
        0,
      );
  }

  private generateVariantFigure(
    random: SeededRandom,
    difficulty: number,
    figureId: string,
    variantId: string,
    sourceId: string,
  ): GeneratedFigure {
    const isExample = sourceId !== 'challenge';

    switch (variantId) {
      case '1-2-continuous-lines-by-orientation':
        return this.createContinuousFigureWithCode(random, difficulty, figureId, isExample);
      case '1-3-segments-by-length':
        return this.createSegmentsByLengthFigure(random, difficulty, figureId);
      case '1-4-cell-content':
        return this.createCellContentFigure(random, figureId, isExample);
      case '1-5-internal-lines-per-cell':
        return this.createInternalLinesPerCellFigure(random, figureId, isExample);
      case '1-6-cells-by-sides':
        return this.createCellsBySidesFigure(random, figureId, isExample);
      case '1-7-visible-outer-borders':
        return this.createVisibleOuterBordersFigure(random, figureId);
      case '1-8-quadrant-occupation':
        return this.createQuadrantOccupationFigure(random, figureId, isExample);
      case '1-1-segments-by-orientation':
      default:
        return this.createSegmentsByOrientationFigure(random, difficulty, figureId, isExample);
    }
  }

  private createSegmentsByOrientationFigure(
    random: SeededRandom,
    difficulty: number,
    figureId: string,
    ensureAllOrientations = false,
  ): GeneratedFigure {
    const maxPerKind = Math.min(6, 2 + difficulty);
    const kinds: SegmentKind[] = ['horizontal', 'vertical', 'slash', 'backslash'];
    const counts = kinds.map((kind) =>
      this.randomInt(
        random,
        ensureAllOrientations || kind === 'horizontal' || kind === 'vertical' ? 1 : 0,
        maxPerKind,
      ),
    );
    const segments = kinds.flatMap((kind, index) =>
      this.pickSegments(random, kind, counts[index], figureId),
    );

    return { segments, code: counts.join('') };
  }

  private createContinuousFigureWithCode(
    random: SeededRandom,
    difficulty: number,
    figureId: string,
    ensureJoinedLines = false,
  ): GeneratedFigure {
    const counts: Record<SegmentKind, number> = {
      horizontal: 0,
      vertical: 0,
      slash: 0,
      backslash: 0,
    };
    const segments = this.createContinuousFigure(
      random,
      difficulty,
      figureId,
      counts,
      ensureJoinedLines,
    );

    return {
      segments,
      code: `${counts.horizontal}${counts.vertical}${counts.slash}${counts.backslash}`,
    };
  }

  private createSegmentsByLengthFigure(
    random: SeededRandom,
    difficulty: number,
    figureId: string,
  ): GeneratedFigure {
    const counts = [1, 2, 3, 4].map(() => this.randomInt(random, 1, Math.min(2, difficulty)));
    const segments: PuzzleSegment[] = [];

    counts.forEach((count, index) => {
      const length = index + 1;
      const candidates = this.shuffle(this.segmentPoolByLength(length, figureId), random).filter(
        (candidate) => !segments.some((selected) => this.segmentsOverlap(candidate, selected)),
      );
      segments.push(...candidates.slice(0, count));
    });

    return { segments, code: counts.join(''), gridSize: 4 };
  }

  private createCellContentFigure(
    random: SeededRandom,
    figureId: string,
    ensureAllContents = false,
  ): GeneratedFigure {
    const counts = [0, 0, 0, 0];
    const segments: PuzzleSegment[] = [];
    let cellIndex = 0;

    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const content =
          ensureAllContents && cellIndex < 4 ? cellIndex : this.randomInt(random, 0, 3);
        counts[content] += 1;

        if (content === 1 || content === 3) {
          segments.push(this.createInternalCellSegment(row, column, 'slash', figureId));
        }
        if (content === 2 || content === 3) {
          segments.push(this.createInternalCellSegment(row, column, 'backslash', figureId));
        }

        cellIndex += 1;
      }
    }

    return { segments, code: counts.join('') };
  }

  private createInternalLinesPerCellFigure(
    random: SeededRandom,
    figureId: string,
    ensureAllLineCounts = false,
  ): GeneratedFigure {
    const counts = [0, 0, 0, 0];
    const segments: PuzzleSegment[] = [];
    const kinds: SegmentKind[] = ['horizontal', 'vertical', 'slash', 'backslash'];
    let cellIndex = 0;

    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const lineCount =
          ensureAllLineCounts && cellIndex < 4 ? cellIndex : this.randomInt(random, 0, 3);
        counts[lineCount] += 1;
        const cellKinds = this.shuffle(kinds, random).slice(0, lineCount);
        segments.push(
          ...cellKinds.map((kind) => this.createInternalCellSegment(row, column, kind, figureId)),
        );
        cellIndex += 1;
      }
    }

    return { segments, code: counts.join('') };
  }

  private createCellsBySidesFigure(
    random: SeededRandom,
    figureId: string,
    ensureAllSideCounts = false,
  ): GeneratedFigure {
    const sides = ['top', 'right', 'bottom', 'left'] as const;
    let finalSegments: PuzzleSegment[] = [];
    let counts = [0, 0, 0, 0];
    const attempts = ensureAllSideCounts ? 100 : 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const segments = new Map<string, PuzzleSegment>();

      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          const sideCount = this.randomInt(random, 1, 4);
          const cellSides = this.shuffle(sides, random).slice(0, sideCount);

          for (const side of cellSides) {
            const segment = this.createCellSideSegment(row, column, side, figureId);
            segments.set(segment.id, segment);
          }
        }
      }

      finalSegments = [...segments.values()];
      counts = this.countCellSideCategories(finalSegments, figureId);

      if (!ensureAllSideCounts || counts.every((count) => count > 0)) {
        break;
      }
    }

    return { segments: finalSegments, code: counts.join('') };
  }

  private countCellSideCategories(segments: PuzzleSegment[], figureId: string): number[] {
    const counts = [0, 0, 0, 0];
    const sides = ['top', 'right', 'bottom', 'left'] as const;

    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const sideCount = sides.filter((side) => {
          const sideSegment = this.createCellSideSegment(row, column, side, figureId);
          return segments.some((segment) => segment.id === sideSegment.id);
        }).length;

        if (sideCount > 0) {
          counts[sideCount - 1] += 1;
        }
      }
    }

    return counts;
  }

  private createVisibleOuterBordersFigure(random: SeededRandom, figureId: string): GeneratedFigure {
    const sides = ['top', 'right', 'bottom', 'left'] as const;
    const counts = sides.map(() => 0);
    const segments = new Map<string, PuzzleSegment>();

    sides.forEach((side, index) => {
      const candidates = this.boundarySegmentPool(side, figureId);
      const selected = this.shuffle(candidates, random).slice(0, this.randomInt(random, 1, 3));
      counts[index] = selected.length;
      selected.forEach((segment) => segments.set(segment.id, segment));
    });

    this.shuffle(this.segmentPool('slash', figureId), random)
      .slice(0, 3)
      .forEach((segment) => segments.set(segment.id, segment));

    return { segments: [...segments.values()], code: counts.join('') };
  }

  private createLinesEnteringFigure(random: SeededRandom, figureId: string): GeneratedFigure {
    const sides = ['top', 'right', 'bottom', 'left'] as const;
    const segments: PuzzleSegment[] = [];

    sides.forEach((side) => {
      const candidates = this.enteringSegmentPool(side, figureId);
      segments.push(...this.shuffle(candidates, random).slice(0, this.randomInt(random, 1, 2)));
    });

    segments.push(...this.shuffle(this.segmentPool('backslash', figureId), random).slice(0, 3));

    const counts = sides.map((side) => this.countEnteringLines(segments, side));
    return { segments, code: counts.join('') };
  }

  private createEndpointsOnSidesFigure(
    random: SeededRandom,
    figureId: string,
    ensureAllSides = false,
  ): GeneratedFigure {
    const boundarySegments = [
      ...this.segmentPool('horizontal', figureId),
      ...this.segmentPool('vertical', figureId),
      ...this.segmentPool('slash', figureId),
      ...this.segmentPool('backslash', figureId),
    ].filter((segment) => this.segmentHasBoundaryEndpoint(segment));
    const selected = new Map<string, PuzzleSegment>();

    if (ensureAllSides) {
      (['top', 'right', 'bottom', 'left'] as FigureSide[]).forEach((side) => {
        const candidate = this.shuffle(
          boundarySegments.filter((segment) => this.countEndpointsOnSide(segment, side) > 0),
          random,
        ).find((segment) => !selected.has(segment.id));

        if (candidate) {
          selected.set(candidate.id, candidate);
        }
      });
    }

    this.shuffle(boundarySegments, random)
      .filter((segment) => !selected.has(segment.id))
      .slice(0, Math.max(0, 10 - selected.size))
      .forEach((segment) => selected.set(segment.id, segment));

    const segments = [...selected.values()];
    const counts = (['top', 'right', 'bottom', 'left'] as FigureSide[]).map((side) =>
      segments.reduce((total, segment) => total + this.countEndpointsOnSide(segment, side), 0),
    );

    return { segments, code: counts.join('') };
  }

  private createQuadrantOccupationFigure(
    random: SeededRandom,
    figureId: string,
    ensureAllQuadrants = false,
  ): GeneratedFigure {
    const allCells = Array.from({ length: 16 }, (_, index) => index);
    const requiredCells = ensureAllQuadrants ? [0, 2, 8, 10] : [];
    const occupiedCount = this.randomInt(random, 6, 12);
    const extraCells = this.shuffle(
      allCells.filter((index) => !requiredCells.includes(index)),
      random,
    ).slice(0, occupiedCount - requiredCells.length);
    const occupiedCells = [...requiredCells, ...extraCells];
    const segments = occupiedCells.map((index) =>
      this.createInternalCellSegment(
        Math.floor(index / 4),
        index % 4,
        random() < 0.5 ? 'slash' : 'backslash',
        figureId,
        25.5,
      ),
    );
    const counts = [0, 0, 0, 0];

    for (const index of occupiedCells) {
      const row = Math.floor(index / 4);
      const column = index % 4;
      const quadrant = Math.floor(row / 2) * 2 + Math.floor(column / 2);
      counts[quadrant] += 1;
    }

    return { segments, code: counts.join(''), gridSize: 4 };
  }

  private segmentPoolByLength(length: number, figureId: string): PuzzleSegment[] {
    const unit = 25.5;
    const offset = 14;
    const gridUnits = 4;
    const maxStart = gridUnits - length;
    const segments: PuzzleSegment[] = [];

    for (let row = 1; row < gridUnits; row += 1) {
      for (let column = 0; column <= maxStart; column += 1) {
        const x = offset + column * unit;
        const y = offset + row * unit;
        segments.push({
          id: `${figureId}-horizontal-length-${length}-${row}-${column}`,
          kind: 'horizontal',
          x1: x,
          y1: y,
          x2: x + length * unit,
          y2: y,
        });
      }
    }

    for (let row = 0; row <= maxStart; row += 1) {
      for (let column = 1; column < gridUnits; column += 1) {
        const x = offset + column * unit;
        const y = offset + row * unit;
        segments.push({
          id: `${figureId}-vertical-length-${length}-${row}-${column}`,
          kind: 'vertical',
          x1: x,
          y1: y,
          x2: x,
          y2: y + length * unit,
        });
      }
    }

    for (let row = 0; row <= maxStart; row += 1) {
      for (let column = 0; column <= maxStart; column += 1) {
        const left = offset + column * unit;
        const top = offset + row * unit;
        const right = left + length * unit;
        const bottom = top + length * unit;
        const prefix = `${figureId}-length-${length}-${row}-${column}`;
        segments.push({
          id: `${prefix}-slash`,
          kind: 'slash',
          x1: right,
          y1: top,
          x2: left,
          y2: bottom,
        });
        segments.push({
          id: `${prefix}-backslash`,
          kind: 'backslash',
          x1: left,
          y1: top,
          x2: right,
          y2: bottom,
        });
      }
    }

    return segments;
  }

  private createInternalCellSegment(
    row: number,
    column: number,
    kind: SegmentKind,
    figureId: string,
    cellSize = 34,
  ): PuzzleSegment {
    const offset = 14;
    const inset = cellSize * 0.18;
    const left = offset + column * cellSize;
    const top = offset + row * cellSize;
    const right = left + cellSize;
    const bottom = top + cellSize;
    const centerX = left + cellSize / 2;
    const centerY = top + cellSize / 2;

    switch (kind) {
      case 'horizontal':
        return {
          id: `${figureId}-internal-horizontal-${row}-${column}`,
          kind,
          x1: left + inset,
          y1: centerY,
          x2: right - inset,
          y2: centerY,
        };
      case 'vertical':
        return {
          id: `${figureId}-internal-vertical-${row}-${column}`,
          kind,
          x1: centerX,
          y1: top + inset,
          x2: centerX,
          y2: bottom - inset,
        };
      case 'slash':
        return {
          id: `${figureId}-internal-slash-${row}-${column}`,
          kind,
          x1: right - inset,
          y1: top + inset,
          x2: left + inset,
          y2: bottom - inset,
        };
      case 'backslash':
        return {
          id: `${figureId}-internal-backslash-${row}-${column}`,
          kind,
          x1: left + inset,
          y1: top + inset,
          x2: right - inset,
          y2: bottom - inset,
        };
    }
  }

  private createCellSideSegment(
    row: number,
    column: number,
    side: FigureSide,
    figureId: string,
  ): PuzzleSegment {
    const cellSize = 34;
    const offset = 14;
    const left = offset + column * cellSize;
    const top = offset + row * cellSize;
    const right = left + cellSize;
    const bottom = top + cellSize;

    if (side === 'top') {
      return {
        id: `${figureId}-horizontal-${row}-${column}`,
        kind: 'horizontal',
        x1: left,
        y1: top,
        x2: right,
        y2: top,
      };
    }

    if (side === 'right') {
      return {
        id: `${figureId}-vertical-${row}-${column + 1}`,
        kind: 'vertical',
        x1: right,
        y1: top,
        x2: right,
        y2: bottom,
      };
    }

    if (side === 'bottom') {
      return {
        id: `${figureId}-horizontal-${row + 1}-${column}`,
        kind: 'horizontal',
        x1: left,
        y1: bottom,
        x2: right,
        y2: bottom,
      };
    }

    return {
      id: `${figureId}-vertical-${row}-${column}`,
      kind: 'vertical',
      x1: left,
      y1: top,
      x2: left,
      y2: bottom,
    };
  }

  private boundarySegmentPool(side: FigureSide, figureId: string): PuzzleSegment[] {
    const horizontal = this.segmentPool('horizontal', figureId);
    const vertical = this.segmentPool('vertical', figureId);

    if (side === 'top') {
      return horizontal.filter((segment) => segment.y1 === 14);
    }
    if (side === 'right') {
      return vertical.filter((segment) => segment.x1 === 116);
    }
    if (side === 'bottom') {
      return horizontal.filter((segment) => segment.y1 === 116);
    }
    return vertical.filter((segment) => segment.x1 === 14);
  }

  private enteringSegmentPool(side: FigureSide, figureId: string): PuzzleSegment[] {
    return [
      ...this.segmentPool('horizontal', figureId),
      ...this.segmentPool('vertical', figureId),
    ].filter((segment) => this.segmentEntersFromSide(segment, side));
  }

  private countEnteringLines(segments: PuzzleSegment[], side: FigureSide): number {
    let remaining = [...segments];
    let lineCount = 0;

    while (remaining.length) {
      const component = [remaining.pop() as PuzzleSegment];

      for (let index = 0; index < component.length; index += 1) {
        const current = component[index];
        const connected = remaining.filter((segment) => this.segmentsTouch(current, segment));
        component.push(...connected);
        remaining = remaining.filter((segment) => !connected.includes(segment));
      }

      if (component.some((segment) => this.segmentEntersFromSide(segment, side))) {
        lineCount += 1;
      }
    }

    return lineCount;
  }

  private segmentEntersFromSide(segment: PuzzleSegment, side: FigureSide): boolean {
    const endpointCount = this.countEndpointsOnSide(segment, side);
    return endpointCount > 0 && endpointCount < 2;
  }

  private segmentHasBoundaryEndpoint(segment: PuzzleSegment): boolean {
    return (['top', 'right', 'bottom', 'left'] as FigureSide[]).some(
      (side) => this.countEndpointsOnSide(segment, side) > 0,
    );
  }

  private countEndpointsOnSide(segment: PuzzleSegment, side: FigureSide): number {
    return (
      Number(this.pointIsOnSide(segment.x1, segment.y1, side)) +
      Number(this.pointIsOnSide(segment.x2, segment.y2, side))
    );
  }

  private pointIsOnSide(x: number, y: number, side: FigureSide): boolean {
    if (side === 'top') {
      return y === 14;
    }
    if (side === 'right') {
      return x === 116;
    }
    if (side === 'bottom') {
      return y === 116;
    }
    return x === 14;
  }

  private createContinuousFigure(
    random: SeededRandom,
    difficulty: number,
    figureId: string,
    counts: Record<SegmentKind, number>,
    ensureJoinedLines = false,
  ): PuzzleSegment[] {
    const maxLines = Math.min(4, 1 + difficulty);
    const maxSegmentsPerLine = Math.min(4, 2 + difficulty);

    return (['horizontal', 'vertical', 'slash', 'backslash'] as SegmentKind[]).flatMap((kind) => {
      const lineCount =
        ensureJoinedLines && kind === 'horizontal'
          ? Math.max(2, this.randomInt(random, 1, maxLines))
          : this.randomInt(random, 1, maxLines);
      const segments = this.createContinuousLines(
        random,
        kind,
        lineCount,
        maxSegmentsPerLine,
        figureId,
        ensureJoinedLines && kind === 'horizontal',
      );
      counts[kind] = this.countContinuousLines(segments, kind);
      return segments;
    });
  }

  private createContinuousLines(
    random: SeededRandom,
    kind: SegmentKind,
    lineCount: number,
    maxSegmentsPerLine: number,
    figureId: string,
    ensureJoinedLine = false,
  ): PuzzleSegment[] {
    let available = this.segmentPool(kind, figureId);
    const selected: PuzzleSegment[] = [];

    for (let lineIndex = 0; lineIndex < lineCount && available.length; lineIndex += 1) {
      const anchors = available.filter(
        (candidate) => !selected.some((segment) => this.segmentsTouch(candidate, segment)),
      );

      if (!anchors.length) {
        break;
      }

      const line = [this.pick(anchors, random)];
      available = available.filter((segment) => segment.id !== line[0].id);
      const targetLength =
        ensureJoinedLine && lineIndex === 0
          ? Math.max(2, this.randomInt(random, 1, maxSegmentsPerLine))
          : this.randomInt(random, 1, maxSegmentsPerLine);

      while (line.length < targetLength) {
        const candidates = available.filter(
          (candidate) =>
            line.some((segment) => this.segmentsTouch(candidate, segment)) &&
            !selected.some((segment) => this.segmentsTouch(candidate, segment)),
        );

        if (!candidates.length) {
          break;
        }

        const nextSegment = this.pick(candidates, random);
        line.push(nextSegment);
        available = available.filter((segment) => segment.id !== nextSegment.id);
      }

      selected.push(...line);
    }

    return this.shuffle(selected, random);
  }

  private countContinuousLines(segments: PuzzleSegment[], kind: SegmentKind): number {
    let remaining = segments.filter((segment) => segment.kind === kind);
    let lineCount = 0;

    while (remaining.length) {
      const component = [remaining.pop() as PuzzleSegment];

      for (let index = 0; index < component.length; index += 1) {
        const current = component[index];
        const connected = remaining.filter((segment) => this.segmentsTouch(current, segment));
        component.push(...connected);
        remaining = remaining.filter((segment) => !connected.includes(segment));
      }

      lineCount += 1;
    }

    return lineCount;
  }

  private segmentsTouch(first: PuzzleSegment, second: PuzzleSegment): boolean {
    return (
      this.pointsMatch(first.x1, first.y1, second.x1, second.y1) ||
      this.pointsMatch(first.x1, first.y1, second.x2, second.y2) ||
      this.pointsMatch(first.x2, first.y2, second.x1, second.y1) ||
      this.pointsMatch(first.x2, first.y2, second.x2, second.y2)
    );
  }

  private segmentsOverlap(first: PuzzleSegment, second: PuzzleSegment): boolean {
    if (first.kind !== second.kind) {
      return false;
    }

    if (first.kind === 'horizontal') {
      return (
        first.y1 === second.y1 &&
        Math.max(Math.min(first.x1, first.x2), Math.min(second.x1, second.x2)) <
          Math.min(Math.max(first.x1, first.x2), Math.max(second.x1, second.x2))
      );
    }

    if (first.kind === 'vertical') {
      return (
        first.x1 === second.x1 &&
        Math.max(Math.min(first.y1, first.y2), Math.min(second.y1, second.y2)) <
          Math.min(Math.max(first.y1, first.y2), Math.max(second.y1, second.y2))
      );
    }

    const firstDiagonal = first.kind === 'slash' ? first.x1 + first.y1 : first.x1 - first.y1;
    const secondDiagonal = second.kind === 'slash' ? second.x1 + second.y1 : second.x1 - second.y1;

    return (
      firstDiagonal === secondDiagonal &&
      Math.max(Math.min(first.x1, first.x2), Math.min(second.x1, second.x2)) <
        Math.min(Math.max(first.x1, first.x2), Math.max(second.x1, second.x2))
    );
  }

  private pointsMatch(firstX: number, firstY: number, secondX: number, secondY: number): boolean {
    return firstX === secondX && firstY === secondY;
  }

  private pickSegments(
    random: SeededRandom,
    kind: SegmentKind,
    count: number,
    figureId: string,
  ): PuzzleSegment[] {
    return this.shuffle(this.segmentPool(kind, figureId), random).slice(0, count);
  }

  private segmentPool(kind: SegmentKind, figureId: string): PuzzleSegment[] {
    const cellSize = 34;
    const offset = 14;
    const segments: PuzzleSegment[] = [];

    if (kind === 'horizontal') {
      for (let row = 0; row < 4; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          const x = offset + column * cellSize;
          const y = offset + row * cellSize;
          segments.push({
            id: `${figureId}-${kind}-${row}-${column}`,
            kind,
            x1: x,
            y1: y,
            x2: x + cellSize,
            y2: y,
          });
        }
      }

      return segments;
    }

    if (kind === 'vertical') {
      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 4; column += 1) {
          const x = offset + column * cellSize;
          const y = offset + row * cellSize;
          segments.push({
            id: `${figureId}-${kind}-${row}-${column}`,
            kind,
            x1: x,
            y1: y,
            x2: x,
            y2: y + cellSize,
          });
        }
      }

      return segments;
    }

    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const left = offset + column * cellSize;
        const top = offset + row * cellSize;
        const right = left + cellSize;
        const bottom = top + cellSize;
        const prefix = `${figureId}-${kind}-${row}-${column}`;

        if (kind === 'slash') {
          segments.push({ id: prefix, kind, x1: right, y1: top, x2: left, y2: bottom });
        }

        if (kind === 'backslash') {
          segments.push({ id: prefix, kind, x1: left, y1: top, x2: right, y2: bottom });
        }
      }
    }

    return segments;
  }

  private randomInt(random: SeededRandom, min: number, max: number): number {
    return min + Math.floor(random() * (max - min + 1));
  }

  private shuffle<T>(items: readonly T[], random: SeededRandom): T[] {
    return [...items].sort(() => random() - 0.5);
  }

  private markTypeUpdated(typeId: string): void {
    this.typeUpdatedAtOverrides.update((timestamps) => ({
      ...timestamps,
      [typeId]: Date.now(),
    }));
  }

  private formatDate(value: string | number): string {
    const date =
      typeof value === 'number'
        ? new Date(value)
        : new Date(value.length === 10 ? `${value}T12:00:00` : value);

    if (Number.isNaN(date.getTime())) {
      return 'Date inconnue';
    }

    return new Intl.DateTimeFormat('fr-CA', {
      dateStyle: 'medium',
    }).format(date);
  }

  private comparePuzzleTypes(first: PuzzleType, second: PuzzleType): number {
    const mode = this.puzzleSortMode();

    if (mode === 'name-asc' || mode === 'name-desc') {
      const comparison = this.typeName(first).localeCompare(this.typeName(second), 'fr-CA', {
        sensitivity: 'base',
      });
      return mode === 'name-desc' ? -comparison : comparison;
    }

    if (mode === 'status-asc' || mode === 'status-desc') {
      const statusOrder: Record<ApprovalState, number> = {
        approved: 0,
        pending: 1,
        deleted: 2,
      };
      const comparison = statusOrder[this.typeState(first)] - statusOrder[this.typeState(second)];
      const statusComparison = mode === 'status-desc' ? -comparison : comparison;

      return (
        statusComparison ||
        this.typeName(first).localeCompare(this.typeName(second), 'fr-CA', {
          sensitivity: 'base',
        })
      );
    }

    const firstDate = this.puzzleDateTimestamp(first, mode.startsWith('created'));
    const secondDate = this.puzzleDateTimestamp(second, mode.startsWith('created'));
    const comparison = secondDate - firstDate;
    const dateComparison = mode.endsWith('asc') ? -comparison : comparison;

    return (
      dateComparison ||
      this.typeName(first).localeCompare(this.typeName(second), 'fr-CA', {
        sensitivity: 'base',
      })
    );
  }

  private puzzleDateTimestamp(type: PuzzleType, created: boolean): number {
    const override = created
      ? this.typeCreatedAtOverrides()[type.id]
      : this.typeUpdatedAtOverrides()[type.id];
    const fallback = created ? type.createdAt : type.updatedAt;

    if (override !== undefined) {
      return override;
    }

    const timestamp = Date.parse(fallback.length === 10 ? `${fallback}T12:00:00` : fallback);
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  private readPuzzleSortMode(): PuzzleSortMode {
    try {
      const storedMode = this.storage.get(this.puzzleSortModeStorageKey);
      return this.isPuzzleSortMode(storedMode) ? storedMode : 'name-asc';
    } catch {
      return 'name-asc';
    }
  }

  private isPuzzleSortMode(value: string | null): value is PuzzleSortMode {
    return (
      value === 'name-asc' ||
      value === 'name-desc' ||
      value === 'created-desc' ||
      value === 'created-asc' ||
      value === 'updated-desc' ||
      value === 'updated-asc' ||
      value === 'status-asc' ||
      value === 'status-desc'
    );
  }

  private readStoredTypeId(): string {
    const fallback = LAB_PUZZLE_TYPES[0].id;

    try {
      const storedTypeId = this.storage.get(this.selectedTypeStorageKey);

      return LAB_PUZZLE_TYPES.some((type) => type.id === storedTypeId)
        ? (storedTypeId as string)
        : fallback;
    } catch {
      return fallback;
    }
  }

  private readTypeViewMode(): TypeViewMode {
    try {
      return this.storage.get(this.typeViewModeStorageKey) === 'lines'
        ? 'lines'
        : 'cards';
    } catch {
      return 'cards';
    }
  }

  private readTypeNameFilter(): string {
    try {
      return this.storage.get(this.typeNameFilterStorageKey) ?? '';
    } catch {
      return '';
    }
  }

  private readTypeStatusFilter(): ApprovalState | 'all' {
    try {
      const storedStatus = this.storage.get(this.typeStatusFilterStorageKey);
      if (storedStatus === 'all') {
        return 'all';
      }

      return storedStatus && this.isApprovalState(storedStatus) ? storedStatus : 'all';
    } catch {
      return 'all';
    }
  }

  private readInitialTypeId(): string {
    const routeTypeId = this.route.snapshot.paramMap.get('typeId');

    return LAB_PUZZLE_TYPES.some((type) => type.id === routeTypeId)
      ? (routeTypeId as string)
      : this.readStoredTypeId();
  }

  private readStoredVariantId(typeId: string): string {
    const type =
      LAB_PUZZLE_TYPES.find((candidate) => candidate.id === typeId) ?? LAB_PUZZLE_TYPES[0];
    const fallback = type.variants[0].id;

    try {
      const storedVariantId = this.storage.get(this.selectedVariantStorageKey);

      return type.variants.some((variant) => variant.id === storedVariantId)
        ? (storedVariantId as string)
        : fallback;
    } catch {
      return fallback;
    }
  }

  private saveSelection(typeId: string, variantId: string): void {
    try {
      this.storage.set(this.selectedTypeStorageKey, typeId);
      this.storage.set(this.selectedVariantStorageKey, variantId);
    } catch {
      // The selection still applies for the current page when storage is unavailable.
    }
  }

  private resetExampleAttempts(): void {
    this.challengeSolutionShown.set(false);
    this.challengeAnswerState.set('');
    this.challengePartialMessageState.set('');
    this.challengeFeedbackState.set(undefined);
    this.wordSplitHintCount.set(0);
    this.segmentPhraseHintCount.set(0);
    this.colorChainHintCount.set(0);
    this.hiddenColorLettersState.set({});
  }

  private createSeed(): string {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  private seededRandom(seed: string): SeededRandom {
    let hash = 2166136261;

    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return () => {
      hash += 0x6d2b79f5;
      let value = hash;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }
}
