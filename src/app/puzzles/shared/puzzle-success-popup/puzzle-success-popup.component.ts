import {
  Component,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PuzzlePlayHistoryService } from '../../../puzzle-play-history.service';
import { PuzzlePlaylistService } from '../../../puzzle-playlist.service';

export type PuzzlePopupTone = 'success' | 'partial';

@Component({
  selector: 'app-puzzle-success-popup',
  imports: [RouterLink],
  templateUrl: './puzzle-success-popup.component.html',
  styleUrl: './puzzle-success-popup.component.scss',
})
export class PuzzleSuccessPopupComponent implements OnInit {
  private readonly randomPuzzleRoutes = [
    '/anagrams',
    '/cryptograms',
    '/word-search',
    '/word-ladder',
    '/pivot-word',
    '/hidden-phrase',
    '/phrases',
    '/ciphers/caesar',
    '/ciphers/pigpen',
    '/ciphers/a1z26',
    '/ciphers/morse',
    '/ciphers/braille',
    '/ciphers/atbash',
    '/ciphers/tap-code',
    '/ciphers/semaphore',
    '/ciphers/nato',
    '/ciphers/cree-syllabics',
    '/memory-grid',
    '/symbol-pairs',
    '/mnemonic',
    '/sequences',
    '/crossmath',
    '/latin-square',
    '/magic-square',
    '/sum-pyramid',
    '/count-is-good',
    '/calcudoku',
    '/mental-arithmetic',
    '/nim',
    '/knights-and-knaves',
    '/weight-deduction',
    '/hanging-weights',
    '/mastermind',
    '/zebra',
    '/jigsaw-grid',
    '/jigsaw-blocks',
    '/corner-cube',
    '/sliding-puzzle',
    '/knights-tour',
    '/laser',
    '/shape-layers',
    '/tangram',
    '/rush-hour',
    '/tiges',
    '/color-rods',
    '/dice',
    '/tic-tac-toe',
    '/timing-drop',
    '/play/count-by-symbol',
    '/play/geometric-shapes',
    '/play/seven-segment',
    '/play/faux-words',
    '/play/segment-phrase',
    '/play/color-chain',
    '/play/syllabic-rotation',
  ];

  private readonly sectionFragmentsByRoute: Record<string, string> = {
    anagrams: 'mots-langage',
    cryptograms: 'mots-langage',
    'word-search': 'mots-langage',
    'word-ladder': 'mots-langage',
    'pivot-word': 'mots-langage',
    'hidden-phrase': 'mots-langage',
    phrases: 'mots-langage',
    'ciphers/caesar': 'ciphers',
    'ciphers/pigpen': 'ciphers',
    'ciphers/a1z26': 'ciphers',
    'ciphers/morse': 'ciphers',
    'ciphers/braille': 'ciphers',
    'ciphers/atbash': 'ciphers',
    'ciphers/tap-code': 'ciphers',
    'ciphers/semaphore': 'ciphers',
    'ciphers/nato': 'ciphers',
    'ciphers/cree-syllabics': 'ciphers',
    'memory-grid': 'memoire',
    'symbol-pairs': 'memoire',
    mnemonic: 'memoire',
    sequences: 'nombres-calcul',
    crossmath: 'nombres-calcul',
    'latin-square': 'nombres-calcul',
    'magic-square': 'nombres-calcul',
    'sum-pyramid': 'nombres-calcul',
    'count-is-good': 'nombres-calcul',
    calcudoku: 'nombres-calcul',
    'mental-arithmetic': 'nombres-calcul',
    nim: 'nombres-calcul',
    'knights-and-knaves': 'deduction-logique',
    'weight-deduction': 'deduction-logique',
    'hanging-weights': 'deduction-logique',
    mastermind: 'deduction-logique',
    zebra: 'deduction-logique',
    'jigsaw-grid': 'spatial-placement',
    'jigsaw-blocks': 'spatial-placement',
    'corner-cube': 'spatial-placement',
    'sliding-puzzle': 'spatial-placement',
    'knights-tour': 'spatial-placement',
    laser: 'spatial-placement',
    'shape-layers': 'spatial-placement',
    tangram: 'spatial-placement',
    tiges: 'spatial-placement',
    'color-rods': 'spatial-placement',
    'rush-hour': 'spatial-placement',
    dice: 'spatial-placement',
    'tic-tac-toe': 'strategie-timing',
    'timing-drop': 'strategie-timing',
    'describe-symbols': 'multijoueurs',
    'puzzlehunt/navigation': 'enigmes',
    'puzzlehunt/clock-letters': 'enigmes',
    'play/count-by-symbol': 'enigmes',
    'play/geometric-shapes': 'enigmes',
    'play/seven-segment': 'enigmes',
    'play/faux-words': 'enigmes',
    'play/segment-phrase': 'enigmes',
    'play/color-chain': 'enigmes',
    'play/syllabic-rotation': 'enigmes',
  };

