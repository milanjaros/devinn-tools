# Organization Structure Designer

Lokální aplikace v češtině pro prohlížení a modelování organizačních struktur. Bez backendu, přihlášení a externí databáze.

## Použití bez Node.js

Otevřete **dist/index.html dvojklikem** v Chrome nebo Edge. Soubor obsahuje JavaScript i styly. Používání nepotřebuje Node.js, instalaci, internet ani server. Kořenový index.html je pouze vývojový vstup.

Data se ukládají do IndexedDB v profilu prohlížeče, nikoli do HTML. Kopírování HTML nepřenáší vaše data: použijte export/import JSON. Data z dřívější adresy http://127.0.0.1:5173 se do file:// nepřenesou automaticky; exportujte je ve staré aplikaci a importujte v nové.

Pro prázdný začátek otevřete **Správa variant** (šipka vedle názvu varianty) → **Vymazat všechna data**, zaškrtněte potvrzení a potvrďte vymazání. Vznikne prázdná „Moje organizace“, která zůstane prázdná i po reloadu. Výchozí typy vztahů zůstanou k dispozici. V aktuální relaci lze vymazání vrátit přes Zpět. Smazání celé databáze v nastavení prohlížeče se naopak bere jako první spuštění a znovu načte demo.

Pravidelně exportujte JSON. Přístup k úložišti u file:// závisí na prohlížeči a nastavení. Změna cesty souboru, profilu nebo prohlížeče může ovlivnit dostupnost dat. Používejte stabilní cestu, běžný profil a jednu kartu aplikace. Vymazání dat prohlížeče smaže uložená data. Při chybě úložiště zkontrolujte nastavení prohlížeče.

## Vývoj a sestavení

Node.js 22.12+ (doporučeno 24) a npm jsou potřeba pouze pro vývoj a sestavení:

```sh
npm ci
npm run dev
```

Vývojová adresa je standardně http://127.0.0.1:5173. Vite pouze servíruje soubory; zaměstnanecká data se na server neposílají.

```sh
npm run build
```

Příkaz zkontroluje TypeScript a vytvoří **dist/index.html** s vloženým klasickým skriptem a CSS, bez externích souborů. Po změnách zdrojů sestavení opakujte. Složka dist není verzovaná. `npm run preview` slouží ke kontrole přes HTTP; nenahrazuje kontrolu otevřením souboru.

Pokud Windows prostředí blokuje pomocné procesy Node chybou spawn EPERM, lze použít přímo nainstalovaný esbuild. V PowerShellu:

```powershell
node node_modules/typescript/bin/tsc -b
.\node_modules\@esbuild\win32-x64\esbuild.exe --% src/main.tsx --bundle --format=iife --jsx=automatic --minify --outfile=dist/standalone.js --define:process.env.NODE_ENV=\"production\"
node scripts/build-standalone.mjs --from-esbuild
```

Poslední krok vloží JavaScript a CSS do HTML a odstraní mezisoubory.

## Ovládání a data

Tlačítko v levém horním rohu skryje nebo znovu zobrazí levý panel lidí a filtrů. Skrytím se filtry nezruší; diagram získá více místa.

