import { describe, expect, it } from 'vitest';
import { joinNames, readyEpochsText, soonEpochsText } from '../../src/lib/ready-epochs';

const A = 'Авис';
const B = 'Помбал';
const C = 'Эштаду Нову';

describe('ready epochs, Russian', () => {
  it('one, two, three, five and none, with the right forms of "эпоха"', () => {
    expect(readyEpochsText('ru', [A])).toBe('Готова одна эпоха: «Авис»');
    expect(readyEpochsText('ru', [A, B])).toBe('Готовы две эпохи: «Авис» и «Помбал»');
    expect(readyEpochsText('ru', [A, B, C])).toBe('Готовы три эпохи: «Авис», «Помбал» и «Эштаду Нову»');
    expect(readyEpochsText('ru', [A, B, C, 'D', 'E'])).toBe('Готовы пять эпох: «Авис», «Помбал», «Эштаду Нову», «D» и «E»');
    expect(readyEpochsText('ru', [])).toBe('Готовых эпох пока нет');
  });
  it('from ten the digits, and 21 takes the form of one', () => {
    const many = Array.from({ length: 11 }, (_, i) => `E${i}`);
    expect(readyEpochsText('ru', many)).toMatch(/^Готовы 11 эпох: /);
    expect(soonEpochsText('ru', 6)).toBe('Шесть эпох, от римской Лузитании до наших дней, в работе.');
    expect(soonEpochsText('ru', 2)).toBe('Две эпохи, от римской Лузитании до наших дней, в работе.');
    expect(soonEpochsText('ru', 1)).toBe('Одна эпоха, от римской Лузитании до наших дней, в работе.');
    expect(soonEpochsText('ru', 21)).toMatch(/^21 эпоха, /);
    expect(soonEpochsText('ru', 0)).toBe('');
  });
});

describe('ready epochs, Portuguese and English', () => {
  it('pt: uma, duas, três', () => {
    expect(readyEpochsText('pt', [A])).toBe('Está pronta uma época: «Авис»');
    expect(readyEpochsText('pt', [A, B])).toBe('Estão prontas duas épocas: «Авис» e «Помбал»');
    expect(readyEpochsText('pt', [A, B, C])).toBe('Estão prontas três épocas: «Авис», «Помбал» e «Эштаду Нову»');
    expect(soonEpochsText('pt', 1)).toBe('Outra época, da Lusitânia romana aos nossos dias, está a caminho.');
    expect(soonEpochsText('pt', 7)).toBe('Outras sete épocas, da Lusitânia romana aos nossos dias, estão a caminho.');
  });
  it('en: One era is ready, Two eras are ready', () => {
    expect(readyEpochsText('en', [A])).toBe('One era is ready: “Авис”');
    expect(readyEpochsText('en', [A, B])).toBe('Two eras are ready: “Авис” and “Помбал”');
    expect(readyEpochsText('en', [A, B, C])).toBe('Three eras are ready: “Авис”, “Помбал” and “Эштаду Нову”');
    expect(soonEpochsText('en', 1)).toBe('One more era, from Roman Lusitania to the present day, is in the works.');
    expect(soonEpochsText('en', 7)).toBe('Seven more eras, from Roman Lusitania to the present day, are in the works.');
  });
  it('joinNames with one name has no "and"', () => {
    expect(joinNames('en', [A])).toBe('“Авис”');
  });
});
