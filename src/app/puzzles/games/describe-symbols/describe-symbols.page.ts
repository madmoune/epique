import { NgTemplateOutlet } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import {
  FirebaseRoomService,
  MultiplayerRoom,
} from '../../../shared/multiplayer/firebase-room.service';
import { PuzzleSuccessPopupComponent } from '../../shared/puzzle-success-popup/puzzle-success-popup.component';

type GamePhase = 'lobby' | 'describing' | 'reveal';
type SymbolLayout =
  | 'horizontal'
  | 'vertical'
  | 'diagonal'
  | 'cross'
  | 'chevron'
  | 'canton'
  | 'quartered'
  | 'saltire'
  | 'bordered'
  | 'radial'
  | 'orbit'
  | 'scatter'
  | 'grid';
type SymbolEmblem =
  | 'anchor'
  | 'star'
  | 'diamond'
  | 'ring'
  | 'triangle'
  | 'moon'
  | 'bolt'
  | 'square'
  | 'sun';
type EmblemPosition = 'center' | 'left' | 'right' | 'top' | 'bottom';
type EmblemScale = 'small' | 'medium' | 'large';
type SymmetryMode = 'balanced' | 'offset' | 'chaotic';
type DetailRegion = 'left' | 'right' | 'top' | 'bottom' | 'center';
type DetailShape = 'dot' | 'ring' | 'dash' | 'spark';

type Player = {
  id: string;
  name: string;
  online: boolean;
};

type SubmissionFeedback = {
  title: string;
  message: string;
  tone: 'success' | 'partial';
};

type DescribedSymbol = {
  id: string;
  layout: SymbolLayout;
  colors: [string, string, string];
  emblem: SymbolEmblem;
  emblemColor: string;
  emblemPosition: EmblemPosition;
  emblemScale: EmblemScale;
  border: 'plain' | 'dark' | 'double';
  band: 'none' | 'top' | 'middle' | 'bottom';
  symmetry: SymmetryMode;
  detailRegion: DetailRegion;
  detailShape: DetailShape;
  detailCount: number;
  detailSeed: number;
};

type DescribeSymbolsState = {
  phase: GamePhase;
  describerId: string | null;
  target: DescribedSymbol | null;
  choices: DescribedSymbol[];
  selectedSymbolId: string | null;
  lastSubmission: SubmissionFeedback | null;
  guesses: Record<string, string>;
};

const GAME_ID = 'describe-symbols';
const PALETTE = [
  '#f7f1df',
  '#ef4444',
  '#2563eb',
  '#facc15',
  '#16a34a',
  '#111827',
  '#f97316',
  '#7c3aed',
  '#0891b2',
  '#ec4899',
];
const LAYOUTS: SymbolLayout[] = [
  'horizontal',
  'vertical',
  'diagonal',
  'cross',
  'chevron',
  'canton',
  'quartered',
  'saltire',
  'bordered',
  'radial',
  'orbit',
  'scatter',
  'grid',
];
const EMBLEMS: SymbolEmblem[] = [
  'anchor',
  'star',
  'diamond',
  'ring',
  'triangle',
  'moon',
  'bolt',
  'square',
  'sun',
];
const BORDERS: DescribedSymbol['border'][] = ['plain', 'dark', 'double'];
const EMBLEM_POSITIONS: EmblemPosition[] = ['center', 'left', 'right', 'top', 'bottom'];
const EMBLEM_SCALES: EmblemScale[] = ['small', 'medium', 'large'];
const BANDS: DescribedSymbol['band'][] = ['none', 'top', 'middle', 'bottom'];
const SYMMETRIES: SymmetryMode[] = ['balanced', 'offset', 'chaotic'];
const DETAIL_REGIONS: DetailRegion[] = ['left', 'right', 'top', 'bottom', 'center'];
const DETAIL_SHAPES: DetailShape[] = ['dot', 'ring', 'dash', 'spark'];
const SYMBOL_DIFFERENCES = [
  'layout',
  'emblem',
  'emblemPosition',
  'emblemScale',
  'border',
  'band',
  'colors',
  'emblemColor',
  'symmetry',
  'detailRegion',
  'detailCount',
  'detailShape',
] as const;
type SymbolDifference = (typeof SYMBOL_DIFFERENCES)[number];
const SECONDARY_DIFFERENCES: SymbolDifference[] = [
  'emblemPosition',
  'emblemScale',
  'border',
  'band',
  'colors',
  'emblemColor',
  'symmetry',
  'detailRegion',
  'detailCount',
  'detailShape',
];

