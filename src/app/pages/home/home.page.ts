import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PuzzlePlayHistoryService } from '../../puzzle-play-history.service';
import {
  PlaylistProgressSnapshot,
  PuzzlePlaylist,
  PuzzlePlaylistService,
} from '../../puzzle-playlist.service';
import { LAB_PUZZLE_TYPES } from '../lab/lab.puzzle-types';
import {
  FirebasePuzzleCatalogService,
  PuzzleCatalogApprovalState,
} from '../../shared/firebase/firebase-puzzle-catalog.service';
import { AppStorageService } from '../../shared/storage/app-storage.service';

type PuzzleCard = {
  title: string;
  description: string;
  route: string;
  tag?: string;
  needsCompletion?: boolean;
};

type PlaylistPuzzleOption = PuzzleCard & {
  categoryTitle: string;
};

type PuzzleCategory = {
  id: string;
  title: string;
  description: string;
  puzzles: PuzzleCard[];
  emptyText?: string;
  sortable?: boolean;
  showSolvedStatus?: boolean;
};

type HomeSortMode = 'default' | 'oldest';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly sortModeStorageKey = 'epique-home-sort-mode';
  private readonly router = inject(Router);
  private readonly storage = inject(AppStorageService);
  private readonly playHistory = inject(PuzzlePlayHistoryService);
  private readonly playlistService = inject(PuzzlePlaylistService);
  private readonly firebaseCatalog = inject(FirebasePuzzleCatalogService);
  private readonly labTypeNames = signal<Record<string, string>>({});
  private readonly labTypeStates = signal<Record<string, PuzzleCatalogApprovalState>>({});

  readonly sortMode = signal<HomeSortMode>(this.readSortMode());
  readonly searchQuery = signal('');
  readonly playlists = this.playlistService.playlists;
  readonly newPlaylistName = signal('');
  readonly editingPlaylistId = signal<string | null>(null);
  readonly pendingPlaylistDeletionId = signal<string | null>(null);
  readonly editingPlaylist = computed(
    () => this.playlists().find((playlist) => playlist.id === this.editingPlaylistId()) ?? null,
  );
  readonly pendingPlaylistDeletion = computed(
    () =>
      this.playlists().find((playlist) => playlist.id === this.pendingPlaylistDeletionId()) ?? null,
  );
  readonly playlistPuzzleOptions = computed<PlaylistPuzzleOption[]>(() =>
    this.categories().flatMap((category) =>
      category.puzzles.map((puzzle) => ({ ...puzzle, categoryTitle: category.title })),
    ),
  );
  readonly categories = computed<PuzzleCategory[]>(() => {
    const labCategory: PuzzleCategory = {
      id: 'enigmes',
      title: 'Énigmes',
      description: 'Énigmes approuvées du laboratoire.',
      puzzles: LAB_PUZZLE_TYPES.filter(
        (type) => (this.labTypeStates()[type.id] ?? type.state) === 'approved',
      ).map((type) => ({
        title: this.labTypeNames()[type.id] ?? type.name,
        description: type.description,
        route: type.playRoute,
        tag: 'Énigme',
      })),
      emptyText: 'Aucune énigme approuvée pour le moment.',
      sortable: false,
      showSolvedStatus: true,
    };

    return [...this.baseCategories, labCategory].map((category) => ({
      ...category,
      puzzles:
        this.sortMode() === 'oldest' && category.sortable !== false
          ? [...category.puzzles].sort((first, second) => this.compareByOldestPlayed(first, second))
          : category.puzzles,
    }));
  });
  readonly visibleCategories = computed<PuzzleCategory[]>(() => {
    const query = this.normalizeSearch(this.searchQuery());

    if (!query) {
      return this.categories();
    }

    return this.categories()
      .map((category) => ({
        ...category,
        puzzles: category.puzzles.filter((puzzle) =>
          this.normalizeSearch(puzzle.title).includes(query),
        ),
      }))
      .filter((category) => category.puzzles.length > 0);
  });

  constructor() {
    this.storage.changes$.subscribe((change) => {
      if (change.source === 'remote' && change.key === this.sortModeStorageKey) {
        this.sortMode.set(this.readSortMode());
      }
    });

    void this.loadApprovedLabPuzzles();
  }

  private readonly baseCategories: PuzzleCategory[] = [
    {
      id: 'mots-langage',
      title: 'Mots et langage',
      description: 'Jeux de lettres, de phrases et de déchiffrement.',
      puzzles: [
        {
          title: 'Anagrammes',
          description: 'Réarrange les lettres pour retrouver le mot caché.',
          route: '/anagrams',
          tag: 'Lettres',
        },
        {
          title: 'Crypto',
          description: 'Déchiffre un message codé à partir d’indices.',
          route: '/cryptograms',
          tag: 'Code',
        },
        {
          title: 'Mots cachés',
          description: 'Trouve les mots dans la grille, puis déchiffre les lettres restantes.',
          route: '/word-search',
          tag: 'Grille',
        },
        {
          title: 'Échelle de mots',
          description: 'Change une lettre à la fois pour passer du mot de départ au mot cible.',
          route: '/word-ladder',
          tag: 'Lettres',
        },
        {
          title: 'Mot pivot',
          description: 'Trouve le mot commun qui relie trois expressions.',
          route: '/pivot-word',
          tag: 'Associations',
        },
        {
          title: 'Lettres parasites',
          description: 'Barre les lettres inutiles pour retrouver la phrase cachée.',
          route: '/hidden-phrase',
          tag: 'Phrase',
        },
        {
          title: 'Phrases',
          description: 'Reconstruis ou devine la phrase cachée.',
          route: '/phrases',
          tag: 'Langage',
        },
      ],
    },
    {
      id: 'ciphers',
      title: 'Ciphers',
      description: 'Mots transformés avec des codes simples à décoder mentalement.',
      puzzles: [
        {
          title: 'César',
          description: 'Retrouve le mot original après un décalage de lettres.',
          route: '/ciphers/caesar',
          tag: 'Codes',
        },
        {
          title: 'Pigpen',
          description: 'Décode les lettres remplacées par des symboles de grille.',
          route: '/ciphers/pigpen',
          tag: 'Codes',
        },
        {
          title: 'A1Z26',
          description: 'Convertis les nombres en lettres de A à Z.',
          route: '/ciphers/a1z26',
          tag: 'Codes',
        },
        {
          title: 'Morse',
          description: 'Lis les points et les traits pour retrouver le mot.',
          route: '/ciphers/morse',
          tag: 'Codes',
        },
        {
          title: 'Braille',
          description: 'Décode les cellules braille en lettres.',
          route: '/ciphers/braille',
          tag: 'Codes',
        },
        {
          title: 'Atbash',
          description: 'Inverse l’alphabet pour retrouver le mot caché.',
          route: '/ciphers/atbash',
          tag: 'Codes',
        },
        {
          title: 'Tap code',
          description: 'Utilise les coordonnées de la grille 5 x 5.',
          route: '/ciphers/tap-code',
          tag: 'Codes',
        },
        {
          title: 'Sémaphore',
          description: 'Lis les positions de deux drapeaux pour décoder le mot.',
          route: '/ciphers/semaphore',
          tag: 'Codes',
        },
        {
          title: 'NATO',
          description: 'Retrouve les lettres depuis l’alphabet radio.',
          route: '/ciphers/nato',
          tag: 'Codes',
        },
      ],
    },
    {
      id: 'memoire',
      title: 'Mémoire',
      description: 'Jeux basés sur la mémorisation, les symboles et les associations.',
      puzzles: [
        {
          title: 'Grille mémoire',
          description: 'Mémorise une grille de formes et de couleurs.',
          route: '/memory-grid',
          tag: 'Mémoire',
        },
        {
          title: 'Paires de symboles',
          description: 'Retourne les cartes et retrouve tous les symboles identiques.',
          route: '/symbol-pairs',
          tag: 'Paires',
        },
        {
          title: 'Mnémotechnique',
          description: 'Pratique les associations objet, qualité, action et lieu.',
          route: '/mnemonic',
          tag: 'Méthode',
        },
      ],
    },
    {
      id: 'nombres-calcul',
      title: 'Nombres et calcul',
      description: 'Suites, grilles numériques et raisonnement mathématique.',
      puzzles: [
        {
          title: 'Suites mathématiques',
          description: 'Trouve le prochain nombre dans une suite logique.',
          route: '/sequences',
          tag: 'Nombres',
        },
        {
          title: 'Calcul croisé',
          description: 'Complète une grille où les lignes et les colonnes forment des équations.',
          route: '/crossmath',
          tag: 'Calcul',
        },
        {
          title: 'Carré latin',
          description: 'Place chaque chiffre une seule fois par ligne et par colonne.',
          route: '/latin-square',
          tag: 'Grille',
        },
        {
          title: 'Carré magique',
          description: 'Complète la grille pour atteindre la même somme partout.',
          route: '/magic-square',
          tag: 'Sommes',
        },
        {
          title: 'Pyramide de sommes',
          description: 'Complète la pyramide en additionnant deux cases collées vers le haut.',
          route: '/sum-pyramid',
          tag: 'Sommes',
        },
        {
          title: 'Compte est bon',
          description:
            'Utilise les nombres disponibles et les opérations pour approcher une cible.',
          route: '/count-is-good',
          tag: 'Cible',
        },
        {
          title: 'KenKen / Calcudoku',
          description:
            'Complète une grille avec des chiffres uniques et des contraintes de calcul.',
          route: '/calcudoku',
          tag: 'Contraintes',
        },
        {
          title: 'Arithmétique mentale',
          description: 'Résous des calculs courts et rapides en gardant le rythme.',
          route: '/mental-arithmetic',
          tag: 'Vitesse',
        },
        {
          title: 'Nim',
          description: 'Analyse les tas et trouve les bons retraits avec la logique XOR.',
          route: '/nim',
          tag: 'XOR',
        },
      ],
    },
    {
      id: 'deduction-logique',
      title: 'Déduction et logique',
      description: 'Puzzles où il faut éliminer les possibilités et lire entre les indices.',
      puzzles: [
        {
          title: 'Chevaliers et menteurs',
          description: 'Déduis qui dit toujours vrai et qui ment toujours.',
          route: '/knights-and-knaves',
          tag: 'Logique',
        },
        {
          title: 'Balance logique',
          description: 'Compare des pierres colorées et déduis leur poids.',
          route: '/weight-deduction',
          tag: 'Pesées',
        },
        {
          title: 'Poids suspendus',
          description: 'Équilibre les leviers et retrouve les poids accrochés aux branches.',
          route: '/hanging-weights',
          tag: 'Leviers',
        },
        {
          title: 'Mastermind',
          description: 'Devine une suite de formes et de couleurs.',
          route: '/mastermind',
          tag: 'Déduction',
        },
        {
          title: 'Zebra Puzzle',
          description: 'Déduis les bonnes caractéristiques en fonction des indices.',
          route: '/zebra',
          tag: 'Déduction',
        },
      ],
    },
    {
      id: 'spatial-placement',
      title: 'Spatial et placement',
      description: 'Casse-têtes de formes, de déplacements et de reconstruction visuelle.',
      puzzles: [
        {
          title: 'Grille de pièces',
          description: 'Place les pièces dans la grille pour compléter le puzzle.',
          route: '/jigsaw-grid',
          tag: 'Placement',
        },
        {
          title: 'Chemins',
          description: 'Reconstruis le chemin continu avec les blocs disponibles.',
          route: '/jigsaw-blocks',
          tag: 'Chemin',
        },
        {
          title: 'Cube 3 faces',
          description:
            'Reconstruis trois images sur un coin de cube avec des morceaux de face, d’arête et de coin.',
          route: '/corner-cube',
          tag: '3D',
        },
        {
          title: 'Taquin 15',
          description:
            'Glisse les 15 pièces pour remettre les nombres en ordre ou reconstruire une image.',
          route: '/sliding-puzzle',
          tag: 'Glisse',
        },
        {
          title: 'Problème du Cavalier',
          description: 'Enchaîne les sauts du cavalier pour révéler un mot caché.',
          route: '/knights-tour',
          tag: 'Cavalier',
        },
        {
          title: 'Superposition',
          description: 'Superpose les formes colorées dans le bon ordre pour reproduire l’image.',
          route: '/shape-layers',
          tag: 'Formes',
        },
        {
          title: 'Tangram',
          description: 'Place et assemble les sept pièces classiques du tangram.',
          route: '/tangram',
          tag: 'Formes',
        },
        {
          title: 'Laser',
          description: 'Fais tourner les miroirs pour guider le laser jusqu’à la bonne sortie.',
          route: '/laser',
          tag: 'Réflexion',
        },
        {
          title: 'Rush Hour',
          description: 'Déplace les véhicules dans une grille 6×6 pour libérer la voiture rouge.',
          route: '/rush-hour',
          tag: 'Blocage',
        },
        {
          title: 'Tiges colorées',
          description: 'Aligne les tiges sans répéter une couleur au même niveau.',
          route: '/color-rods',
          tag: 'Couleurs',
        },
        {
          title: 'Dé logique',
          description: 'Suis le parcours d’un dé et retrouve le dernier symbole.',
          route: '/dice',
          tag: 'Spatial',
        },
      ],
    },
    {
      id: 'strategie-timing',
      title: 'Stratégie et timing',
      description: 'Jeux plus directs où le bon coup ou le bon moment fait toute la différence.',
      puzzles: [
        {
          title: 'Tic-Tac-Toe',
          description: 'Déplace tes trois X et aligne-les avant le CPU.',
          route: '/tic-tac-toe',
          tag: 'Stratégie',
        },
        {
          title: 'Chute cachée',
          description: 'Lance quatre billes au bon moment pour les faire arriver ensemble.',
          route: '/timing-drop',
          tag: 'Timing',
        },
      ],
    },
    {
      id: 'multijoueurs',
      title: 'Multi-joueurs',
      description: 'Jeux à partager en salle avec plusieurs joueurs.',
      puzzles: [
        {
          title: 'Description de symboles',
          description: 'Décris un symbole pour que les autres retrouvent la bonne image.',
          route: '/describe-symbols',
          tag: 'En ligne',
        },
      ],
    },
  ];

  private async loadApprovedLabPuzzles(): Promise<void> {
    if (!this.firebaseCatalog.isConfigured) {
      return;
    }

    try {
      const overrides = await this.firebaseCatalog.loadStatuses();
      this.labTypeNames.set(overrides.typeNames);
      this.labTypeStates.set(overrides.typeStates);
    } catch {
      // L’accueil conserve la liste vide tant que le catalogue LAB est indisponible.
    }
  }

  setSortMode(sortMode: HomeSortMode): void {
    this.sortMode.set(sortMode);
    this.writeSortMode(sortMode);
  }

  setSearchQuery(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  setNewPlaylistName(event: Event): void {
    this.newPlaylistName.set((event.target as HTMLInputElement).value);
  }

  createPlaylist(): void {
    const name = this.newPlaylistName().trim();
    const playlist = this.playlistService.create(name || `Playlist ${this.playlists().length + 1}`);

    this.newPlaylistName.set('');
    this.editingPlaylistId.set(playlist.id);
  }

  editPlaylist(playlistId: string): void {
    this.editingPlaylistId.set(playlistId);
  }

  closePlaylistEditor(): void {
    this.editingPlaylistId.set(null);
  }

  renamePlaylist(playlistId: string, event: Event): void {
    this.playlistService.update(playlistId, {
      name: (event.target as HTMLInputElement).value,
    });
  }

  isPuzzleInPlaylist(playlistId: string, route: string): boolean {
    return this.playlistService.find(playlistId)?.routes.includes(route) ?? false;
  }

  playlistProgress(playlist: PuzzlePlaylist): PlaylistProgressSnapshot | null {
    return this.playlistService.progressFor(playlist);
  }

  areAllCategoryPuzzlesInPlaylist(playlistId: string, puzzles: PuzzleCard[]): boolean {
    const playlist = this.playlistService.find(playlistId);

    return (
      puzzles.length > 0 &&
      !!playlist &&
      puzzles.every((puzzle) => playlist.routes.includes(puzzle.route))
    );
  }

  togglePlaylistCategory(playlistId: string, puzzles: PuzzleCard[]): void {
    const playlist = this.playlistService.find(playlistId);

    if (!playlist || puzzles.length === 0) {
      return;
    }

    const categoryRoutes = puzzles.map((puzzle) => puzzle.route);
    const selectedRoutes = new Set(playlist.routes);
    const shouldSelectAll = categoryRoutes.some((route) => !selectedRoutes.has(route));
    const routes = shouldSelectAll
      ? [...playlist.routes, ...categoryRoutes.filter((route) => !selectedRoutes.has(route))]
      : playlist.routes.filter((route) => !categoryRoutes.includes(route));

    this.playlistService.update(playlistId, { routes });
  }

  togglePlaylistPuzzle(playlistId: string, route: string, event: Event): void {
    const playlist = this.playlistService.find(playlistId);

    if (!playlist) {
      return;
    }

    const checked = (event.target as HTMLInputElement).checked;
    const routes = checked
      ? [...playlist.routes, ...(playlist.routes.includes(route) ? [] : [route])]
      : playlist.routes.filter((candidate) => candidate !== route);

    this.playlistService.update(playlistId, { routes });
  }

  removePlaylistPuzzle(playlistId: string, route: string): void {
    const playlist = this.playlistService.find(playlistId);

    if (playlist) {
      this.playlistService.update(playlistId, {
        routes: playlist.routes.filter((candidate) => candidate !== route),
      });
    }
  }

  movePlaylistPuzzle(playlistId: string, index: number, offset: number): void {
    const playlist = this.playlistService.find(playlistId);
    const targetIndex = index + offset;

    if (!playlist || targetIndex < 0 || targetIndex >= playlist.routes.length) {
      return;
    }

    const routes = [...playlist.routes];
    [routes[index], routes[targetIndex]] = [routes[targetIndex], routes[index]];
    this.playlistService.update(playlistId, { routes });
  }

  requestDeletePlaylist(playlistId: string): void {
    if (this.playlistService.find(playlistId)) {
      this.pendingPlaylistDeletionId.set(playlistId);
    }
  }

  cancelDeletePlaylist(): void {
    this.pendingPlaylistDeletionId.set(null);
  }

  confirmDeletePlaylist(): void {
    const playlistId = this.pendingPlaylistDeletionId();

    if (!playlistId) {
      return;
    }

    this.playlistService.remove(playlistId);

    if (this.editingPlaylistId() === playlistId) {
      this.editingPlaylistId.set(null);
    }

    this.pendingPlaylistDeletionId.set(null);
  }

  @HostListener('document:keydown.escape')
  closePlaylistDeletionOnEscape(): void {
    if (this.pendingPlaylistDeletionId()) {
      this.cancelDeletePlaylist();
    }
  }

  playPlaylist(playlist: PuzzlePlaylist, randomOrder = false): void {
    const url = this.playlistService.startUrl(playlist, randomOrder);

    if (url) {
      void this.router.navigateByUrl(url);
    }
  }

  playlistPuzzleTitle(route: string): string {
    return this.playlistPuzzleOptions().find((puzzle) => puzzle.route === route)?.title ?? route;
  }

  playRandomOldestPuzzle(): void {
    const puzzles = this.baseCategories
      .filter((category) => category.sortable !== false && category.id !== 'multijoueurs')
      .flatMap((category) => category.puzzles);

    if (puzzles.length === 0) {
      return;
    }

    const oldestPlayedAt = Math.min(
      ...puzzles.map((puzzle) => this.playHistory.lastPlayedAt(puzzle.route) ?? 0),
    );
    const oldestPuzzles = puzzles.filter(
      (puzzle) => (this.playHistory.lastPlayedAt(puzzle.route) ?? 0) === oldestPlayedAt,
    );
    const randomPuzzle = oldestPuzzles[Math.floor(Math.random() * oldestPuzzles.length)];

    void this.router.navigateByUrl(`${randomPuzzle.route}?from=random`);
  }

  lastPlayedText(route: string): string {
    const playedAt = this.playHistory.lastPlayedAt(route);

    if (!playedAt) {
      return 'Jamais joué';
    }

    const elapsedMilliseconds = Date.now() - playedAt;
    const elapsedDays = Math.floor(elapsedMilliseconds / 86_400_000);

    if (elapsedDays <= 0) {
      return "Joué aujourd'hui";
    }

    if (elapsedDays === 1) {
      return 'Joué hier';
    }

    if (elapsedDays < 7) {
      return `Joué il y a ${elapsedDays} jours`;
    }

    return `Dernière fois : ${new Intl.DateTimeFormat('fr-CA', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(playedAt))}`;
  }

  solvedStatusText(route: string): string {
    return this.playHistory.isSolved(route) ? 'Résolue' : 'Non résolue';
  }

  solvedStatusClass(route: string): string {
    return this.playHistory.isSolved(route) ? 'solved' : 'unsolved';
  }

  private compareByOldestPlayed(first: PuzzleCard, second: PuzzleCard): number {
    const firstPlayedAt = this.playHistory.lastPlayedAt(first.route) ?? 0;
    const secondPlayedAt = this.playHistory.lastPlayedAt(second.route) ?? 0;

    return firstPlayedAt - secondPlayedAt || first.title.localeCompare(second.title);
  }

  private readSortMode(): HomeSortMode {
    try {
      const storedSortMode = this.storage.get(this.sortModeStorageKey);

      return storedSortMode === 'oldest' ? 'oldest' : 'default';
    } catch {
      return 'default';
    }
  }

  private writeSortMode(sortMode: HomeSortMode): void {
    try {
      this.storage.set(this.sortModeStorageKey, sortMode);
    } catch {
      // The selected order still applies for the current page when storage is unavailable.
    }
  }

  private normalizeSearch(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr-CA')
      .trim();
  }
}
