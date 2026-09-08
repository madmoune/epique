import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { ColorRodsPage } from './color-rods.page';

describe('ColorRodsPage', () => {
  it('keeps a clicked reserve rod selected until a slot is chosen', () => {
    const page = new ColorRodsPage() as any;
    const [firstRod, secondRod] = page.availableRods();

    page.selectRod(firstRod.id);

    expect(page.placements()).toEqual([null, null, null, null, null, null]);
    expect(page.selectedTrayRodId()).toBe(firstRod.id);

    page.handleSlotClick(0);
    page.selectRod(secondRod.id);

    expect(page.placements()).toEqual([firstRod.id, null, null, null, null, null]);
    expect(page.selectedTrayRodId()).toBe(secondRod.id);
  });

  it('selects and interchanges rods already placed', () => {
    const page = new ColorRodsPage() as any;
    const [firstRod, secondRod] = page.availableRods();

    page.selectRod(firstRod.id);
    page.handleSlotClick(0);
    page.selectRod(secondRod.id);
    page.handleSlotClick(1);
    page.handleSlotClick(0);
    page.handleSlotClick(1);

    expect(page.placements()).toEqual([secondRod.id, firstRod.id, null, null, null, null]);
  });

  it('supports dragging a rod to a slot and back to the reserve', () => {
    const page = new ColorRodsPage() as any;
    const rod = page.availableRods()[0];
    const dragStartEvent = dragEvent();

    page.startDraggingFromTray(rod.id, dragStartEvent);
    page.dropOnSlot(3, dragStartEvent);

    expect(page.placements()[3]).toBe(rod.id);

    const slotDragStartEvent = dragEvent();
    page.startDraggingFromSlot(3, slotDragStartEvent);
    page.dropOnTray(slotDragStartEvent);

    expect(page.placements()[3]).toBeNull();
  });

  it('returns a selected piece to the reserve when clicking outside', () => {
    const page = new ColorRodsPage() as any;
    const rod = page.availableRods()[0];

    page.selectRod(rod.id);
    page.handleSlotClick(0);
    page.handleSlotClick(0);
    page.handleDocumentClick({ target: null });

    expect(page.selectedRod()).toBeNull();
    expect(page.placements()[0]).toBeNull();
    expect(
      page.availableRods().some((availableRod: { id: string }) => availableRod.id === rod.id),
    ).toBe(true);
  });
});

function dragEvent(): any {
  const values = new Map<string, string>();

  return {
    preventDefault: () => undefined,
    dataTransfer: {
      effectAllowed: 'none',
      dropEffect: 'none',
      setData: (type: string, value: string) => values.set(type, value),
      getData: (type: string) => values.get(type) ?? '',
    },
  };
}
