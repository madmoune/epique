import { Component, HostListener, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PuzzleSuccessPopupComponent } from '../shared/puzzle-success-popup/puzzle-success-popup.component';
import {
  COLORED_ROD_COUNT,
  COLORED_ROD_LEVELS,
  ColoredRod,
  ColoredRodColor,
  ColoredRodLevel,
  createColoredRodsPuzzle,
  findColoredRodConflict,
  isColoredRodSequenceValid,
} from './color-rods.model';

type FeedbackTone = 'info' | 'error' | 'success';

type Feedback = {
  tone: FeedbackTone;
  text: string;
};

type DragSource = {
  rodId: string;
  slotIndex: number | null;
};

@Component({
  selector: 'app-color-rods-page',
  imports: [RouterLink, PuzzleSuccessPopupComponent],
  templateUrl: './color-rods.page.html',
  styleUrl: './color-rods.page.scss',
})
export class ColorRodsPage {
  protected readonly levels = COLORED_ROD_LEVELS;
  protected readonly slots = Array.from({ length: COLORED_ROD_COUNT }, (_, index) => index);
  protected readonly puzzle = signal(createColoredRodsPuzzle());
  protected readonly placements = signal<(string | null)[]>(this.createEmptyPlacements());
  protected readonly selectedSlotIndex = signal<number | null>(null);
  protected readonly selectedTrayRodId = signal<string | null>(null);
  protected readonly pointerPosition = signal({ x: 0, y: 0 });
  private readonly draggedSource = signal<DragSource | null>(null);
  private readonly dragMimeType = 'application/x-color-rods';
  protected readonly feedback = signal<Feedback>({
    tone: 'info',
    text: 'Clique une tige, puis clique une position pour la placer.',
  });

  protected readonly placedRods = computed<(ColoredRod | null)[]>(() => {
    const rodsById = new Map(this.puzzle().rods.map((rod) => [rod.id, rod]));

    return this.placements().map((rodId) => (rodId ? (rodsById.get(rodId) ?? null) : null));
  });

  protected readonly availableRods = computed(() => {
    const usedIds = new Set(this.placements().filter((rodId): rodId is string => rodId !== null));

    return this.puzzle().rods.filter((rod) => !usedIds.has(rod.id));
  });

  protected readonly selectedRod = computed<ColoredRod | null>(() => {
    const selectedTrayRodId = this.selectedTrayRodId();

    if (selectedTrayRodId !== null) {
      return this.rodFromId(selectedTrayRodId);
    }

    const selectedSlotIndex = this.selectedSlotIndex();
    return selectedSlotIndex === null ? null : this.placedRods()[selectedSlotIndex];
  });

  protected readonly hasSelection = computed(() => this.selectedRod() !== null);

  protected readonly filledCount = computed(
    () => this.placements().filter((rodId) => rodId !== null).length,
  );

  protected readonly isComplete = computed(() => this.filledCount() === this.slots.length);

  protected readonly conflictingSlotIndexes = computed<Set<number>>(() => {
    const conflictingSlots = new Set<number>();
    const chain = [this.puzzle().start, ...this.placedRods(), this.puzzle().finish];

    for (let index = 0; index < chain.length - 1; index += 1) {
      const first = chain[index];
      const second = chain[index + 1];

      if (!first || !second || findColoredRodConflict(first, second) === null) {
        continue;
      }

      if (index > 0) {
        conflictingSlots.add(index - 1);
      }

      if (index < this.slots.length) {
        conflictingSlots.add(index);
      }
    }

    return conflictingSlots;
  });

  protected readonly conflictingConnectionIndexes = computed<Set<number>>(() => {
    const conflictingConnections = new Set<number>();
    const chain = [this.puzzle().start, ...this.placedRods(), this.puzzle().finish];

    for (let index = 0; index < chain.length - 1; index += 1) {
      const first = chain[index];
      const second = chain[index + 1];

      if (first && second && findColoredRodConflict(first, second) !== null) {
        conflictingConnections.add(index);
      }
    }

    return conflictingConnections;
  });