  private readonly router = inject(Router);
  private readonly playHistory = inject(PuzzlePlayHistoryService);
  private readonly playlistService = inject(PuzzlePlaylistService);
  protected readonly dismissed = signal(false);

  @Input({ required: true }) title = '';
  @Input() message = '';
  @Input() answer = '';
  @Input() actionLabel = 'Nouvelle partie';
  @Input() showAction = true;
  @Input() showMenuLink = true;
  @Input() tone: PuzzlePopupTone = 'success';

  @Output() readonly action = new EventEmitter<void>();

  ngOnInit(): void {
    if (this.tone !== 'success' || !this.cameFromPlaylist) {
      return;
    }

    const progress = this.playlistService.progressFromUrl(this.router.url);

    if (progress) {
      // Save the next item as soon as the current puzzle is solved, even if the
      // player closes the popup instead of clicking « Jeu suivant ».
      this.playlistService.complete(progress);
    }
  }

  protected get menuFragment(): string {
    const route = this.router.url.split(/[?#]/)[0].replace(/^\/+/, '');

    return this.sectionFragmentsByRoute[route] ?? route;
  }

  protected get cameFromRandom(): boolean {
    return (
      new URLSearchParams(this.router.url.split('?')[1]?.split('#')[0] ?? '').get('from') ===
      'random'
    );
  }

  protected get cameFromPlaylist(): boolean {
    return (
      new URLSearchParams(this.router.url.split('?')[1]?.split('#')[0] ?? '').get('from') ===
      'playlist'
    );
  }

  protected get primaryActionLabel(): string {
    if (!this.cameFromPlaylist) {
      return this.actionLabel;
    }

    return this.playlistService.progressFromUrl(this.router.url)?.nextRoute
      ? 'Jeu suivant'
      : 'Terminer la playlist';
  }

  protected handlePrimaryAction(): void {
    if (!this.cameFromPlaylist) {
      this.action.emit();
      return;
    }

    const progress = this.playlistService.progressFromUrl(this.router.url);

    if (progress?.nextRoute) {
      this.playlistService.complete(progress);
      void this.router.navigateByUrl(progress.nextRoute);
      return;
    }

    if (progress) {
      this.playlistService.complete(progress);
    }

    void this.router.navigate(['/'], { fragment: 'playlists' });
  }

  protected playAnotherRandomOldestPuzzle(): void {
    const currentRoute = this.router.url.split(/[?#]/)[0];
    const candidateRoutes = this.randomPuzzleRoutes.filter((route) => route !== currentRoute);

    if (candidateRoutes.length === 0) {
      return;
    }

    const oldestPlayedAt = Math.min(
      ...candidateRoutes.map((route) => this.playHistory.lastPlayedAt(route) ?? 0),
    );
    const oldestRoutes = candidateRoutes.filter(
      (route) => (this.playHistory.lastPlayedAt(route) ?? 0) === oldestPlayedAt,
    );
    const randomRoute = oldestRoutes[Math.floor(Math.random() * oldestRoutes.length)];

    void this.router.navigateByUrl(`${randomRoute}?from=random`);
  }

  protected dismissFromBackground(event: Event): void {
    const target = event.target;

    if (target instanceof Element && target.closest('button, a')) {
      return;
    }

    this.dismissed.set(true);
  }

  @HostListener('document:keydown.enter', ['$event'])
  protected handleEnter(event: Event): void {
    if (!this.showAction || (event as KeyboardEvent).repeat) {
      return;
    }

    event.preventDefault();
    this.action.emit();
  }
}