- Demo obsahuje 36 zaměstnanců a tři varianty. Týmy začínají sbalené; tlačítko pod kartou rozbalí podstrom.
- Hledání ignoruje diakritiku a zahrnuje jméno, pozici, oddělení a štítky. Vybrané štítky se kombinují jako AND.
- Všechny výchozí varianty včetně Současné liniové organizace lze upravovat, přejmenovat a smazat. Poslední zbývající variantu smazat nelze. Duplikovat variantu vytvoří nezávislé vztahy a pozice; zaměstnanci a katalog štítků jsou sdílení.
- Zapněte Editaci. Přetažení na jinou kartu přesune větev v právě zvoleném typu vztahu. Přetažení do volné plochy uloží souřadnice. Alternativou je Přesunout pod v detailu. Cyklus se odmítne.
- Rozložení podle určuje hierarchii. Zobrazit vazby mění jen viditelnost spojnic. Rozložit přepočítá rozmístění.
- Detail umožňuje editaci údajů, vztahů a primárního vedoucího. Typy vztahů a obsah karet se spravují v nastavení zobrazení.
- Přidat nabízí člověka, neobsazenou pozici nebo vztah. Nový štítek vznikne zadáním názvu a Enter.
- Pozici lze obsadit existujícím zaměstnancem; vazby se převedou po kontrole konfliktů. Vymazání pozice nemaže potomky.
- V režimu editace lze v detailu použít **Odstranit zaměstnance**. Po potvrzení se odstraní ze všech variant včetně referenční, spolu se svými vazbami. Ostatní zaměstnanci zůstanou, jeho obsazené pozice se uvolní. Akci lze vrátit tlačítkem Zpět.
- Pole Oddělení v detailu i při přidávání a úpravách našeptává existující názvy od zaměstnanců a pozic ve všech variantách. Lze napsat také nové oddělení.
- Zaměstnanci mají e-mail a telefon v detailu i formuláři. Skutečné údaje doplňte ručně; starší data dostanou prázdná pole. Kontakty se zahrnují do všech JSON exportů a lze je importovat.
Ikona kontaktu při zobrazených kontaktních informacích přímo stahuje vCard (.vcf). Obsahuje pracovní e-mail a telefon, zaměstnavatele, pozici a oddělení. Nahrané PNG/JPEG/WebP/GIF se vkládají do PHOTO jako base64, vzdálené fotografie jako URI. Generovaný SVG avatar se nepřikládá. CSV export není dostupný.
- Undo/Redo přes tlačítka nebo Ctrl+Z / Ctrl+Shift+Z uchovává nejvýše 50 kroků v aktuální relaci; reload historii neobnovuje.

Snapshot se ukládá atomicky v jedné IndexedDB transakci. Zápisy jsou řazené; starší zápis nepřepíše novější stav. Stav ukládání je v horní liště vedle Zpět a Znovu, chyba nabízí opakování. Při neuložených změnách aplikace upozorní před zavřením. Fotografie mají limit 3 MB, ukládají se jako data URL a zahrnují se do JSON. Demo používá generované SVG avatary.

Schéma: [docs/data-format.md](docs/data-format.md). Import před potvrzením ukazuje počty a validuje výsledný graf. Shodná ID se při sloučení standardně přeskakují; přepis vyžaduje výslovné zapnutí. Nahrazení celé databáze vyžaduje potvrzení. Selhání validace nemění stav. Exportovat lze celou databázi, zaměstnance se štítky nebo variantu včetně sdílených dat. Exporty lze znovu importovat.

## Architektura a ověření

React + TypeScript, Vite, Mantine, React Flow, Dagre, Zod a IndexedDB. src/domain obsahuje modely, validaci, grafové operace, historii a import/export. src/persistence spravuje IndexedDB a frontu zápisů. src/app propojuje stav a UI. src/components/diagram mapuje doménu na React Flow a počítá rozložení. React Flow není zdrojem vztahů. Každý typ vztahu je samostatný orientovaný acyklický graf. Kombinace typů může obsahovat kruhovou cestu; rozložení používá jeden typ a jednoho primárního rodiče.

```sh
node scripts/smoke.mjs
npm run test:contacts
npm test
npm run build
npm run test:standalone
npx playwright install chromium
npm run test:e2e
npm run licenses
```

Test standalone vyžaduje vytvořený dist/index.html a instalovaný Chrome. Ověřuje skutečné file:// bez serveru v offline režimu, kopii varianty, obnovu IndexedDB po reloadu, hledání, JSON export a absenci chyb JavaScriptu a HTTP požadavků. Pro Edge nastavte proměnnou BROWSER_CHANNEL na msedge. Volitelně BROWSER_CDP_URL umožňuje připojení k testovacímu prohlížeči. HTTP e2e používají Playwright Chromium. Licence: [docs/dependencies.md](docs/dependencies.md).

V tomto omezeném prostředí prošla kontrola TypeScriptu, 12 doménových smoke testů a 5 testů JSON position/employer, prázdného datasetu, odemknutí varianty, migrace kontaktů, JSON a VCF včetně fotografie. HTML vzniklo přímým esbuild. Vite a Vitest zde blokuje spawn EPERM a automatické spuštění prohlížeče je blokované. Funkčnost file:// a ukládání za běhu proto zatím nejsou potvrzené úspěšným prohlížečovým testem.

JSON export používá pro pracovní pozici pole `position` místo `title` (u zaměstnanců i neobsazených pozic). Starší JSON s `title` lze stále importovat. Pole `employer` lze upravit jako Zaměstnavatel v detailu i formuláři zaměstnance a VCF jej používá v ORG. Prázdný zaměstnavatel zůstává prázdný, DEVINN se automaticky nedoplňuje.
