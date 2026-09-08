import { PuzzleType } from '../lab.model';

export class ImageOnlyPuzzleType extends PuzzleType {
  constructor() {
    super({
      id: 'image-only-symbols',
      name: 'Énigme de symboles codés',
      state: 'pending',
      description: '',
      answerFormat: 'Mot ou expression à trouver.',
      clueFormat: 'Une image unique, sans exemple.',
      playRoute: '/play/image-only-symbols',
      createdAt: '2026-09-08',
      updatedAt: '2026-09-08',
      variants: [
        {
          id: 'image-only-symbols-main',
          name: 'Image unique',
          state: 'pending',
          description: '',
          examples: [],
          exampleCount: 0,
        },
      ],
    });
  }
}
