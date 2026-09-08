import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CreeSyllabicsLegendComponent } from './cree-syllabics-legend.component';
import {
  CipherLegendItem,
  CipherTransformStep,
  CipherType,
  CiphersService,
  SEMAPHORE_ORIENTATION_GROUPS,
  SemaphoreOrientationGroup,
} from './ciphers.service';

type CheatsheetSection = {
  id: CipherType;
  title: string;
  description: string;
  route: string;
};

type TransformStep = CipherTransformStep & {
  id: number;
  caesarShift: number;
};

type CheatsheetView = 'legends' | 'transformer';
type SemaphoreOrientationGroupView = SemaphoreOrientationGroup & {
  items: CipherLegendItem[];
};

@Component({
  selector: 'app-cipher-cheatsheet-page',
  imports: [RouterLink, CreeSyllabicsLegendComponent],
  templateUrl: './cipher-cheatsheet.page.html',
  styleUrl: './cipher-cheatsheet.page.scss',
})
export class CipherCheatsheetPage {
  private readonly ciphersService = inject(CiphersService);

  protected readonly ciphers: readonly CheatsheetSection[] = [
    {
      id: 'a1z26',
      title: 'A1Z26',
      description: 'Les lettres sont remplacées par leur rang dans l’alphabet.',
      route: '/ciphers/a1z26',
    },
    {
      id: 'atbash',
      title: 'Atbash',
      description: 'L’alphabet est lu à l’envers : A devient Z, B devient Y, etc.',
      route: '/ciphers/atbash',
    },
    {
      id: 'braille',
      title: 'Braille',
      description: 'Les points actifs dans une cellule de six positions indiquent la lettre.',
      route: '/ciphers/braille',
    },
    {
      id: 'caesar',
      title: 'César',
      description: 'Chaque lettre avance ou recule du même nombre de positions dans l’alphabet.',
      route: '/ciphers/caesar',
    },
    {
      id: 'morse',
      title: 'Morse',
      description: 'Chaque lettre est écrite avec une combinaison de points et de traits.',
      route: '/ciphers/morse',
    },
    {
      id: 'nato',
      title: 'NATO',
      description: 'Chaque lettre est associée à un mot de l’alphabet radio international.',
      route: '/ciphers/nato',
    },
    {
      id: 'pigpen',
      title: 'Pigpen',
      description: 'Chaque lettre est remplacée par la portion de grille qui l’entoure.',
      route: '/ciphers/pigpen',
    },
    {
      id: 'semaphore',
      title: 'Sémaphore',
      description: 'La combinaison de deux positions de drapeaux représente une lettre.',
      route: '/ciphers/semaphore',
    },
    {
      id: 'tap-code',
      title: 'Tap code',
      description: 'Deux chiffres donnent la ligne et la colonne d’une lettre dans la grille.',
      route: '/ciphers/tap-code',
    },
    {
      id: 'cree-syllabics',
      title: 'Syllabique cri',
      description:
        'Les sons du mot français sont rapprochés des caractères syllabiques du cri oriental.',
      route: '/ciphers/cree-syllabics',
    },
  ];

  protected readonly transformInput = signal('');
  protected readonly transformSteps = signal<TransformStep[]>([]);
  protected readonly transformStages = computed(() => {
    let current = this.transformInput();

    return this.transformSteps().map((step) => {
      current = this.ciphersService.transformText(current, [step]);
      return {
        id: step.id,
        type: step.type,
        value: current,
      };
    });
  });
  protected readonly activeView = signal<CheatsheetView>('legends');
  private nextTransformStepId = 1;

  protected readonly alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  protected readonly caesarShiftedAlphabet = 'BCDEFGHIJKLMNOPQRSTUVWXYZA'.split('');
  protected readonly atbashAlphabet = 'ZYXWVUTSRQPONMLKJIHGFEDCBA'.split('');
  protected readonly a1z26Legend = this.alphabet.map((letter, index) => ({
    letter,
    symbol: String(index + 1),
  }));
  protected readonly morseLegend: CipherLegendItem[] = this.ciphersService.legendFor('morse');
  protected readonly semaphoreLegend: CipherLegendItem[] =
    this.ciphersService.legendFor('semaphore');
  protected readonly semaphoreOrientationGroups: readonly SemaphoreOrientationGroupView[] =
    SEMAPHORE_ORIENTATION_GROUPS.map((group) => ({
      ...group,
      items: this.semaphoreItemsFor(group.letters),
    }));
  protected readonly natoLegend: CipherLegendItem[] = this.ciphersService.legendFor('nato');
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

  protected isBrailleDotActive(letter: string, dot: number): boolean {
    return this.brailleDotsByLetter[letter.toLowerCase()]?.includes(dot) ?? false;
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

  protected updateTransformInput(event: Event): void {
    if (event.target instanceof HTMLTextAreaElement) {
      this.transformInput.set(event.target.value);
    }
  }

  protected setActiveView(view: CheatsheetView): void {
    this.activeView.set(view);
  }

  protected addTransformStep(type: CipherType): void {
    this.transformSteps.update((steps) => [
      ...steps,
      {
        id: this.nextTransformStepId++,
        type,
        caesarShift: 1,
      },
    ]);
  }

  protected removeTransformStep(id: number): void {
    this.transformSteps.update((steps) => steps.filter((step) => step.id !== id));
  }

  protected moveTransformStep(id: number, direction: -1 | 1): void {
    this.transformSteps.update((steps) => {
      const index = steps.findIndex((step) => step.id === id);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= steps.length) {
        return steps;
      }

      const nextSteps = [...steps];
      [nextSteps[index], nextSteps[nextIndex]] = [nextSteps[nextIndex], nextSteps[index]];
      return nextSteps;
    });
  }

  protected updateCaesarShift(id: number, event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) return;

    const value = Number(event.target.value);
    if (!Number.isFinite(value)) return;

    const caesarShift = Math.max(-25, Math.min(25, Math.trunc(value)));
    this.transformSteps.update((steps) =>
      steps.map((step) => (step.id === id ? { ...step, caesarShift } : step)),
    );
  }

  protected cipherLabel(type: CipherType): string {
    return this.ciphers.find((cipher) => cipher.id === type)?.title ?? type;
  }
}