  protected readonly isSolved = computed(() => {
    const placedRods = this.placedRods();

    if (placedRods.some((rod) => rod === null)) {
      return false;
    }

    return isColoredRodSequenceValid([
      this.puzzle().start,
      ...placedRods.filter((rod): rod is ColoredRod => rod !== null),
      this.puzzle().finish,
    ]);
  });

  protected selectRod(rodId: string, event?: MouseEvent): void {
    if (this.isSolved() || !this.availableRods().some((rod) => rod.id === rodId)) {
      return;
    }

    if (this.selectedSlotIndex() !== null) {
      this.returnSelectedPieceToReserve();
    } else {
      this.clearSelection();
    }

    this.selectedTrayRodId.set(rodId);
    this.updatePointerPosition(event);
    this.feedback.set({
      tone: 'info',
      text: 'Tige sélectionnée. Clique sur une position pour la placer, ou en dehors pour annuler.',
    });
  }

  protected handleSlotClick(index: number, event?: MouseEvent): void {
    if (this.isSolved()) {
      return;
    }

    this.updatePointerPosition(event);

    const selectedTrayRodId = this.selectedTrayRodId();

    if (selectedTrayRodId !== null) {
      this.placeRodAt(index, selectedTrayRodId);
      return;
    }

    const selectedIndex = this.selectedSlotIndex();

    if (selectedIndex === null) {
      if (this.placements()[index]) {
        this.selectedSlotIndex.set(index);
        this.feedback.set({
          tone: 'info',
          text: 'Tige sélectionnée. Clique sur une autre position pour la déplacer ou l’interchanger.',
        });
      } else {
        this.feedback.set({
          tone: 'error',
          text: 'Clique sur une tige de la réserve pour la prendre.',
        });
      }
      return;
    }

    if (selectedIndex === index) {
      this.returnSelectedPieceToReserve();
      return;
    }

    this.moveOrSwapPlacedRods(selectedIndex, index);
  }

  private placeRodAt(index: number, rodId: string): void {
    if (index < 0 || index >= this.slots.length || !this.rodFromId(rodId)) {
      return;
    }

    if (
      this.placements().some(
        (placedRodId, slotIndex) => placedRodId === rodId && slotIndex !== index,
      )
    ) {
      return;
    }

    const nextPlacements = [...this.placements()];
    nextPlacements[index] = rodId;
    this.placements.set(nextPlacements);
    this.clearSelection();

    if (this.isSolved()) {
      this.feedback.set({
        tone: 'success',
        text: 'Toutes les couleurs s’enchaînent correctement. Bravo !',
      });
    } else if (this.isComplete()) {
      this.feedback.set({
        tone: 'error',
        text: 'La chaîne est complète, mais certains raccords répètent une couleur.',
      });
    } else {
      this.feedback.set({
        tone: 'info',
        text: 'Tige placée dans la position choisie.',
      });
    }
  }

  private moveOrSwapPlacedRods(sourceIndex: number, targetIndex: number): void {
    if (
      sourceIndex < 0 ||
      sourceIndex >= this.slots.length ||
      targetIndex < 0 ||
      targetIndex >= this.slots.length ||
      !this.placements()[sourceIndex]
    ) {
      return;
    }

    const nextPlacements = [...this.placements()];
    const targetWasEmpty = nextPlacements[targetIndex] === null;
    [nextPlacements[sourceIndex], nextPlacements[targetIndex]] = [
      nextPlacements[targetIndex],
      nextPlacements[sourceIndex],
    ];
    this.placements.set(nextPlacements);
    this.clearSelection();
    this.feedback.set({
      tone: 'info',
      text: targetWasEmpty ? 'Tige déplacée.' : 'Tiges interchangées.',
    });
  }

  private removePlacedRod(index: number): void {
    if (this.isSolved()) {
      return;
    }

    const rodId = this.placements()[index];

    if (!rodId) {
      return;
    }

    const nextPlacements = [...this.placements()];
    nextPlacements[index] = null;
    this.placements.set(nextPlacements);
    this.clearSelection();
    this.feedback.set({
      tone: 'info',
      text: 'Tige retirée.',
    });
  }