@Component({
  selector: 'app-describe-symbols-page',
  imports: [RouterLink, NgTemplateOutlet, PuzzleSuccessPopupComponent],
  templateUrl: './describe-symbols.page.html',
  styleUrl: './describe-symbols.page.scss',
})
export class DescribeSymbolsPage implements OnDestroy {
  private readonly firebaseRoom = inject(FirebaseRoomService);
  private roomSubscription?: Subscription;

  protected readonly playerName = signal('Player');
  protected readonly joinCode = signal('');
  protected readonly roomCode = signal<string | null>(null);
  protected readonly playerId = signal<string | null>(null);
  protected readonly room = signal<MultiplayerRoom<DescribeSymbolsState> | null>(null);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly copyStatus = signal<string | null>(null);

  protected readonly firebaseReady = computed(() => this.firebaseRoom.isConfigured);
  protected readonly state = computed(() => this.normalizeState(this.room()?.state));
  protected readonly phase = computed(() => this.state().phase);
  protected readonly target = computed(() => this.state().target);
  protected readonly choices = computed(() => this.state().choices);
  protected readonly selectedSymbolId = computed(() => this.state().selectedSymbolId);
  protected readonly submissionFeedback = computed(() => this.state().lastSubmission);
  protected readonly guesses = computed(() => this.state().guesses);
  protected readonly players = computed<Player[]>(() => {
    const room = this.room();
    if (!room) return [];

    return Object.values(room.players ?? {})
      .filter((player) => player.online)
      .map((player) => ({
        id: player.id,
        name: player.name,
        online: player.online,
      }));
  });
  protected readonly localPlayer = computed(() =>
    this.players().find((player) => player.id === this.playerId()),
  );
  protected readonly describer = computed(() =>
    this.players().find((player) => player.id === this.state().describerId),
  );
  protected readonly hostPlayer = computed(() =>
    this.players().find((player) => player.id === this.room()?.hostId),
  );
  protected readonly isHost = computed(() => this.playerId() === this.room()?.hostId);
  protected readonly isDescriber = computed(() => this.playerId() === this.state().describerId);
  protected readonly guessers = computed(() =>
    this.players().filter((player) => player.id !== this.state().describerId),
  );
  protected readonly submittedGuessCount = computed(() => Object.keys(this.guesses()).length);
  protected readonly allGuessersHaveGuessed = computed(
    () => this.guessers().length > 0 && this.submittedGuessCount() >= this.guessers().length,
  );
  protected readonly statusText = computed(() => {
    if (!this.room()) return 'Cree une salle ou rejoins un code.';
    if (this.phase() === 'lobby') return 'Invite les joueurs, puis lance la partie.';
    if (this.phase() === 'reveal') return 'Reponse envoyee.';
    if (this.isDescriber()) return 'Decris le pavillon sans montrer ton ecran.';
    return this.hasGuessed()
      ? 'Choix verrouille. Attends la revelation.'
      : 'Ecoute la description, puis choisis le bon pavillon.';
  });

  ngOnDestroy(): void {
    this.roomSubscription?.unsubscribe();
  }

  protected async createRoom(): Promise<void> {
    await this.runFirebaseAction(async () => {
      const initialState = this.emptyState();
      const { roomCode, playerId } = await this.firebaseRoom.createRoom(
        GAME_ID,
        initialState,
        this.playerName(),
      );

      this.playerId.set(playerId);
      this.roomCode.set(roomCode);
      this.watchRoom(roomCode);
    });
  }

  protected async joinRoom(): Promise<void> {
    const code = this.joinCode().trim().toUpperCase();
    if (!code) {
      this.errorMessage.set('Entre un code de salle.');
      return;
    }

    await this.runFirebaseAction(async () => {
      const { playerId } = await this.firebaseRoom.joinRoom(code, this.playerName());
      this.playerId.set(playerId);
      this.roomCode.set(code);
      this.watchRoom(code);
    });
  }

  protected async startRound(): Promise<void> {
    if (!this.isHost()) return;

    const players = this.players();
    if (players.length < 2) {
      this.errorMessage.set('Il faut au moins deux joueurs.');
      return;
    }

    const previousDescriberId = this.state().describerId;
    const previousIndex = players.findIndex((player) => player.id === previousDescriberId);
    const describer = players[(previousIndex + 1 + players.length) % players.length] ?? players[0];
    const target = this.createSymbol();

    await this.saveState({
      ...this.state(),
      phase: 'describing',
      describerId: describer.id,
      target,
      choices: this.shuffle(this.createChoiceSet(target)),
      selectedSymbolId: null,
      lastSubmission: null,
      guesses: {},
    });
  }

