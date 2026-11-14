import { describe, expect, it } from '@jest/globals';

import { addEditRow, editChanged, editList, editProblem, editRowsFrom, gramsInput, patchEditRow, removeEditRow } from '../food-result-edit';
import { editRowLayout, ingredientRowLayout, RESULT } from '../food-result-layout';

const base = [
  { name: 'Rava', grams: 60 },
  { name: 'Oil (fried)', grams: 10 },
];

describe('the ingredient rows while editing', () => {
  it('start as the ingredients, with grams as text', () => {
    expect(editRowsFrom(base)).toEqual([
      { key: 'r0', name: 'Rava', grams: '60', added: false },
      { key: 'r1', name: 'Oil (fried)', grams: '10', added: false },
    ]);
  });
  it('add a new row with a key no other row has, even after a removal', () => {
    const rows = removeEditRow(editRowsFrom(base), 'r0');
    const next = addEditRow(rows);
    expect(next.map((r) => r.key)).toEqual(['r1', 'r2']);
    expect(next[1]).toMatchObject({ name: '', grams: '', added: true });
  });
  it('change one row by key', () => {
    const rows = patchEditRow(editRowsFrom(base), 'r1', { grams: '25' });
    expect(rows.map((r) => r.grams)).toEqual(['60', '25']);
  });
  it('keep only digits, at most 4, in the grams field', () => {
    expect(gramsInput('12a.5')).toBe('125');
    expect(gramsInput('123456')).toBe('1234');
  });
  it('make the list to send, with a missing amount as NaN', () => {
    const list = editList([...editRowsFrom(base), ...addEditRow([])]);
    expect(list.slice(0, 2)).toEqual(base);
    expect(Number.isNaN(list[2].grams)).toBe(true);
  });
  it('say what is wrong, or nothing', () => {
    const rows = editRowsFrom(base);
    expect(editProblem(rows)).toBeNull();
    expect(editProblem(patchEditRow(rows, 'r0', { grams: '0' }))).toMatch(/whole grams/);
    expect(editProblem(patchEditRow(rows, 'r0', { grams: '' }))).toMatch(/whole grams/);
    expect(editProblem(patchEditRow(rows, 'r0', { grams: '2001' }))).toMatch(/whole grams/);
    expect(editProblem(addEditRow(rows))).toMatch(/needs a name/);
    expect(editProblem([])).toMatch(/at least one/);
  });
  it('know when nothing changed', () => {
    const rows = editRowsFrom(base);
    expect(editChanged(rows, base)).toBe(false);
    expect(editChanged(patchEditRow(rows, 'r0', { grams: '61' }), base)).toBe(true);
    expect(editChanged(removeEditRow(rows, 'r1'), base)).toBe(true);
  });
});

describe('an edited row', () => {
  it('leaves the name less room than a plain row: field 72 and remove 48 beside it', () => {
    const plain = ingredientRowLayout('Rava', '60 g', 312);
    const edit = editRowLayout('Rava', 312);
    expect(edit.nameWidth).toBe(312 - RESULT.circle - 2 * RESULT.ingredientGap - RESULT.gramsFieldWidth - RESULT.removeTouch);
    expect(edit.nameWidth).toBeLessThan(plain.nameWidth);
  });
  it('is 48 high, and grows for a long name or large text', () => {
    expect(editRowLayout('Rava', 312).minHeight).toBe(RESULT.ingredientRowHeight);
    expect(editRowLayout('Dried anchovy cooked in coconut and tamarind sauce', 312).lines).toBe(2);
    expect(editRowLayout('Dried anchovy cooked in coconut and tamarind sauce', 312, 1.5).minHeight).toBeGreaterThan(48);
  });
});
