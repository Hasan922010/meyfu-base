import { beforeEach, describe, expect, it } from 'vitest';

import { clearReceiveDraft, loadReceiveDraft, saveReceiveDraft } from './receiveDraft';

const DRAFT = {
  supplier: 's1',
  warehouse: 'w1',
  invoice: 'UX-0924',
  rows: [{ product: 'p1', name: 'Kir sovuni 200g', unit: 'dona', quantity: '10', price: '3500' }],
};

beforeEach(() => localStorage.clear());

describe('receiveDraft (audit K6)', () => {
  it('saqlangan qabul qoralamasini qaytaradi', () => {
    saveReceiveDraft(DRAFT);

    expect(loadReceiveDraft()).toEqual(DRAFT);
  });

  it('bo‘sh forma saqlanmaydi, tozalangach qoralama yo‘q', () => {
    saveReceiveDraft({ supplier: '', warehouse: '', invoice: '', rows: [] });
    expect(loadReceiveDraft()).toBeNull();

    saveReceiveDraft(DRAFT);
    clearReceiveDraft();
    expect(loadReceiveDraft()).toBeNull();
  });

  it('buzilgan yozuvda null qaytaradi, xato tashlamaydi', () => {
    localStorage.setItem('meyfu:receive-draft', '{buzuq');

    expect(loadReceiveDraft()).toBeNull();
  });
});
