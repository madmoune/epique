export type ApprovalState = 'approved' | 'pending' | 'deleted';

export type PuzzleExampleInput = {
  id: string;
  name: string;
  description: string;
};

export type PuzzlePartialAnswer = {
  answer: string;
  message: string;
};

type PuzzleVariantInput = {
  id: string;
  name: string;
  state: ApprovalState;
  description: string;
  examples: PuzzleExampleInput[];
  exampleCount?: number;
  partialAnswers?: PuzzlePartialAnswer[];
};

type PuzzleTypeInput = {
  id: string;
  name: string;
  state: ApprovalState;
  description: string;
  answerFormat: string;
  clueFormat: string;
  playRoute: string;
  variants: PuzzleVariantInput[];
  createdAt: string;
  updatedAt: string;
};

export class PuzzleExample {
  readonly id: string;
  readonly name: string;
  readonly description: string;

  constructor(input: PuzzleExampleInput) {
    this.id = input.id;
    this.name = input.name;
    this.description = input.description;
  }
}

export class PuzzleVariant {
  readonly id: string;
  readonly name: string;
  readonly state: ApprovalState;
  readonly description: string;
  readonly examples: PuzzleExample[];
  readonly exampleCount: number;
  readonly partialAnswers: PuzzlePartialAnswer[];

  constructor(input: PuzzleVariantInput) {
    this.id = input.id;
    this.name = input.name;
    this.state = input.state;
    this.description = input.description;
    this.examples = input.examples.map((example) => new PuzzleExample(example));
    const exampleCount = input.exampleCount ?? input.examples.length;
    if (
      !Number.isInteger(exampleCount) ||
      exampleCount < 0 ||
      exampleCount > input.examples.length
    ) {
      throw new Error(`Le nombre d'exemples de la variante est invalide.`);
    }
    this.exampleCount = exampleCount;
    this.partialAnswers = input.partialAnswers ?? [];
  }
}

export class PuzzleType {
  readonly id: string;
  readonly name: string;
  readonly state: ApprovalState;
  readonly description: string;
  readonly answerFormat: string;
  readonly clueFormat: string;
  readonly playRoute: string;
  readonly variants: PuzzleVariant[];
  readonly createdAt: string;
  readonly updatedAt: string;

  constructor(input: PuzzleTypeInput) {
    this.id = input.id;
    this.name = input.name;
    this.state = input.state;
    this.description = input.description;
    this.answerFormat = input.answerFormat;
    this.clueFormat = input.clueFormat;
    this.playRoute = input.playRoute;
    this.variants = input.variants.map((variant) => new PuzzleVariant(variant));
    this.createdAt = input.createdAt;
    this.updatedAt = input.updatedAt;
  }
}
