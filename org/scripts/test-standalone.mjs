import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// No web server: test the same file:// URL users open with a double click.
const browser = process.env.BROWSER_CDP_URL
  ? await chromium.connectOverCDP(process.env.BROWSER_CDP_URL)
  : await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await context.setOffline(true);
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await page.getByTestId('diagram').waitFor();
  await page.getByRole('status').filter({ hasText: 'Uloženo v prohlížeči' }).waitFor();
  await page.getByRole('button', { name: 'Správa variant' }).click();
  await page.getByRole('menuitem', { name: 'Duplikovat variantu' }).click();
  await page.getByLabel('Název varianty').fill('Offline kontrola');
  await page.getByRole('dialog').getByRole('button', { name: 'Vytvořit kopii', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Uloženo v prohlížeči' }).waitFor();
  await page.reload();
  await page.getByTestId('diagram').waitFor();
  assert.equal(await page.getByLabel('Organizační varianta').inputValue(), 'Offline kontrola');
  await page.getByLabel('Hledat zaměstnance').fill('martin dvorak');
  await page.getByTestId('result-p003').click();
  await page.getByRole('switch', { name: 'Režim editace' }).check();
  await page.getByLabel('E-mail', { exact: true }).fill('martin@example.com');
  await page.getByLabel('E-mail', { exact: true }).press('Enter');
  await page.getByLabel('Telefon', { exact: true }).fill('+420 123 456 789');
  await page.getByLabel('Telefon', { exact: true }).press('Enter');
  await page.getByLabel('Zaměstnavatel', { exact: true }).fill('Moje firma s.r.o.');
  await page.getByLabel('Zaměstnavatel', { exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Nastavení zobrazení' }).click();
  await page.getByRole('checkbox', { name: 'Zobrazit kontaktní informace' }).check();
  await page.keyboard.press('Escape');
  const vcfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportovat kontakt Martin Dvořák', exact: true }).click();
  const vcf = await readFile(await (await vcfDownload).path(), 'utf8');
  assert.ok(vcf.includes('martin@example.com'));
  assert.ok(vcf.includes('+420 123 456 789'));
  assert.ok(vcf.includes('Moje firma s.r.o.'));
  assert.ok(vcf.includes('EMAIL;TYPE=WORK:martin@example.com'));
  assert.ok(vcf.includes('BEGIN:VCARD'));
  await page.getByRole('button', { name: 'Nastavení zobrazení' }).click();
  await page.getByRole('checkbox', { name: 'Zobrazit kontaktní informace' }).uncheck();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: /Exportovat kontakt/ }).count(), 0);
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Stáhnout JSON' }).click();
  const jsonDownload = await downloadPromise;
  assert.equal(await jsonDownload.failure(), null);
  const json = JSON.parse(await readFile(await jsonDownload.path(), 'utf8'));
  assert.equal(json.people.find(person => person.id === 'p003').email, 'martin@example.com');
  assert.equal(json.people.find(person => person.id === 'p003').phone, '+420 123 456 789');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Správa variant' }).click();
  await page.getByRole('menuitem', { name: 'Vymazat všechna data', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Potvrzuji vymazání všech dat' }).check();
  await page.getByRole('dialog').getByRole('button', { name: 'Vymazat všechna data', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Uloženo v prohlížeči' }).waitFor();
  await page.reload();
  await page.getByTestId('diagram').waitFor();
  assert.equal(await page.getByLabel('Organizační varianta').inputValue(), 'Moje organizace');
  assert.equal(await page.getByTestId(/^result-/).count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  console.log('PASS: file:// offline start, editing, IndexedDB reload, search, contact visibility, VCF and JSON export; no HTTP requests or page errors.');
  await context.close();
} finally {
  await browser.close();
}
