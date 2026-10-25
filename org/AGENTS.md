# Pokyny pro další práci

- Komunikujte česky. UI a dokumentaci udržujte v UTF-8.
- Aplikace musí fungovat otevřením dist/index.html přes file:// bez Node.js, internetu a serveru. Node slouží pouze pro vývoj, sestavení a testy.
- Výchozí liniová varianta s ID current je upravitelná stejně jako ostatní. Starší uložené a importované varianty current odemkněte bez ztráty dat; nevracejte její někdejší ochranu.
- Vymazat všechna data ukládá platný prázdný dataset přes běžnou frontu zápisů. Nemažte databázi: chybějící snapshot spouští demo. Reset vyžaduje potvrzení a musí přežít reload bez návratu dema.
- Zachovejte React/TypeScript projekt. Vygenerované HTML není zdroj pravdy; upravujte zdroje a opakujte sestavení.
- Nepřidávejte CDN, externí fonty, vzdálené obrázky ani backend jako podmínku provozu. Assety musí být součástí HTML.
- scripts/build-standalone.mjs vkládá JS a CSS do HTML a odmítá nezahrnuté výstupní soubory. Zachovejte tuto kontrolu a klasický inline skript kompatibilní s file://. Alternativa --from-esbuild pro omezené Windows prostředí je v README.
- Doménová pravidla patří do src/domain, úložiště do src/persistence, propojení stavu do src/app a vizualizace do src/components/diagram. React Flow není zdroj organizačních vztahů.
- Zachovejte validaci cyklů po typech vztahů, primární rodiče a sdílené zaměstnance a štítky.
- Snapshot IndexedDB ukládejte atomicky přes frontu zápisů. Neskrývejte chyby ukládání, nepřepisujte původní data při chybě načtení.
- Kopírování HTML nepřenáší data. Zachovejte JSON import/export pro zálohy i přechod mezi HTTP a file://. Při změně formátu aktualizujte docs/data-format.md.
- Neslibujte shodné chování úložiště file:// ve všech prohlížečích ani sdílení dat mezi cestami či profily.
- Respektujte uživatelovy rozpracované změny. Instalujte přes npm ci a zachovejte package-lock.json.
- Pro změny distribuce spusťte npm run build a npm run test:standalone. Test musí používat skutečné file:// v offline režimu a ověřit obnovu IndexedDB po reloadu.
- Pro doménové změny spusťte odpovídající testy: node scripts/smoke.mjs a npm test. Pro interakce spusťte relevantní Playwright e2e.
- Pokud prostředí blokuje pomocné procesy chybou spawn EPERM, použijte dokumentovaný přímý esbuild. Pokud blokuje i prohlížeč, výslovně uveďte neprovedenou kontrolu. Sestavení samo nedokazuje funkční ukládání přes file://.
- Po úpravách znovu vytvořte distribuční HTML. README udržujte v souladu s příkazy a skutečným stavem ověření. dist, node_modules, cache a výsledky testů jsou generované soubory.