  protected async chooseSymbol(symbolId: string): Promise<void> {
    const playerId = this.playerId();
    if (!playerId || this.phase() !== 'describing' || this.isDescriber() || this.hasGuessed())
      return;

    await this.saveState({
      ...this.state(),
      selectedSymbolId: this.selectedSymbolId() === symbolId ? null : symbolId,
    });
  }

  protected async submitGuess(): Promise<void> {
    const playerId = this.playerId();
    const symbolId = this.selectedSymbolId();
    if (
      !playerId ||
      !symbolId ||
      this.phase() !== 'describing' ||
      this.isDescriber() ||
      this.hasGuessed()
    )
      return;

    const targetId = this.target()?.id;
    const isCorrect = symbolId === targetId;

    await this.saveState({
      ...this.state(),
      phase: 'reveal',
      guesses: {
        ...this.guesses(),
        [playerId]: symbolId,
      },
      selectedSymbolId: null,
      lastSubmission: isCorrect
        ? {
            title: 'Bonne reponse',
            message: 'Le bon pavillon a ete trouve.',
            tone: 'success',
          }
        : {
            title: 'Mauvais pavillon',
            message: 'Ce symbole ne correspond pas au pavillon decrit.',
            tone: 'partial',
          },
    });
  }

  protected async clearSubmissionFeedback(): Promise<void> {
    if (!this.isHost()) return;

    await this.saveState({
      ...this.state(),
      lastSubmission: null,
    });
  }

  protected async nextRound(): Promise<void> {
    if (!this.isHost()) return;

    await this.startRound();
  }

  protected async resetRoom(): Promise<void> {
    if (!this.isHost()) return;
    await this.saveState(this.emptyState());
  }

  protected async leaveRoom(): Promise<void> {
    const code = this.roomCode();
    if (code) await this.firebaseRoom.leaveRoom(code);

    this.roomSubscription?.unsubscribe();
    this.roomSubscription = undefined;
    this.roomCode.set(null);
    this.playerId.set(null);
    this.room.set(null);
  }

  protected async copyRoomCode(): Promise<void> {
    const code = this.roomCode();
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      this.copyStatus.set('Copie');
    } catch {
      this.copyStatus.set('Selectionne le code');
    }

