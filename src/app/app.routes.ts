import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'play/:typeId',
    loadComponent: () => import('./pages/lab/lab.page').then((m) => m.LabPage),
  },
  {
    path: 'lab',
    loadComponent: () => import('./pages/lab/lab.page').then((m) => m.LabPage),
  },
  {
    path: 'lab/:typeId',
    loadComponent: () => import('./pages/lab/lab.page').then((m) => m.LabPage),
  },
  {
    path: 'anagrams',
    loadComponent: () => import('./puzzles/anagrams/anagram.page').then((m) => m.AnagramsPage),
  },
  {
    path: 'cryptograms',
    loadComponent: () =>
      import('./puzzles/cryptograms/cryptogram.page').then((m) => m.CryptogramsPage),
  },
  {
    path: 'ciphers',
    redirectTo: 'ciphers/caesar',
    pathMatch: 'full',
  },
  {
    path: 'ciphers/cheatsheet',
    loadComponent: () =>
      import('./puzzles/ciphers/cipher-cheatsheet.page').then((m) => m.CipherCheatsheetPage),
  },
  {
    path: 'ciphers/:cipher',
    loadComponent: () => import('./puzzles/ciphers/ciphers.page').then((m) => m.CiphersPage),
  },
  {
    path: 'word-search',
    loadComponent: () =>
      import('./puzzles/word-search/word-search.page').then((m) => m.WordSearchPage),
  },
  {
    path: 'word-ladder',
    loadComponent: () =>
      import('./puzzles/word-ladder/word-ladder.page').then((m) => m.WordLadderPage),
  },
  {
    path: 'knights-tour',
    loadComponent: () =>
      import('./puzzles/knights-tour/knights-tour.page').then((m) => m.KnightsTourPage),
  },
  {
    path: 'pivot-word',
    loadComponent: () =>
      import('./puzzles/pivot-word/pivot-word.page').then((m) => m.PivotWordPage),
  },
  {
    path: 'hidden-phrase',
    loadComponent: () =>
      import('./puzzles/hidden-phrase/hidden-phrase.page').then((m) => m.HiddenPhrasePage),
  },
  {
    path: 'phrases',
    loadComponent: () => import('./puzzles/phrases/phrase.page').then((m) => m.PhrasesPage),
  },
  {
    path: 'memory-grid',
    loadComponent: () =>
      import('./puzzles/memory-grid/memory-grid.page').then((m) => m.MemoryGridPage),
  },
  {
    path: 'symbol-pairs',
    loadComponent: () =>
      import('./puzzles/symbol-pairs/symbol-pairs.page').then((m) => m.SymbolPairsPage),
  },
  {
    path: 'jigsaw-grid',
    loadComponent: () =>
      import('./puzzles/jigsaw-grid/jigsaw-grid.page').then((m) => m.JigsawGridPage),
  },
  {
    path: 'jigsaw-blocks',
    loadComponent: () =>
      import('./puzzles/jigsaw-blocks/jigsaw-blocks.page').then((m) => m.PathwaysPage),
  },
  {
    path: 'corner-cube',
    loadComponent: () =>
      import('./puzzles/corner-cube/corner-cube.page').then((m) => m.CornerCubePage),
  },
  {
    path: 'sliding-puzzle',
    loadComponent: () =>
      import('./puzzles/sliding-puzzle/sliding-puzzle.page').then((m) => m.SlidingPuzzlePage),
  },
  {
    path: 'laser',
    loadComponent: () => import('./puzzles/laser/laser.page').then((m) => m.LaserPage),
  },
  {
    path: 'tiges',
    loadComponent: () => import('./puzzles/tiges/tiges.page').then((m) => m.TigesPage),
  },
  {
    path: 'color-rods',
    loadComponent: () =>
      import('./puzzles/color-rods/color-rods.page').then((m) => m.ColorRodsPage),
  },
  {
    path: 'shape-layers',
    loadComponent: () =>
      import('./puzzles/shape-layers/shape-layers.page').then((m) => m.ShapeLayersPage),
  },
  {
    path: 'tangram',
    loadComponent: () => import('./puzzles/tangram/tangram.page').then((m) => m.TangramPage),
  },
  {
    path: 'knights-and-knaves',
    loadComponent: () =>
      import('./puzzles/knights-and-knaves/knights-and-knaves.page').then(
        (m) => m.KnightsAndKnavesPage,
      ),
  },
  {
    path: 'weight-deduction',
    loadComponent: () =>
      import('./puzzles/weight-deduction/weight-deduction.page').then((m) => m.WeightDeductionPage),
  },
  {
    path: 'hanging-weights',
    loadComponent: () =>
      import('./puzzles/hanging-weights/hanging-weights.page').then((m) => m.HangingWeightsPage),
  },
  {
    path: 'sequences',
    loadComponent: () => import('./puzzles/sequences/sequences.page').then((m) => m.SequencesPage),
  },
  {
    path: 'crossmath',
    loadComponent: () => import('./puzzles/crossmath/crossmath.page').then((m) => m.CrossmathPage),
  },
  {
    path: 'latin-square',
    loadComponent: () =>
      import('./puzzles/latin-square/latin-square.page').then((m) => m.LatinSquarePage),
  },
  {
    path: 'magic-square',
    loadComponent: () =>
      import('./puzzles/magic-square/magic-square.page').then((m) => m.MagicSquarePage),
  },
  {
    path: 'sum-pyramid',
    loadComponent: () =>
      import('./puzzles/sum-pyramid/sum-pyramid.page').then((m) => m.SumPyramidPage),
  },
  {
    path: 'count-is-good',
    loadComponent: () =>
      import('./puzzles/count-is-good/count-is-good.page').then((m) => m.CountIsGoodPage),
  },
  {
    path: 'calcudoku',
    loadComponent: () => import('./puzzles/calcudoku/calcudoku.page').then((m) => m.CalcudokuPage),
  },
  {
    path: 'mental-arithmetic',
    loadComponent: () =>
      import('./puzzles/mental-arithmetic/mental-arithmetic.page').then(
        (m) => m.MentalArithmeticPage,
      ),
  },
  {
    path: 'mnemonic',
    loadComponent: () => import('./puzzles/mnemonic/mnemonic.page').then((m) => m.MnemonicPage),
  },
  {
    path: 'dice',
    loadComponent: () => import('./puzzles/dice/dice.page').then((m) => m.DicePage),
  },
  {
    path: 'nim',
    loadComponent: () => import('./puzzles/games/nim/nim.page').then((m) => m.NimPage),
  },
  {
    path: 'mastermind',
    loadComponent: () =>
      import('./puzzles/games/mastermind/mastermind.page').then((m) => m.MastermindPage),
  },
  {
    path: 'zebra',
    loadComponent: () => import('./puzzles/zebra/zebra.page').then((m) => m.ZebraPage),
  },
  {
    path: 'tic-tac-toe',
    loadComponent: () =>
      import('./puzzles/games/tic-tac-toe/tic-tac-toe.page').then((m) => m.TicTacToePage),
  },
  {
    path: 'rush-hour',
    loadComponent: () =>
      import('./puzzles/games/rush-hour/rush-hour.page').then((m) => m.RushHourPage),
  },
  {
    path: 'timing-drop',
    loadComponent: () =>
      import('./puzzles/games/timing-drop/timing-drop.page').then((m) => m.TimingDropPage),
  },
  {
    path: 'describe-symbols',
    loadComponent: () =>
      import('./puzzles/games/describe-symbols/describe-symbols.page').then(
        (m) => m.DescribeSymbolsPage,
      ),
  },
  {
    path: 'puzzlehunt/navigation',
    loadComponent: () =>
      import('./puzzles/puzzlehunt/Navigation/navigation.page').then((m) => m.NavigationPuzzlePage),
  },
  {
    path: 'puzzlehunt/clock-letters',
    loadComponent: () =>
      import('./puzzles/puzzlehunt/ClockLetters/clock-letters.page').then(
        (m) => m.ClockLettersPuzzlePage,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
