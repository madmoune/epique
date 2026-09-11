import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PuzzleSuccessPopupComponent } from '../shared/puzzle-success-popup/puzzle-success-popup.component';

type PuzzleMode = 'numbers' | 'image';

@Component({
  selector: 'app-sliding-puzzle-page',
  imports: [RouterLink, PuzzleSuccessPopupComponent],
  templateUrl: './sliding-puzzle.page.html',
  styleUrl: './sliding-puzzle.page.scss',
})
export class SlidingPuzzlePage {
  private readonly size = 4;
  private readonly solvedBoard = Array.from({ length: 16 }, (_, index) => (index + 1) % 16);

  protected readonly mode = signal<PuzzleMode>('numbers');
  protected readonly board = signal<number[]>([...this.solvedBoard]);
  protected readonly moves = signal(0);
  protected readonly hasStarted = signal(false);
  protected readonly imageUrl = signal('');
  protected readonly tileImageUrls = signal<string[]>([]);
  protected readonly showImageTileNumbers = signal(false);
  private readonly imageTileSignatures = signal<string[]>([]);
  private imageSignatureRequest = 0;
  protected readonly isSolved = computed(
    () => {
      if (!this.hasStarted()) return false;
      if (this.mode() === 'image') return this.imageBoardMatchesSolution();
      return this.board().every((tile, index) => tile === this.solvedBoard[index]);
    },
  );

  constructor() {
    this.newPuzzle();
  }

  protected setMode(mode: PuzzleMode): void {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    this.newPuzzle();
  }

