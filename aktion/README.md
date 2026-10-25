# Aktion – lokální ovládání vrat

## Orientace v projektu

```text
Aktion/
  README.md             Stav projektu a podklady pro další práci
  aktion.ipa            Původní instalační balíček iOS aplikace (lokální, mimo Git)
  app/                  Lokální web a Node.js server
    Start.cmd           Spuštění skutečného režimu
    Demo.cmd            Spuštění simulace bez spojení s vraty
    README.md           Podrobný návod k aplikaci
    server.mjs          HTTP server, lokální relace, CSRF, API
    protocol.mjs        Klient Aktion, RSA, AES, příkazy
    mock.mjs            Místní simulátor Aktion serveru
    app.test.mjs        Testy protokolu, kompatibility a API
    public/             HTML, CSS a JavaScript ovládací stránky
  analysis/
    findings.md         Zjištění z původní aplikace
    extracted/          Vybrané původní zdroje z IPA pro analýzu a testy
    decoded/            Odvozené výpisy s dekódovanými řetězci
    scratch/            Pomocné výpisy funkcí z průběhu analýzy (mimo Git)
```

## Spuštění

Vyžaduje Node.js 22+, žádné externí balíčky. Z tohoto adresáře:

```powershell
cd app
node server.mjs          # skutečný režim
# nebo node server.mjs --demo
```

Otevři http://127.0.0.1:8787. Alternativou je dvojklik na `app/Start.cmd` či `app/Demo.cmd`. Demo má účet `demo` / `demo`. Nespouštěj oba režimy současně na stejném portu. Ukončení je Ctrl+C. Skutečný režim se připojuje k Aktionu až po odeslání přihlašovacího formuláře; tlačítko Otevřít přímo odesílá příkaz zařízení.

## Stav k 22. 10. 2026

Uživatel dodal HTTP komunikaci mobilní aplikace a soubor `aktion.ipa`. Cílem je vytvářet vlastní platné zprávy a ovládat vrata z lokálního webu. IPA obsahuje Cordovu a obfuskovaný JavaScript, takže nebylo nutné rozebírat nativní spustitelný soubor.

Je hotová aplikace s přihlášením, seznamem dveří, otevřením, obsluhou relé a odhlášením. Lokální server obchází omezení CORS prohlížeče. Běží pouze na 127.0.0.1 a kontroluje Host, Origin a CSRF. Přihlašovací údaje a klíče drží v paměti procesu; neukládá je do souborů ani úložiště prohlížeče. Relace se odstraňují při dalším požadavku po 30 minutách nečinnosti.

Výchozí vzdálený server je `http://213.168.177.207:8090`, endpoint `/GetMobileData`. Adresu lze změnit ve formuláři. Přihlašovací údaje nejsou součástí projektu.

**Skutečný server nebyl při vývoji kontaktován a žádný příkaz fyzickým vratům nebyl odeslán. Funkčnost proti skutečnému serveru není zatím ověřená.**

## Důležité detaily protokolu

- `data` je řetězec: při navazování relace vnořený JSON, po navázání `SessionId + Base64 šifrované zprávy`.
- Metoda `-1` získá veřejný RSA klíč (`Modulus`, `Exponent`). Metoda `-2` odešle `SessionId` a `AesKey` šifrované pomocí RSAES-PKCS1-v1_5.
- Originál generuje heslo relace jako hexadecimální text `MD5(randomText(20,30))`. Náš klient generuje náhodný text stejné délky pomocí kryptografického generátoru.
- CryptoJS používá AES-256-CBC, PKCS#7, osmibajtovou sůl, OpenSSL obálku `Salted__` a EVP_BytesToKey s MD5, jedna iterace. Klíč relace vstupuje jako **textové heslo**, nikoli jako hexadecimálně dekódovaný AES klíč.
- Metody: `0` přihlášení, `1` seznam dveří, `2` otevření/přepnutí. U metody `2` je `MethodData` přímo `Id` dveří.
- Běžné požadavky obsahují přihlašovací údaje, `LoginType`, `Version: 3`, `Language: 0`, rostoucí `CommandId` a `MethodData`. Přihlášení navíc obsahuje `HwId`.
- Podporován je standardní účet (`LoginType: 0`) a PIN (`4`). OAuth/SSO (`8`) zatím není implementováno. U registrace zařízení může být potřeba skutečné správcem přidělené `HwId`.
- `IsEnabled` u relé označuje aktuální stav. `SwitchOperationEnabled` mění text tlačítka na Přepnout.
- `sessionRenew` ukončí lokální připojení a vyžádá nové přihlášení. Příkaz otevření se **nikdy automaticky neopakuje**, ani při timeoutu. Přijetí příkazu není potvrzení fyzické polohy vrat.

## Zdroje pro další analýzu

### Co verzovat

