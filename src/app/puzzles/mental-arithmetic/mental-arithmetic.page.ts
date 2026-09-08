import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import katex from 'katex';
import {
  CustomKeyboardComponent,
  CustomKeyboardKey,
} from '../shared/custom-keyboard/custom-keyboard.component';
import { PuzzleSuccessPopupComponent } from '../shared/puzzle-success-popup/puzzle-success-popup.component';
import {
  ArithmeticExpressionPart,
  arithmeticExpressionToInteractiveLatex,
} from './mental-arithmetic-expression';
import { ArithmeticProblem, createArithmeticProblem } from './mental-arithmetic-problem';

@Component({
  selector: 'app-mental-arithmetic-page',
  imports: [RouterLink, PuzzleSuccessPopupComponent, CustomKeyboardComponent],
  templateUrl: './mental-arithmetic.page.html',
  styleUrl: './mental-arithmetic.page.scss',
})
export class MentalArithmeticPage {
  @ViewChild('answerField')
  private readonly answerField?: ElementRef<HTMLInputElement>;

  private readonly sanitizer = inject(DomSanitizer);

  protected readonly problem = signal<ArithmeticProblem>(this.createProblem());
  protected readonly answer = signal('');
  protected readonly isSolved = signal(false);
  protected readonly keyboardVisible = signal(false);
  protected readonly hintLevel = signal(0);
  protected readonly viewportWidth = signal(
    typeof window === 'undefined' ? 820 : window.innerWidth,
  );
  protected readonly numberKeyboardRows: CustomKeyboardKey[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['-', '0', 'backspace'],
  ];

  protected readonly isCorrect = computed(
    () => this.answer().trim().length > 0 && Number(this.answer()) === this.problem().answer,
  );
  protected readonly interactiveExpression = computed(() =>
    arithmeticExpressionToInteractiveLatex(this.problem().expression),
  );
  protected readonly displayExpression = computed<SafeHtml>(() =>
    this.renderExpression(this.interactiveExpression().latex),
  );
  protected readonly selectedSubresult = signal<ArithmeticExpressionPart | null>(null);
  protected readonly answerHint = computed(() => {
    if (this.hintLevel() === 0) {
      return '';
    }

    const answer = String(this.problem().answer);
    const revealedLength = Math.min(this.hintLevel(), answer.length);

    return answer
      .split('')
      .map((character, index) => (index < revealedLength ? character : '_'))
      .join(' ');
  });
  protected readonly maxHintLevel = computed(() => String(this.problem().answer).length);
  protected readonly equationSize = computed(() => {
    const width = this.viewportWidth();
    const compact = width <= 600;
    const availableWidth = compact ? Math.max(240, width - 52) : Math.min(760, width - 96);
    const weight = this.measureExpressionWeight(this.problem().expression);
    const estimatedCharacterWidth = compact ? 0.6 : 0.56;
    const minimumSize = compact ? 1.05 : 1.5;
    const maximumSize = compact ? 1.55 : 3.1;
    const size = Math.max(
      minimumSize,
      Math.min(maximumSize, availableWidth / (weight * estimatedCharacterWidth * 16)),
    );
    return `${size}rem`;
  });

  protected updateAnswer(value: string): void {
    if (this.isSolved()) {
      return;
    }

    this.answer.set(value.replace(/[^\d-]/g, '').slice(0, 8));
    if (this.isCorrect()) {
      this.isSolved.set(true);
    }
  }

  protected handleKeyboardKey(key: CustomKeyboardKey): void {
    if (this.isSolved()) {
      return;
    }

    if (key === 'backspace') {
      this.updateAnswer(this.answer().slice(0, -1));
      this.focusAnswerField();
      return;
    }

    if (key === 'clear' || key === 'space') {
      return;
    }

    if (key === '-') {
      this.updateAnswer(
        this.answer().startsWith('-') ? this.answer().slice(1) : `-${this.answer()}`,
      );
      this.focusAnswerField();
      return;
    }

    this.updateAnswer(`${this.answer()}${key}`);
    this.focusAnswerField();
  }

  protected showKeyboard(): void {
    if (this.isSolved()) {
      return;
    }

    this.keyboardVisible.set(true);
    window.setTimeout(() => this.answerField?.nativeElement.select());
  }

  protected showHint(): void {
    if (this.isSolved()) {
      return;
    }

    this.hintLevel.update((level) => Math.min(level + 1, this.maxHintLevel()));
  }

  protected nextProblem(): void {
    this.problem.set(this.createProblem());
    this.answer.set('');
    this.isSolved.set(false);
    this.hintLevel.set(0);
    this.selectedSubresult.set(null);
    this.focusAnswerField();
  }

  protected showSubresult(event: MouseEvent): void {
    const part = this.subresultForTarget(event.target);

    if (part) {
      this.selectedSubresult.set(part);
    }
  }

  protected showSubresultWithKeyboard(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    const part = this.subresultForTarget(event.target);

    if (part) {
      this.selectedSubresult.set(part);
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  protected hideKeyboardWhenClickingAway(event: PointerEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (
      target.closest('.answer-input') ||
      target.closest('button') ||
      target.closest('app-custom-keyboard') ||
      target.closest('app-puzzle-success-popup')
    ) {
      return;
    }

    this.keyboardVisible.set(false);
  }

  @HostListener('window:resize')
  protected updateViewportWidth(): void {
    this.viewportWidth.set(window.innerWidth);
  }

  private createProblem(): ArithmeticProblem {
    return createArithmeticProblem();
  }

  private measureExpressionWeight(expression: string): number {
    return expression.replace(/sqrt\((\d+)\)/g, '√$1').replace(/\^([2-9])/g, '$1').length;
  }

  private focusAnswerField(): void {
    window.setTimeout(() => this.answerField?.nativeElement.focus());
  }

  private renderExpression(latex: string): SafeHtml {
    const rendered = katex.renderToString(latex, {
      displayMode: true,
      output: 'htmlAndMathml',
      strict: false,
      trust: true,
      throwOnError: true,
    });
    const accessibleRendered = rendered.replace(
      /(<span\b[^>]*data-part-id="\d+"[^>]*)>/g,
      '$1 role="button" tabindex="0" aria-label="Afficher le sous-résultat">',
    );

    return this.sanitizer.bypassSecurityTrustHtml(accessibleRendered);
  }

  private subresultForTarget(target: EventTarget | null): ArithmeticExpressionPart | null {
    if (!(target instanceof Element)) {
      return null;
    }

    const partElement = target.closest<HTMLElement>('[data-part-id]');
    const partId = Number(partElement?.dataset['partId']);

    if (!partElement || !Number.isInteger(partId)) {
      return null;
    }

    return this.interactiveExpression().parts.find((part) => part.id === partId) ?? null;
  }
}