  protected startDraggingFromTray(rodId: string, event: DragEvent): void {
    if (this.isSolved() || !this.availableRods().some((rod) => rod.id === rodId)) {
      return;
    }

    if (this.selectedSlotIndex() !== null) {
      this.returnSelectedPieceToReserve();
    } else {
      this.clearSelection();
    }

    this.setDragPayload({ rodId, slotIndex: null }, event);
  }

  protected startDraggingFromSlot(index: number, event: DragEvent): void {
    const rodId = this.placements()[index];

    if (this.isSolved() || !rodId) {
      return;
    }

    if (this.selectedSlotIndex() !== null && this.selectedSlotIndex() !== index) {
      this.returnSelectedPieceToReserve();
    } else if (this.selectedSlotIndex() === null) {
      this.clearSelection();
    }

    this.setDragPayload({ rodId, slotIndex: index }, event);
  }

  protected allowDrop(event: DragEvent): void {
    if (!this.isSolved()) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
    }
  }

  protected dropOnSlot(index: number, event: DragEvent): void {
    event.preventDefault();

    if (this.isSolved()) {
      return;
    }

    const source = this.readDragSource(event);

    if (!source) {
      return;
    }

    if (source.slotIndex === null) {
      this.placeRodAt(index, source.rodId);
    } else if (source.slotIndex !== index) {
      this.moveOrSwapPlacedRods(source.slotIndex, index);
    } else {
      this.clearSelection();
    }

    this.draggedSource.set(null);
  }

  protected dropOnTray(event: DragEvent): void {
    event.preventDefault();

    if (this.isSolved()) {
      return;
    }

    const source = this.readDragSource(event);

    if (!source || source.slotIndex === null) {
      return;
    }

    this.removePlacedRod(source.slotIndex);
    this.draggedSource.set(null);
  }

  protected endDragging(): void {
    this.draggedSource.set(null);
  }

  @HostListener('document:pointermove', ['$event'])
  protected trackPointer(event: PointerEvent): void {
    if (this.hasSelection()) {
      this.updatePointerPosition(event);
    }
  }

  @HostListener('document:click', ['$event'])
  protected handleDocumentClick(event: MouseEvent): void {
    if (!this.hasSelection() || this.isSolved()) {
      return;
    }

    const target = event.target;

    if (target instanceof HTMLElement && target.closest('.rod-slot, .tray-rod')) {
      return;
    }

    this.returnSelectedPieceToReserve();
  }

  protected placeHint(): void {
    if (this.isSolved()) {
      return;
    }

    const solutionIds = this.puzzle().solutionIds;
    const targetIndex = this.slots.find((index) => this.placements()[index] !== solutionIds[index]);

    if (targetIndex === undefined) {
      return;
    }

    const nextPlacements = this.placements().map((rodId, index) =>
      index > targetIndex ? null : rodId,
    );
    nextPlacements[targetIndex] = solutionIds[targetIndex];
    this.placements.set(nextPlacements);
    this.clearSelection();

    if (this.isSolved()) {
      this.feedback.set({
        tone: 'success',
        text: 'L’indice termine la chaîne. Bien joué !',
      });
    } else {
      this.feedback.set({
        tone: 'info',
        text: `Indice : la position ${targetIndex + 1} est maintenant correcte.`,
      });
    }
  }

  protected resetPath(): void {
    this.placements.set(this.createEmptyPlacements());
    this.clearSelection();
    this.feedback.set({
      tone: 'info',
      text: 'La chaîne est vide. Clique une tige pour la prendre.',
    });
  }

  protected newPuzzle(): void {
    this.puzzle.set(createColoredRodsPuzzle());
    this.placements.set(this.createEmptyPlacements());
    this.clearSelection();
    this.feedback.set({
      tone: 'info',
      text: 'Nouveau défi : relie le départ à l’arrivée sans répétition.',
    });
  }

  protected colorLabel(color: ColoredRodColor): string {
    const labels: Record<ColoredRodColor, string> = {
      red: 'rouge',
      blue: 'bleu',
      yellow: 'jaune',
      green: 'vert',
      purple: 'violet',
      orange: 'orange',
    };

    return labels[color];
  }

  protected levelLabel(level: ColoredRodLevel): string {
    const labels: Record<ColoredRodLevel, string> = {
      haut: 'haut',
      milieu: 'milieu',
      bas: 'bas',
    };

    return labels[level];
  }

  protected rodName(rod: ColoredRod): string {
    if (rod.id === 'start') {
      return 'Tige de départ';
    }

    if (rod.id === 'finish') {
      return 'Tige d’arrivée';
    }

    return `Tige ${rod.id.replace('rod-', '')}`;
  }

  protected rodLabel(rod: ColoredRod): string {
    return `${this.levelLabel('haut')} ${this.colorLabel(rod.colors[0])}, ${this.levelLabel('milieu')} ${this.colorLabel(rod.colors[1])}, ${this.levelLabel('bas')} ${this.colorLabel(rod.colors[2])}`;
  }

  protected slotAriaLabel(index: number): string {
    const rod = this.placedRods()[index];

    if (!rod) {
      const selectedMessage =
        this.selectedTrayRodId() === null
          ? 'Cliquer pour y placer une tige.'
          : 'Cliquer pour y placer la tige sélectionnée.';

      return 'Position ' + (index + 1) + ', vide. ' + selectedMessage;
    }

    if (this.selectedSlotIndex() === index) {
      return (
        'Position ' +
        (index + 1) +
        ', ' +
        this.rodLabel(rod) +
        '. Tige sélectionnée. Cliquer sur une autre position pour la déplacer.'
      );
    }

    return (
      'Position ' +
      (index + 1) +
      ', ' +
      this.rodLabel(rod) +
      '. Cliquer pour sélectionner cette tige.'
    );
  }

  private createEmptyPlacements(): (string | null)[] {
    return this.slots.map(() => null);
  }

  private updatePointerPosition(event?: MouseEvent | PointerEvent): void {
    if (event) {
      this.pointerPosition.set({ x: event.clientX, y: event.clientY });
    }
  }

  private clearSelection(): void {
    this.selectedSlotIndex.set(null);
    this.selectedTrayRodId.set(null);
  }

  private returnSelectedPieceToReserve(): void {
    const selectedSlotIndex = this.selectedSlotIndex();
    const hasSelectedPiece = selectedSlotIndex !== null || this.selectedTrayRodId() !== null;

    if (!hasSelectedPiece) {
      return;
    }

    if (selectedSlotIndex !== null && this.placements()[selectedSlotIndex] !== null) {
      const nextPlacements = [...this.placements()];
      nextPlacements[selectedSlotIndex] = null;
      this.placements.set(nextPlacements);
    }

    this.clearSelection();
    this.feedback.set({
      tone: 'info',
      text: 'Tige remise dans la réserve.',
    });
  }

  private rodFromId(rodId: string | null): ColoredRod | null {
    return rodId ? (this.puzzle().rods.find((rod) => rod.id === rodId) ?? null) : null;
  }

  private setDragPayload(source: DragSource, event: DragEvent): void {
    this.draggedSource.set(source);

    if (!event.dataTransfer) {
      return;
    }

    const payload = JSON.stringify(source);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(this.dragMimeType, payload);
    event.dataTransfer.setData('text/plain', payload);
  }

  private readDragSource(event: DragEvent): DragSource | null {
    const rawPayload =
      event.dataTransfer?.getData(this.dragMimeType) ||
      event.dataTransfer?.getData('text/plain') ||
      null;

    if (!rawPayload) {
      return this.draggedSource();
    }

    try {
      const payload: unknown = JSON.parse(rawPayload);

      if (!payload || typeof payload !== 'object') {
        return null;
      }

      const record = payload as Record<string, unknown>;
      const rodId = record['rodId'];
      const slotIndex = record['slotIndex'];

      if (
        typeof rodId !== 'string' ||
        !this.rodFromId(rodId) ||
        !(
          slotIndex === null ||
          (typeof slotIndex === 'number' &&
            Number.isInteger(slotIndex) &&
            slotIndex >= 0 &&
            slotIndex < this.slots.length)
        )
      ) {
        return null;
      }

      return { rodId, slotIndex };
    } catch {
      return null;
    }
  }
}
