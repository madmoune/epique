import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RecentRandomPicker } from '../shared/recent-random-picker';
import { CryptogramPuzzle } from './cryptogram.model';

@Injectable({
  providedIn: 'root',
})
export class CryptogramService {
  private readonly http = inject(HttpClient);
  private readonly randomSentences = new RecentRandomPicker<string>(60);

  private sentences: string[] = [];

  async loadSentences(): Promise<void> {
    if (this.sentences.length > 0) {
      return;
    }

    const text = await firstValueFrom(
      this.http.get('mid-sentences.txt', {
        responseType: 'text',
      }),
    );

    const sentences = text
      .split(/\r?\n/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    if (sentences.length === 0) {
      throw new Error('The cryptogram sentence list is empty.');
    }

    this.sentences = sentences;
  }

  getRandomPuzzle(): CryptogramPuzzle {
    if (this.sentences.length === 0) {
      throw new Error('Cryptogram sentences have not been loaded yet.');
    }

    const answer = this.normalizeSentence(this.getRandomSentence());
    const cipher = this.createCipher();

    return {
      answer,
      encrypted: this.encryptSentence(answer, cipher),
    };
  }

  private getRandomSentence(): string {
    return this.randomSentences.pick(this.sentences, (sentence) =>
      this.normalizeSentence(sentence),
    );
  }

  private encryptSentence(sentence: string, cipher: Record<string, string>): string {
    return sentence
      .split('')
      .map((character) => {
        const upperCharacter = character.toUpperCase();

        if (!this.isLetter(upperCharacter)) {
          return character;
        }

        return cipher[upperCharacter];
      })
      .join('');
  }

  private createCipher(): Record<string, string> {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    let shuffled = this.shuffle([...alphabet]);

    while (shuffled.some((letter, index) => letter === alphabet[index])) {
      shuffled = this.shuffle([...alphabet]);
    }

    return Object.fromEntries(alphabet.map((letter, index) => [letter, shuffled[index]]));
  }

  private shuffle<T>(items: T[]): T[] {
    for (let index = items.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }

    return items;
  }

  private isLetter(character: string): boolean {
    return /^[A-Z]$/.test(character);
  }

  private normalizeSentence(sentence: string): string {
    return sentence
      // The ligature is not decomposed by Unicode normalization, so expand it
      // before splitting the sentence into individual cryptogram characters.
      .replace(/[Œœ]/g, 'OE')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toUpperCase();
  }
}