  protected setShowImageTileNumbers(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.showImageTileNumbers.set(event.target.checked);
    }
  }

  protected newPuzzle(): void {
    if (this.mode() === 'image') {
      const artwork = this.createRandomArtwork();
      this.imageUrl.set(artwork.fullImage);
      this.tileImageUrls.set(artwork.tileImages);
      this.refreshImageTileSignatures(artwork.tileImages);
    } else {
      this.imageSignatureRequest += 1;
      this.imageTileSignatures.set([]);
    }

    const board = [...this.solvedBoard];
    let emptyIndex = board.indexOf(0);
    let previousEmptyIndex = -1;

    // A legal-move shuffle guarantees a solvable puzzle. Thirty-two moves keep it approachable.
    for (let step = 0; step < 32; step++) {
      let choices = this.neighbors(emptyIndex).filter((index) => index !== previousEmptyIndex);
      if (!choices.length) choices = this.neighbors(emptyIndex);
      const tileIndex = choices[Math.floor(Math.random() * choices.length)];
      [board[emptyIndex], board[tileIndex]] = [board[tileIndex], board[emptyIndex]];
      previousEmptyIndex = emptyIndex;
      emptyIndex = tileIndex;
    }

    if (board.every((tile, index) => tile === this.solvedBoard[index])) {
      const tileIndex = this.neighbors(emptyIndex)[0];
      [board[emptyIndex], board[tileIndex]] = [board[tileIndex], board[emptyIndex]];
    }

    this.board.set(board);
    this.moves.set(0);
    this.hasStarted.set(true);
  }

  protected moveTile(index: number): void {
    if (this.isSolved()) return;
    const board = [...this.board()];
    const emptyIndex = board.indexOf(0);
    const sameRow = Math.floor(index / this.size) === Math.floor(emptyIndex / this.size);
    const sameColumn = index % this.size === emptyIndex % this.size;
    if (!sameRow && !sameColumn) return;

    const direction = sameRow
      ? Math.sign(index - emptyIndex)
      : Math.sign(index - emptyIndex) * this.size;
    for (let position = emptyIndex; position !== index; position += direction) {
      board[position] = board[position + direction];
    }
    board[index] = 0;
    this.board.set(board);
    this.moves.update((value) => value + 1);
  }

  protected tileImageUrl(tile: number): string {
    return this.tileImageUrls()[tile - 1] ?? '';
  }

  protected tileLabel(tile: number): string {
    if (this.mode() === 'numbers') return String(tile);
    return this.showImageTileNumbers()
      ? `Morceau d’image ${tile}, numéro ${tile}`
      : `Morceau d’image ${tile}`;
  }

  private neighbors(index: number): number[] {
    const row = Math.floor(index / this.size);
    const column = index % this.size;
    const result: number[] = [];
    if (row > 0) result.push(index - this.size);
    if (row < this.size - 1) result.push(index + this.size);
    if (column > 0) result.push(index - 1);
    if (column < this.size - 1) result.push(index + 1);
    return result;
  }

  private imageBoardMatchesSolution(): boolean {
    const signatures = this.imageTileSignatures();
    if (signatures.length !== this.solvedBoard.length - 1) return false;

    return this.board().every((tile, index) => {
      if (index === this.solvedBoard.length - 1) return tile === 0;
      return tile > 0 && signatures[tile - 1] === signatures[index];
    });
  }

  private refreshImageTileSignatures(tileImages: string[]): void {
    const request = ++this.imageSignatureRequest;
    this.imageTileSignatures.set([]);

    void Promise.all(tileImages.map((tileImage) => this.createImageTileSignature(tileImage)))
      .then((signatures) => {
        if (request === this.imageSignatureRequest) {
          this.imageTileSignatures.set(signatures);
        }
      })
      .catch(() => {
        if (request === this.imageSignatureRequest) {
          this.imageTileSignatures.set([]);
        }
      });
  }

  private createImageTileSignature(tileImage: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof Image === 'undefined' || typeof document === 'undefined') {
        reject(new Error('Le navigateur ne permet pas de lire les morceaux image.'));
        return;
      }

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
          reject(new Error('Impossible de créer la signature du morceau image.'));
          return;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data).join(','));
      };
      image.onerror = () => reject(new Error('Impossible de charger un morceau image.'));
      image.src = tileImage;
    });
  }

  private createRandomArtwork(): { fullImage: string; tileImages: string[] } {
    const content = this.createArtworkContent();
    const svgUrl = (viewBox: string) =>
      `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${content}</svg>`)}`;

    return {
      fullImage: svgUrl('0 0 400 400'),
      tileImages: Array.from({ length: 15 }, (_, index) => {
        const column = index % this.size;
        const row = Math.floor(index / this.size);
        return svgUrl(`${column * 100} ${row * 100} 100 100`);
      }),
    };
  }

  private createArtworkContent(): string {
    const palettes = [
      ['#17324d', '#42a5b3', '#f4d35e', '#ee964b', '#f95738'],
      ['#201923', '#9046cf', '#17bebb', '#ffc857', '#ff5e5b'],
      ['#102820', '#4c956c', '#fefee3', '#ffc9b9', '#d68c45'],
      ['#071013', '#23b5d3', '#75abbc', '#f7f7ff', '#ea526f'],
      ['#2d1e2f', '#6c9a8b', '#e8d7f1', '#f4a261', '#e76f51'],
      ['#0b132b', '#1c2541', '#3a506b', '#5bc0be', '#fde74c'],
    ];
    const palette = palettes[this.randomInt(0, palettes.length - 1)];
    const theme = this.randomInt(0, 7);

    if (theme === 0) return this.createLandscapeArtwork(palette);
    if (theme === 1) return this.createOrbitalArtwork(palette);
    if (theme === 2) return this.createRocketArtwork(palette);
    if (theme === 3) return this.createSatelliteArtwork(palette);
    if (theme === 4) return this.createHouseArtwork(palette);
    if (theme === 5) return this.createHotAirBalloonArtwork(palette);
    if (theme === 6) return this.createFlowerArtwork(palette);
    return this.createRobotArtwork(palette);
  }

  private createLandscapeArtwork(palette: string[]): string {
    const sunX = this.randomInt(55, 340);
    const sunY = this.randomInt(42, 130);
    const mountainApex = this.randomInt(95, 305);
    const riverX = this.randomInt(120, 270);
    const trees = Array.from({ length: this.randomInt(8, 15) }, () => {
      const x = this.randomInt(15, 385);
      const y = this.randomInt(245, 350);
      const size = this.randomInt(16, 34);
      return `<path d="M${x} ${y - size} L${x - size * 0.55} ${y} H${x + size * 0.55}Z" fill="${palette[1]}" opacity=".85"/><rect x="${x - 3}" y="${y - 2}" width="6" height="18" fill="${palette[0]}" opacity=".7"/>`;
    }).join('');

    return `<defs><linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette[2]}"/><stop offset=".55" stop-color="${palette[3]}"/><stop offset="1" stop-color="${palette[0]}"/></linearGradient></defs><rect width="400" height="400" fill="url(#sky)"/><circle cx="${sunX}" cy="${sunY}" r="${this.randomInt(28, 52)}" fill="${palette[4]}" opacity=".9"/><path d="M-20 252 L${mountainApex} 80 L430 265 V430 H-20Z" fill="${palette[0]}" opacity=".82"/><path d="M-10 285 L${this.randomInt(70, 150)} 145 L${this.randomInt(210, 330)} 295 L430 185 V430 H-10Z" fill="${palette[1]}" opacity=".7"/><path d="M${riverX} 235 C${riverX - 70} 285 ${riverX + 80} 310 ${riverX + 5} 430 L${riverX + 75} 430 C${riverX + 145} 330 ${riverX - 25} 302 ${riverX + 58} 235Z" fill="${palette[3]}" opacity=".72"/><path d="M0 332 C80 285 154 362 238 318 S346 286 400 340 V400 H0Z" fill="${palette[2]}" opacity=".5"/>${trees}`;
  }

  private createOrbitalArtwork(palette: string[]): string {
    const planetX = this.randomInt(125, 285);
    const planetY = this.randomInt(130, 270);
    const planetR = this.randomInt(54, 92);
    const stars = Array.from({ length: 34 }, () => {
      const x = this.randomInt(8, 392);
      const y = this.randomInt(8, 392);
      const r = this.randomInt(2, 5);
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${palette[this.randomInt(2, 4)]}" opacity="${this.randomInt(45, 95) / 100}"/>`;
    }).join('');
    const satellites = Array.from({ length: 5 }, (_, index) => {
      const angle = index * 72 + this.randomInt(0, 36);
      const orbit = this.randomInt(95, 165);
      const x = planetX + Math.cos((angle * Math.PI) / 180) * orbit;
      const y = planetY + Math.sin((angle * Math.PI) / 180) * orbit * 0.6;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${this.randomInt(8, 18)}" fill="${palette[index % palette.length]}"/>`;
    }).join('');

    return `<rect width="400" height="400" fill="${palette[0]}"/><path d="M0 70 C110 25 225 120 400 40 V0 H0Z" fill="${palette[1]}" opacity=".22"/><path d="M0 360 C115 295 232 390 400 315 V400 H0Z" fill="${palette[3]}" opacity=".18"/>${stars}<ellipse cx="${planetX}" cy="${planetY}" rx="${planetR + 62}" ry="${Math.round((planetR + 30) * 0.42)}" fill="none" stroke="${palette[2]}" stroke-width="10" opacity=".62" transform="rotate(-18 ${planetX} ${planetY})"/><circle cx="${planetX}" cy="${planetY}" r="${planetR}" fill="${palette[4]}"/><path d="M${planetX - planetR} ${planetY + 12} C${planetX - 24} ${planetY - 18} ${planetX + 28} ${planetY + 45} ${planetX + planetR} ${planetY - 18}" fill="none" stroke="${palette[2]}" stroke-width="14" opacity=".48"/>${satellites}`;
  }

  private createMapArtwork(palette: string[]): string {
    const blocks = Array.from({ length: 18 }, () => {
      const x = this.randomInt(-10, 350);
      const y = this.randomInt(-10, 350);
      const w = this.randomInt(34, 96);
      const h = this.randomInt(24, 82);
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${this.randomInt(4, 14)}" fill="${palette[this.randomInt(1, 4)]}" opacity="${this.randomInt(45, 82) / 100}"/>`;
    }).join('');
    const route = `M-20 ${this.randomInt(95, 305)} C${this.randomInt(55, 120)} ${this.randomInt(20, 130)} ${this.randomInt(170, 260)} ${this.randomInt(270, 370)} 420 ${this.randomInt(80, 330)}`;
    const roadY = this.randomInt(115, 285);

    return `<rect width="400" height="400" fill="${palette[0]}"/><path d="M0 ${roadY} H400" stroke="${palette[2]}" stroke-width="34" opacity=".32"/><path d="M${this.randomInt(70, 145)} -20 V420" stroke="${palette[3]}" stroke-width="28" opacity=".22"/><path d="M-20 330 L420 10" stroke="${palette[1]}" stroke-width="24" opacity=".22"/>${blocks}<path d="${route}" fill="none" stroke="${palette[4]}" stroke-width="16" stroke-linecap="round"/><path d="${route}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".75"/><circle cx="${this.randomInt(40, 100)}" cy="${this.randomInt(270, 350)}" r="26" fill="${palette[2]}"/><rect x="${this.randomInt(265, 330)}" y="${this.randomInt(35, 95)}" width="48" height="48" rx="10" fill="${palette[4]}"/>`;
  }

  private createRocketArtwork(palette: string[]): string {
    const stars = Array.from({ length: 26 }, () => {
      const x = this.randomInt(10, 390);
      const y = this.randomInt(10, 390);
      return `<circle cx="${x}" cy="${y}" r="${this.randomInt(2, 5)}" fill="${palette[this.randomInt(2, 4)]}" opacity=".8"/>`;
    }).join('');
    const rocketX = this.randomInt(150, 235);
    const rocketY = this.randomInt(90, 165);
    const planetX = this.randomInt(45, 125);
    const planetY = this.randomInt(240, 330);

    return `<rect width="400" height="400" fill="${palette[0]}"/><path d="M0 360 C105 310 215 390 400 310 V400 H0Z" fill="${palette[1]}" opacity=".22"/>${stars}<circle cx="${planetX}" cy="${planetY}" r="${this.randomInt(48, 76)}" fill="${palette[3]}"/><path d="M${planetX - 50} ${planetY + 8} C${planetX - 5} ${planetY - 20} ${planetX + 35} ${planetY + 30} ${planetX + 60} ${planetY - 16}" fill="none" stroke="${palette[2]}" stroke-width="12" opacity=".68"/><g transform="translate(${rocketX} ${rocketY}) rotate(${this.randomInt(-18, 18)} 42 95)"><path d="M42 0 C82 42 82 122 42 166 C2 122 2 42 42 0Z" fill="${palette[4]}" stroke="#fff" stroke-width="7"/><circle cx="42" cy="62" r="18" fill="${palette[1]}" stroke="#fff" stroke-width="6"/><path d="M12 108 L-24 148 L22 140Z" fill="${palette[2]}"/><path d="M72 108 L108 148 L62 140Z" fill="${palette[2]}"/><path d="M28 166 L42 224 L56 166Z" fill="${palette[3]}"/><path d="M34 180 L42 245 L50 180Z" fill="${palette[2]}" opacity=".8"/></g>`;
  }

  private createSatelliteArtwork(palette: string[]): string {
    const earthX = this.randomInt(55, 125);
    const earthY = this.randomInt(250, 335);
    const satelliteX = this.randomInt(220, 300);
    const satelliteY = this.randomInt(90, 155);
    const stars = Array.from({ length: 30 }, () => {
      const x = this.randomInt(8, 392);
      const y = this.randomInt(8, 392);
      return `<circle cx="${x}" cy="${y}" r="${this.randomInt(2, 4)}" fill="#fff" opacity="${this.randomInt(45, 88) / 100}"/>`;
    }).join('');

    return `<rect width="400" height="400" fill="${palette[0]}"/>${stars}<circle cx="${earthX}" cy="${earthY}" r="${this.randomInt(72, 100)}" fill="${palette[1]}"/><path d="M${earthX - 54} ${earthY - 16} C${earthX - 12} ${earthY - 42} ${earthX + 30} ${earthY - 8} ${earthX + 58} ${earthY - 35} C${earthX + 42} ${earthY + 14} ${earthX - 6} ${earthY + 30} ${earthX - 42} ${earthY + 58}" fill="${palette[2]}" opacity=".78"/><path d="M${earthX - 78} ${earthY - 8} C${earthX + 8} ${earthY - 65} ${earthX + 120} ${earthY - 54} ${satelliteX + 22} ${satelliteY + 20}" fill="none" stroke="${palette[3]}" stroke-width="5" stroke-dasharray="10 10" opacity=".7"/><g transform="translate(${satelliteX} ${satelliteY}) rotate(${this.randomInt(-22, 22)} 45 34)"><rect x="22" y="14" width="48" height="42" rx="8" fill="${palette[4]}" stroke="#fff" stroke-width="5"/><rect x="-46" y="5" width="60" height="58" fill="${palette[1]}" stroke="${palette[3]}" stroke-width="5"/><rect x="78" y="5" width="60" height="58" fill="${palette[1]}" stroke="${palette[3]}" stroke-width="5"/><path d="M70 36 H78 M14 36 H22 M46 56 V88" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="46" cy="94" r="8" fill="${palette[2]}"/></g>`;
  }

  private createHouseArtwork(palette: string[]): string {
    const houseX = this.randomInt(125, 185);
    const houseY = this.randomInt(155, 185);
    const sunX = this.randomInt(55, 345);
    const sunY = this.randomInt(55, 105);

    return `<rect width="400" height="400" fill="${palette[0]}"/><circle cx="${sunX}" cy="${sunY}" r="${this.randomInt(28, 44)}" fill="${palette[4]}"/><path d="M0 300 Q100 255 205 305 T400 290 V400 H0Z" fill="${palette[1]}" opacity=".72"/><rect x="${houseX - 82}" y="${houseY + 44}" width="164" height="126" rx="8" fill="${palette[3]}" stroke="#fff" stroke-width="7"/><path d="M${houseX - 104} ${houseY + 50} L${houseX} ${houseY - 38} L${houseX + 104} ${houseY + 50}Z" fill="${palette[2]}" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><rect x="${houseX - 25}" y="${houseY + 98}" width="50" height="72" rx="5" fill="${palette[0]}" stroke="#fff" stroke-width="6"/><rect x="${houseX - 65}" y="${houseY + 78}" width="34" height="34" rx="4" fill="${palette[4]}" stroke="#fff" stroke-width="5"/><rect x="${houseX + 31}" y="${houseY + 78}" width="34" height="34" rx="4" fill="${palette[4]}" stroke="#fff" stroke-width="5"/>`;
  }

  private createHotAirBalloonArtwork(palette: string[]): string {
    const balloonX = this.randomInt(135, 265);
    const balloonY = this.randomInt(95, 135);
    const balloonWidth = this.randomInt(66, 86);

    return `<rect width="400" height="400" fill="${palette[0]}"/><circle cx="70" cy="72" r="${this.randomInt(24, 38)}" fill="${palette[4]}" opacity=".92"/><path d="M0 305 Q120 265 235 310 T400 285 V400 H0Z" fill="${palette[1]}" opacity=".72"/><path d="M${balloonX} ${balloonY - 78} C${balloonX - balloonWidth} ${balloonY - 55} ${balloonX - balloonWidth} ${balloonY + 54} ${balloonX} ${balloonY + 74} C${balloonX + balloonWidth} ${balloonY + 54} ${balloonX + balloonWidth} ${balloonY - 55} ${balloonX} ${balloonY - 78}Z" fill="${palette[4]}" stroke="#fff" stroke-width="7"/><path d="M${balloonX - 13} ${balloonY - 68} V${balloonY + 63} M${balloonX + 13} ${balloonY - 68} V${balloonY + 63}" stroke="${palette[2]}" stroke-width="9" opacity=".9"/><path d="M${balloonX - 31} ${balloonY + 58} L${balloonX - 20} ${balloonY + 108} M${balloonX + 31} ${balloonY + 58} L${balloonX + 20} ${balloonY + 108}" stroke="#fff" stroke-width="6"/><rect x="${balloonX - 25}" y="${balloonY + 99}" width="50" height="33" rx="5" fill="${palette[2]}" stroke="#fff" stroke-width="6"/>`;
  }

  private createFlowerArtwork(palette: string[]): string {
    const flowerX = this.randomInt(145, 255);
    const flowerY = this.randomInt(115, 165);

    const petals = Array.from({ length: 6 }, (_, index) => {
      const angle = index * 60;
      const radians = (angle * Math.PI) / 180;
      const x = flowerX + Math.cos(radians) * 38;
      const y = flowerY + Math.sin(radians) * 38;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${this.randomInt(20, 28)}" fill="${palette[4]}" stroke="#fff" stroke-width="5"/>`;
    }).join('');

    return `<rect width="400" height="400" fill="${palette[0]}"/><circle cx="${this.randomInt(55, 345)}" cy="${this.randomInt(52, 92)}" r="${this.randomInt(28, 42)}" fill="${palette[2]}"/><path d="M0 318 Q92 275 195 320 T400 300 V400 H0Z" fill="${palette[1]}" opacity=".8"/><path d="M${flowerX} ${flowerY + 34} V335" stroke="${palette[3]}" stroke-width="12" stroke-linecap="round"/><path d="M${flowerX - 4} 270 C${flowerX - 70} 240 ${flowerX - 72} 300 ${flowerX - 24} 303 M${flowerX + 5} 290 C${flowerX + 72} 258 ${flowerX + 76} 318 ${flowerX + 26} 322" fill="${palette[1]}" stroke="#fff" stroke-width="5"/>${petals}<circle cx="${flowerX}" cy="${flowerY}" r="24" fill="${palette[2]}" stroke="#fff" stroke-width="6"/>`;
  }

  private createRobotArtwork(palette: string[]): string {
    const x = this.randomInt(118, 185);
    const y = this.randomInt(70, 125);
    const gears = Array.from({ length: 7 }, () => {
      const gx = this.randomInt(30, 370);
      const gy = this.randomInt(30, 365);
      const r = this.randomInt(14, 30);
      return `<g transform="translate(${gx} ${gy})"><circle r="${r}" fill="none" stroke="${palette[this.randomInt(2, 4)]}" stroke-width="7" opacity=".7"/><circle r="${Math.max(5, r - 14)}" fill="${palette[0]}"/></g>`;
    }).join('');

    return `<rect width="400" height="400" fill="${palette[0]}"/><path d="M0 330 H400 V400 H0Z" fill="${palette[1]}" opacity=".25"/>${gears}<g transform="translate(${x} ${y})"><rect x="25" y="35" width="130" height="105" rx="22" fill="${palette[3]}" stroke="#fff" stroke-width="8"/><rect x="45" y="165" width="92" height="115" rx="18" fill="${palette[1]}" stroke="#fff" stroke-width="8"/><circle cx="68" cy="83" r="15" fill="${palette[0]}"/><circle cx="116" cy="83" r="15" fill="${palette[0]}"/><path d="M70 115 H112" stroke="${palette[4]}" stroke-width="8" stroke-linecap="round"/><path d="M90 35 V0" stroke="#fff" stroke-width="7" stroke-linecap="round"/><circle cx="90" cy="-9" r="10" fill="${palette[4]}"/><path d="M45 185 L0 245 M137 185 L182 245 M65 280 V330 M118 280 V330" stroke="#fff" stroke-width="12" stroke-linecap="round"/></g>`;
  }

  private randomInt(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
  }
}
