import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { CryptogramService } from './cryptogram.service';

describe('CryptogramService', () => {
  it('expands the œ ligature into two standard cryptogram letters', () => {
    const service = Object.create(CryptogramService.prototype) as any;

    expect(service.normalizeSentence('nœud')).toBe('NOEUD');
    expect(service.normalizeSentence('NŒUD')).toBe('NOEUD');
  });
});
