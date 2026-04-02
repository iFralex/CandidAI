import type { Page } from 'puppeteer-core';

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.type(selector, text, { delay: 30 });
}