    window.setTimeout(() => this.copyStatus.set(null), 1600);
  }

  protected setPlayerName(event: Event): void {
    this.playerName.set((event.target as HTMLInputElement).value.trim() || 'Player');
  }

  protected setJoinCode(event: Event): void {
    this.joinCode.set((event.target as HTMLInputElement).value.trim().toUpperCase());
  }

  protected hasGuessed(): boolean {
    const playerId = this.playerId();
    return Boolean(playerId && this.guesses()[playerId]);
  }

  protected symbolState(symbolId: string): 'correct' | 'picked' | 'wrong' | null {
    const playerId = this.playerId();
    if (this.phase() === 'reveal' && symbolId === this.target()?.id) return 'correct';
    if (this.selectedSymbolId() === symbolId) return 'picked';
    if (playerId && this.guesses()[playerId] === symbolId) {
      return this.phase() === 'reveal' ? 'wrong' : 'picked';
    }
    return null;
  }

  protected playersForSymbol(symbolId: string): Player[] {
    const playerIds = Object.entries(this.guesses())
      .filter(([, guessSymbolId]) => guessSymbolId === symbolId)
      .map(([playerId]) => playerId);

    return this.players().filter((player) => playerIds.includes(player.id));
  }

  protected guessFor(playerId: string): DescribedSymbol | undefined {
    return this.choices().find((symbol) => symbol.id === this.guesses()[playerId]);
  }

  protected stripeColor(symbol: DescribedSymbol, index: number): string {
    return symbol.colors[index];
  }

  protected borderClass(symbol: DescribedSymbol): string {
    return `border-${symbol.border}`;
  }

  protected emblemTransform(symbol: DescribedSymbol): string {
    const [x, y] = {
      center: [90, 60],
      left: [62, 60],
      right: [118, 60],
      top: [90, 43],
      bottom: [90, 77],
    }[symbol.emblemPosition];
    const scale = { small: 0.72, medium: 0.9, large: 1.12 }[symbol.emblemScale];

    return `translate(${x} ${y}) scale(${scale}) translate(-90 -60)`;
  }

  protected detailElements(symbol: DescribedSymbol): Array<{
    key: string;
    x: number;
    y: number;
    rotation: number;
  }> {
    const bounds = {
      left: { minX: 24, maxX: 70, minY: 22, maxY: 98 },
      right: { minX: 110, maxX: 156, minY: 22, maxY: 98 },
      top: { minX: 35, maxX: 145, minY: 20, maxY: 48 },
      bottom: { minX: 35, maxX: 145, minY: 72, maxY: 100 },
      center: { minX: 58, maxX: 122, minY: 32, maxY: 88 },
    }[symbol.detailRegion];
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    return Array.from({ length: symbol.detailCount }, (_, index) => {
      const mirrorIndex = Math.floor(index / 2);
      const mirrored = symbol.symmetry === 'balanced' && index % 2 === 1;
      const randomX = this.seededUnit(symbol.detailSeed + mirrorIndex * 17);
      const randomY = this.seededUnit(symbol.detailSeed + mirrorIndex * 29 + 7);
      const spreadX = (bounds.maxX - bounds.minX) * 0.42;
      const spreadY = (bounds.maxY - bounds.minY) * 0.42;
      let x = bounds.minX + randomX * (bounds.maxX - bounds.minX);
      let y = bounds.minY + randomY * (bounds.maxY - bounds.minY);

      if (symbol.symmetry === 'balanced') {
        const baseX = centerX - spreadX + randomX * spreadX;
        const baseY = centerY - spreadY + randomY * spreadY * 2;
        x = mirrored ? centerX + (centerX - baseX) : baseX;
        y = baseY;

        if (symbol.detailCount % 2 === 1 && index === symbol.detailCount - 1) {
          x = centerX;
          y = centerY;
        }
      }

      if (symbol.symmetry === 'offset') {
        x = bounds.minX + randomX * (bounds.maxX - bounds.minX) * 0.7;
        y = bounds.minY + randomY * (bounds.maxY - bounds.minY);
      }

      return {
        key: `${symbol.id}-${index}`,
        x: Math.round(x),
        y: Math.round(y),
        rotation: Math.round(this.seededUnit(symbol.detailSeed + index * 41) * 180 - 90),
      };
    });
  }

  private watchRoom(roomCode: string): void {
    this.roomSubscription?.unsubscribe();
    this.roomSubscription = this.firebaseRoom
      .watchRoom<DescribeSymbolsState>(roomCode)
      .subscribe((room) => {
        if (!room) {
          this.roomCode.set(null);
          this.playerId.set(null);
          this.room.set(null);
          return;
        }

        this.room.set(room);
      });
  }

  private async saveState(state: DescribeSymbolsState): Promise<void> {
    const code = this.roomCode();
    if (!code) return;

    await this.runFirebaseAction(() => this.firebaseRoom.setRoomState(code, state));
  }

  private async runFirebaseAction(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.errorMessage.set(null);

    try {
      await action();
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Action Firebase impossible.');
    } finally {
      this.busy.set(false);
    }
  }

  private emptyState(): DescribeSymbolsState {
    return {
      phase: 'lobby',
      describerId: null,
      target: null,
      choices: [],
      selectedSymbolId: null,
      lastSubmission: null,
      guesses: {},
    };
  }

  private normalizeState(state: Partial<DescribeSymbolsState> | undefined): DescribeSymbolsState {
    const fallback = this.emptyState();

    return {
      phase: state?.phase ?? fallback.phase,
      describerId: state?.describerId ?? fallback.describerId,
      target: state?.target ? this.withSymbolDefaults(state.target) : fallback.target,
      choices: state?.choices?.map((symbol) => this.withSymbolDefaults(symbol)) ?? fallback.choices,
      selectedSymbolId: state?.selectedSymbolId ?? fallback.selectedSymbolId,
      lastSubmission: state?.lastSubmission ?? fallback.lastSubmission,
      guesses: state?.guesses ?? fallback.guesses,
    };
  }

  private createChoiceSet(target: DescribedSymbol): DescribedSymbol[] {
    const variants: DescribedSymbol[] = [target];
    const shuffledDifferences = this.shuffle(SYMBOL_DIFFERENCES);
    const primaryDifferences = [
      'layout',
      'emblem',
      ...shuffledDifferences.filter(
        (difference) => difference !== 'layout' && difference !== 'emblem',
      ),
    ].slice(0, 9) as SymbolDifference[];

    while (variants.length < 10) {
      const variantIndex = variants.length - 1;
      const primaryDifference = primaryDifferences[variantIndex];
      const secondaryDifference =
        variantIndex % 3 === 2
          ? this.pick(
              SECONDARY_DIFFERENCES.filter((difference) => difference !== primaryDifference),
            )
          : undefined;
      const variant = this.createSimilarSymbol(
        target,
        variants.length,
        primaryDifference,
        secondaryDifference,
      );
      if (!variants.some((symbol) => symbol.id === variant.id)) variants.push(variant);
    }

    return variants;
  }

  private withSymbolDefaults(symbol: DescribedSymbol): DescribedSymbol {
    return {
      ...symbol,
      symmetry: symbol.symmetry ?? 'balanced',
      detailRegion: symbol.detailRegion ?? 'center',
      detailShape: symbol.detailShape ?? 'dot',
      detailCount: symbol.detailCount ?? 4,
      detailSeed: symbol.detailSeed ?? 1,
    };
  }

  private createSimilarSymbol(
    target: DescribedSymbol,
    seed: number,
    primaryDifference: SymbolDifference,
    secondaryDifference?: SymbolDifference,
  ): DescribedSymbol {
    const variant = structuredClone(target);
    variant.id = crypto.randomUUID();

    this.applySymbolDifference(variant, target, primaryDifference, seed);
    if (secondaryDifference) {
      this.applySymbolDifference(variant, target, secondaryDifference, seed + 23);
    }

    return variant;
  }

  private applySymbolDifference(
    variant: DescribedSymbol,
    target: DescribedSymbol,
    difference: SymbolDifference,
    seed: number,
  ): void {
    switch (difference) {
      case 'layout':
        variant.layout = this.nearbyValue(LAYOUTS, target.layout);
        break;
      case 'emblem':
        variant.emblem = this.nearbyValue(EMBLEMS, target.emblem);
        break;
      case 'emblemPosition':
        variant.emblemPosition = this.nearbyValue(EMBLEM_POSITIONS, target.emblemPosition);
        break;
      case 'emblemScale':
        variant.emblemScale = this.nearbyValue(EMBLEM_SCALES, target.emblemScale);
        break;
      case 'border':
        variant.border = this.nearbyValue(BORDERS, target.border);
        break;
      case 'band':
        variant.band = this.nearbyValue(BANDS, target.band);
        break;
      case 'colors': {
        const indexToChange = seed % variant.colors.length;
        variant.colors[indexToChange] = this.pick(
          PALETTE.filter(
            (color) => !target.colors.includes(color) && color !== target.emblemColor,
          ),
        );
        break;
      }
      case 'emblemColor':
        variant.emblemColor = this.pick(
          PALETTE.filter(
            (color) => !variant.colors.includes(color) && color !== target.emblemColor,
          ),
        );
        break;
      case 'symmetry':
        variant.symmetry = this.nearbyValue(SYMMETRIES, target.symmetry);
        break;
      case 'detailRegion':
        variant.detailRegion = this.nearbyValue(DETAIL_REGIONS, target.detailRegion);
        break;
      case 'detailCount': {
        const direction = seed % 2 === 0 ? 1 : -1;
        variant.detailCount =
          target.detailCount === 2
            ? 3
            : target.detailCount === 8
              ? 7
              : target.detailCount + direction;
        break;
      }
      case 'detailShape':
        variant.detailShape = this.nearbyValue(DETAIL_SHAPES, target.detailShape);
        break;
    }
  }

  private createSymbol(): DescribedSymbol {
    const colors = this.shuffle(PALETTE).slice(0, 3) as [string, string, string];
    return {
      id: crypto.randomUUID(),
      layout: this.pick(LAYOUTS),
      colors,
      emblem: this.pick(EMBLEMS),
      emblemColor: this.pick(PALETTE.filter((color) => !colors.includes(color))),
      emblemPosition: this.pick(EMBLEM_POSITIONS),
      emblemScale: this.pick(EMBLEM_SCALES),
      border: this.pick(BORDERS),
      band: this.pick(BANDS),
      symmetry: this.pick(SYMMETRIES),
      detailRegion: this.pick(DETAIL_REGIONS),
      detailShape: this.pick(DETAIL_SHAPES),
      detailCount: this.randomInt(2, 8),
      detailSeed: this.randomInt(1, 9999),
    };
  }

  private nearbyValue<T>(values: T[], current: T): T {
    const index = values.indexOf(current);
    return values[(index + 1 + Math.floor(Math.random() * (values.length - 1))) % values.length];
  }

  private pick<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }

  private shuffle<T>(items: readonly T[]): T[] {
    return [...items].sort(() => Math.random() - 0.5);
  }

  private randomInt(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  private seededUnit(seed: number): number {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  }
}