Do Gitu patří `app/` (kromě již ignorovaných logů), dokumentace, `analysis/findings.md`, `analysis/decoded/` a vybrané reference z `analysis/extracted`. Dekódované výpisy mají dohromady přibližně 83 KiB a ponecháváme je, protože projekt neobsahuje skript pro jejich opětovné vytvoření.

Kořenový `.gitignore` z rozbaleného IPA ponechává pouze `comm.js`, `login.js`, `openDoor.js`, adresář `rsa/` a `crypto-js/crypto-js.js` s licencí a README. Jde o 10 souborů, přibližně 469 KiB místo celých 543 souborů / 11,52 MiB. CryptoJS je potřeba pro test kompatibility; ostatní vybrané zdroje zachovávají původní implementaci protokolu pro další analýzu. Aplikace za běhu tyto reference nepoužívá.

Nativní binárky a frameworky iOS, Cordova, grafika, fonty a ostatní knihovny původního rozhraní jsou ignorované. Stejně tak `analysis/scratch/` a `aktion.ipa` (4,68 MiB). Soubory zůstávají na disku; původní IPA uchovej v samostatné záloze, protože úplný balíček z klonu repozitáře neobnovíš.

Pro dohledání stejné verze má původní `aktion.ipa` SHA-256 `0f4fb772e828c6653bf5ac25f0bf0a3b84e293657648322ed91eff0eb7c9e856`. Úplnou lokální referenci lze obnovit rozbalením tohoto IPA jako ZIP do `analysis/extracted/` (například z kopie s příponou `.zip` pomocí `Expand-Archive`). Nové potřebné reference přidej výslovně do výjimek v `.gitignore`.

Originály jsou v `analysis/extracted/Payload/Aktion.app/www/js/`: především `comm.js`, `openDoor.js`, `login.js`, `rsa/rsa.js` a `crypto-js/crypto-js.js`. Čitelnější odvozené výpisy komunikace a dveří jsou v `analysis/decoded/`.

Výpisy `*.decoded.js` jsou podklady ke čtení, **nespouštět**: nahrazení volání dekodéru řetězců zasahuje také inicializační smyčky obfuskace. Obsah `analysis/extracted` neupravovat; úpravy patří do `app`. Pomocné `*.functions.txt` v `analysis/scratch` lze při další práci ignorovat.

Zachycené historické zprávy nelze dešifrovat pouze z RSA šifrované položky AesKey. Pro nové zprávy si klient založí vlastní relaci a zná její klíč.

## Ověření a další postup

Z adresáře `app` spusť:

```powershell
node app.test.mjs
```

Pět testů ověřuje obousměrnou kompatibilitu s CryptoJS z IPA, RSA výměnu a přihlášení, seznam a příkaz otevření, neopakování příkazu při chybě, zabezpečení lokálního API a diagnostické logy bez tajných údajů. Kompatibilitní test vyžaduje zachovanou cestu `analysis/extracted`; bez reference se přeskočí. Spuštění přímo přes `node app.test.mjs` funguje i v prostředí, kde test runner nemůže vytvářet podprocesy (`spawn EPERM`).

Po prvním uživatelském pokusu se objevila chyba „Server nevrátil očekávanou odpověď.“ `app/logger.mjs` ukládá při běžném spuštění diagnostiku do `app/logs/aktion-RRRR-MM-DD.jsonl`, bez hesel, klíčů, tokenů či těl zpráv. Log z 2026-10-22 20:51:49 UTC potvrdil úspěšné HTTP a dešifrování odpovědi metody -2; klient odmítl dvouznakový řetězec namísto objektu. Jeho obsah se nelogoval, takže není známý. Opravena výměna klíče tak, aby kromě objektu přijala známá řetězcová potvrzení `OK`, `ok` a `{}`; neznámé řetězce zůstávají odmítnuté. Validace přihlášení a otevření se nemění. Přidán regresní test. Po restartu je nutný další uživatelský pokus k ověření proti skutečnému serveru; žádné příkazy fyzickým vratům při opravě neodesílány.

Ovládací stránka byla také prověřena v simulovaném DOM proti místnímu demo serveru: přihlášení, vykreslení tří vstupů, jeden příkaz a odhlášení. Vizuální kontrola v reálném prohlížeči zatím neproběhla. Tato jednorázová kontrola použila jsdom z vedlejšího projektu; aplikace ani trvalé testy na něm nezávisí.

Při pokračování nejprve přečíst tento soubor a `app/README.md`, spustit testy a případně demo. Dalším krokem je ověření přihlášení a skutečného formátu odpovědí s uživatelovým účtem. Pro změny neodesílat zkušební příkazy fyzickým vratům bez jasného pokynu; používat simulátor. Při problémech ověřit typ přihlášení, HwId a odpovědi serveru bez zaznamenávání hesel či klíčů.
