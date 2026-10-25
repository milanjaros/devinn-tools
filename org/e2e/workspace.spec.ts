import { test, expect, type Page } from '@playwright/test';
test('oddělení se našeptává a odstranění zaměstnance lze vrátit',async({page})=>{
  await ready(page);await duplicate(page,'Mazání a oddělení');
  await page.getByTestId('result-p003').click();
  const department=page.getByLabel('Oddělení',{exact:true});
  const listId=await department.getAttribute('list');
  expect(listId).toBeTruthy();
  const suggestions=await page.locator('datalist').evaluateAll(lists=>lists.flatMap(list=>Array.from(list.querySelectorAll('option')).map(option=>option.value)));
  expect(suggestions.length).toBeGreaterThan(0);
  await department.fill('Nové testovací oddělení');await department.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Uloženo v prohlížeči');
  await page.getByRole('button',{name:'Upravit',exact:true}).click();
  const dialog=page.getByRole('dialog');
  expect(await dialog.getByLabel('Oddělení',{exact:true}).getAttribute('list')).toBeTruthy();
  await expect(dialog.getByLabel('Oddělení',{exact:true})).toHaveValue('Nové testovací oddělení');
  await dialog.getByRole('button',{name:'Zrušit',exact:true}).click();
  await page.getByRole('button',{name:'Odstranit zaměstnance',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Zrušit',exact:true}).click();
  await expect(page.getByTestId('result-p003')).toBeVisible();
  await page.getByRole('button',{name:'Odstranit zaměstnance',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Odstranit zaměstnance ze všech variant',exact:true}).click();
  await expect(page.getByTestId('result-p003')).toHaveCount(0);
  await page.getByRole('button',{name:'Zpět',exact:true}).click();
  await expect(page.getByTestId('result-p003')).toBeVisible();
  await page.getByRole('button',{name:'Znovu',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Uloženo v prohlížeči');
  await page.reload();await expect(page.getByTestId('diagram')).toBeVisible();
  await expect(page.getByTestId('result-p003')).toHaveCount(0);
  await page.getByRole('button',{name:'Přidat',exact:true}).click();
  await page.getByRole('menuitem',{name:'Zaměstnance',exact:true}).click();
  expect(await page.getByRole('dialog').getByLabel('Oddělení',{exact:true}).getAttribute('list')).toBeTruthy();
});
async function ready(page:Page){await page.goto('/');await expect(page.getByTestId('diagram')).toBeVisible();await expect(page.getByRole('status')).toHaveText('Uloženo v prohlížeči');}
async function duplicate(page:Page,name:string){await page.getByRole('button',{name:'Správa variant'}).click();await page.getByRole('menuitem',{name:'Duplikovat variantu'}).click();await page.getByLabel('Název varianty').fill(name);await page.getByRole('dialog').getByRole('button',{name:'Vytvořit kopii',exact:true}).click();await expect(page.getByLabel('Organizační varianta')).toHaveValue(name);await page.getByRole('switch',{name:'Režim editace'}).check();}
test('hledání, kopie varianty, přesun větve a undo/redo',async({page})=>{
  await ready(page);await expect(page.getByRole('switch',{name:'Režim editace'})).toBeEnabled();await page.getByLabel('Hledat zaměstnance').fill('martin dvorak');await page.getByTestId('result-p003').click();await expect(page.locator('.profile')).toContainText('Martin Dvořák');await page.getByLabel('Hledat zaměstnance').fill('');await duplicate(page,'Návrh 2027');
  await page.getByTestId('result-p002').click();await page.getByRole('button',{name:'Přesunout pod',exact:true}).click();await page.getByLabel('Nový vedoucí').click();await page.getByRole('option',{name:'Pavel Veselý',exact:true}).click();await page.getByRole('button',{name:'Přesunout pod vedoucího'}).click();await expect(page.locator('.detail-content')).toContainText('Pavel Veselý');await page.getByRole('button',{name:'Zpět',exact:true}).click();await expect(page.locator('.relationship-group').first()).toContainText('Jan Novák');await page.getByRole('button',{name:'Znovu',exact:true}).click();await expect(page.locator('.relationship-group').first()).toContainText('Pavel Veselý');
});
test('doplňkové vztahy zachovají souřadnice a přepnutí rozložení funguje',async({page})=>{
  await ready(page);await page.waitForTimeout(700);const positions=()=>page.locator('.react-flow__node').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.getAttribute('data-id'),(n as HTMLElement).style.transform])));const before=await positions();await page.getByRole('checkbox',{name:'Odborné',exact:true}).check();await expect.poll(positions).toEqual(before);await page.getByLabel('Typ vztahu pro rozložení').click();await page.getByRole('option',{name:'Odborné vedení',exact:true}).click();await expect(page.getByLabel('Typ vztahu pro rozložení')).toHaveValue('Odborné vedení');
});
test('neobsazená pozice a varianta přežijí obnovení stránky',async({page})=>{
  await ready(page);await duplicate(page,'Lokální návrh');await page.getByRole('button',{name:'Přidat',exact:true}).click();await page.getByRole('menuitem',{name:'Neobsazenou pozici'}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Pracovní pozice').fill('Hydrogen System Architect');await dialog.getByLabel('Oddělení',{exact:true}).fill('System Engineering');await dialog.getByLabel('Štítky',{exact:true}).fill('Hydrogen');await dialog.getByLabel('Štítky',{exact:true}).press('Enter');await dialog.getByRole('button',{name:'Uložit',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Uloženo v prohlížeči');await page.reload();await expect(page.getByLabel('Organizační varianta')).toHaveValue('Lokální návrh');await page.getByLabel('Hledat zaměstnance').fill('Hydrogen System Architect');await expect(page.getByTestId(/^result-/)).toHaveCount(1);
});
test('export a atomický import do prázdného kontextu',async({page,browser})=>{
  await ready(page);await duplicate(page,'Přenesený návrh');await page.getByRole('button',{name:'Export JSON'}).click();const event=page.waitForEvent('download');await page.getByRole('button',{name:'Stáhnout JSON'}).click();const download=await event,path=await download.path();expect(path).toBeTruthy();const context=await browser.newContext({baseURL:'http://127.0.0.1:5173'});const fresh=await context.newPage();await ready(fresh);await fresh.getByRole('button',{name:'Import',exact:true}).click();await fresh.getByLabel('Soubor JSON').setInputFiles(path!);await fresh.getByText('Nahradit vše',{exact:true}).click();await fresh.getByRole('checkbox',{name:'Potvrzuji nahrazení všech současných dat'}).check();await fresh.getByRole('button',{name:'Importovat data'}).click();await expect(fresh.getByRole('status')).toHaveText('Uloženo v prohlížeči');await fresh.reload();await expect(fresh.getByLabel('Organizační varianta')).toHaveValue('Přenesený návrh');await context.close();
});
test('přetažení vedoucího na kartu přesune primární větev',async({page})=>{
  await ready(page);await duplicate(page,'Drag test');await page.getByRole('button',{name:'Přizpůsobit obrazovce'}).click();await page.waitForTimeout(700);const source=page.getByTestId('node-p002'),target=page.getByTestId('node-p007');await expect(source).toBeVisible();await expect(target).toBeVisible();const a=await source.boundingBox(),b=await target.boundingBox();expect(a).toBeTruthy();expect(b).toBeTruthy();await page.mouse.move(a!.x+a!.width/2,a!.y+a!.height/2);await page.mouse.down();await page.mouse.move(b!.x+b!.width/2,b!.y+b!.height/2,{steps:20});await expect(page.locator('.drop-preview')).toContainText('Pavel Veselý');await page.mouse.up();await page.getByTestId('result-p002').click();await expect(page.locator('.relationship-group').first()).toContainText('Pavel Veselý');
});
