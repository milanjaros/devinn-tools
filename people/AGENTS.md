# People — zpracování dat Plusportalu

## Účel a zásady

Projekt převádí uživatelem zachycený provoz Plusportalu do JSON kontaktů a organizačních vazeb. Pracuj primárně offline s dumpem. Zdrojová aplikace je `https://plusportal.devinn.cz/plusPortal/`.

- Zachovávej údaje ze zdroje, diakritiku a UTF-8. Jména jsou ve zdroji ve tvaru příjmení jméno; automaticky je nepřehazuj.
- Nevymýšlej oddělení, kontakty ani popisy. Chybějící řetězcové údaje ponech prázdné.
- Uživatel výslovně odmítl náhradu prázdného oddělení hodnotou „Neuvedeno“ a požádal o její vrácení. Toto pravidlo dodržuj i při chybě validace importu.
- Zachovej více pracovních rolí jedné osoby. Neodstraňuj různé role jako duplicity.
- Dump může obsahovat přihlašovací údaje, cookies a další osobní data. Nevypisuj je zbytečně a nepřidávej dump, fotografie, certifikáty ani exporty do verzování či externích služeb.
- Neměň data ani znovu negeneruj exporty, pokud je úkol jen dokumentační.

## Prostředí a soubory

Pracovní adresář: `C:\Users\jaros\Projects\People`, PowerShell na Windows.

Mitmproxy je v `C:\Users\jaros\Tools\mitmproxy\`; existují `mitmproxy.exe`, `mitmdump.exe` a `mitmweb.exe`. V prostředí agenta nebyl nástroj v PATH. Spouštění agenta selhalo při rozbalování `VCRUNTIME140.dll` s `Permission denied`, i s dočasnou složkou v projektu. Uživatel proto záznam spouštěl ve vlastním PowerShellu. Neopakuj neúspěšné pokusy o eskalaci.

Skripty jsou CommonJS pro Node.js a používají jen vestavěné moduly; instalace npm balíčků není potřeba. Dříve fungoval Node.js 24.21.0 z `C:\Users\jaros\Tools\nodejs\node.exe`. Python v PATH byl pouze nefunkční alias WindowsApps.

| Soubor / složka | Význam |
| --- | --- |
| `capture.ps1` | Spuštění proxy, časově pojmenovaný dump, vlastní confdir `.mitmproxy` |
| `captures/plusportal.mitm` | Původní uživatelský záznam |
| `inspect-dump.cjs` | Čtení binárního formátu dumpu bez instalace mitmproxy |
| `captures/decoded/index.json` | Index odpovědí s hostem, cestou, stavem, typem a velikostí |
| `captures/decoded/<id>.body` | Dekódovaná těla odpovědí |
| `export-people.cjs` | Extrakce lidí, rolí a fotografií |
| `exports/people.json` | Meziformát lidí s polem `roles` |
| `exports/photos/` | Fotografie pojmenované SHA-256 obsahu |
| `exports/report.json` | Statistiky extrakce |
| `create-import.cjs` | Generátor `people-import.json` |
| `create-relationships.cjs` | Generátor `relationships.json` |

Importní JSONy nemusí být přítomné, i když jsou generátory a mezivýsledky dostupné. Před prací ověř aktuální soubory. `captures/active.json` a logy pocházejí z pokusů o spuštění; nejsou důkazem, že proxy běží.

`.gitignore` nyní ignoruje `captures/`, `.mitmproxy/`, `exports/` a `people-import.json`. `relationships.json` zatím ignorovaný není; obsahuje vazby osob a nemá se automaticky publikovat.

## Zachycení provozu

Příkaz, který uživatel použil ve vlastním PowerShellu (cílová složka `captures` musí existovat):

```powershell
& "C:\Users\jaros\Tools\mitmproxy\mitmdump.exe" --listen-host 127.0.0.1 --listen-port 8080 --anticache --set store_streamed_bodies=true -w "C:\Users\jaros\Projects\People\captures\plusportal.mitm"
```

Pevná cesta může přepsat předchozí dump; pro další záznam zvol nový název. Alternativa:

```powershell
.\capture.ps1 -Mitmdump C:\Users\jaros\Tools\mitmproxy\mitmdump.exe
```

Skript používá vlastní certifikáty v `.mitmproxy`, zatímco přímý příkaz používá výchozí konfiguraci mitmproxy. Při změně konfigurace může být třeba importovat odpovídající CA znovu.

Firefox: ruční HTTP proxy `127.0.0.1:8080`, také pro HTTPS. Na `http://mitm.it` stáhnout CA a importovat ji do autorit Firefoxu s důvěrou pro webové stránky. Uživatel se přihlásí, načte organizační strukturu a fotografie. Záznam ukončí Ctrl+C. Po zachytávání vrátí nastavení proxy ve Firefoxu podle potřeby.

## Zpracování dumpu

Spouštěj z kořene projektu, jednotlivé kroky postupně:

```powershell
node .\inspect-dump.cjs .\captures\plusportal.mitm
node .\export-people.cjs
node .\create-import.cjs
node .\create-relationships.cjs
```

První skript vypisuje celý index; pro omezení výstupu jej lze přesměrovat do lokálního souboru. Následující skripty čtou pevnou cestu `captures/decoded/index.json`. Přegenerování přepisuje výstupy. Při použití jiného dumpu uvádí report zatím stále pevně `captures/plusportal.mitm`; tento údaj není automatická provenance vstupu.

`inspect-dump.cjs` parsuje tnetstring záznamy, ukládá těla a rozbaluje gzip, Brotli a deflate. Není to plná náhrada mitmproxy API. Při neúplném záznamu vypíše chybu a skončí smyčku, ale může vytvořit částečný index bez nenulového exit kódu. Také chyba dekomprese nezastaví běh. Kontroluj stderr a úplnost výsledků, nejen návratový kód.

## Zdrojová data a extrakce

Klíčová odpověď je HTTP 200 pro `/plusPortal/mod_12/Relations.aspx`. V původním dumpu má index 33 (`33.body`), ale tento index není stabilní a nesmí se natvrdo používat v generátorech.

Data jsou v HTML, nikoli v samostatném JSON API:

- Karta osoby: `div.ochPerson`, jméno v `td.name`.
- Buňky `td` s třídou `jobTitle text-muted` obsahují v pořadí pozici, oddělení, zaměstnavatele a případně telefon.
- E-mail je v odkazu `mailto:`.
- Fotografie: `img src` na `/plusPortal/mod_01/GetUserPhoto.ashx?p=...`; mapuj URL na zachycenou obrazovou odpověď, nikoli na nově stahovaný obsah.
- Číselné kódy se čtou z textu výběrových položek: `Jméno (kód) - ...`. Hodnota atributu `option value` je jiný interní identifikátor; nezaměňovat s kódem v závorce. Přesný obchodní význam kódu není ověřen.

`export-people.cjs` slučuje osoby podle jména a e-mailu; role deduplikuje podle pozice, oddělení a zaměstnavatele. Výsledky řadí podle českého `localeCompare`. Fotografie ukládá podle SHA-256, vybírá první dostupnou pro osobu a pole `sharedByPeople` udává počet osob se stejnými obrazovými daty. Shodný obrázek nemusí znamenat skutečnou společnou fotografii; může jít o výchozí avatar.

Při novém dumpu ověř HTML a vazby, protože změna struktury může zneplatnit regulární výrazy. Další generátory párují lidi podle jména; při shodných jménech je třeba použít přesnější identifikaci, nikoli odhad.

## Formát people-import.json

Kořen: `{ "schemaVersion": 1, "people": [...] }`.

Každá osoba obsahuje `id`, `name`, `employer`, `position`, `department`, `photo`, `email`, `phone`, `description`.

- `id`: řetězec `p001`, `p002`, … podle pořadí v `exports/people.json`.
- `position`: pracovní titul ze zdroje.
- Více pozic, oddělení, zaměstnavatelů a kontaktů: unikátní neprázdné hodnoty spojené `; `.
- `photo`: kompletní data URL, například `data:image/jpeg;base64,<obsah>`, s odpovídajícím MIME typem.
- `description`: prázdný řetězec; ilustrační popis z uživatelova vzoru není skutečný údaj.
- Jeden nalezený kód: `code` jako řetězec. Více kódů: `codes` jako pole řetězců.
- Chybějící oddělení ponechat `""`. Cílový import hlásil `people.14.department: Vyplňte oddělení.`; tato validační překážka není vyřešená a uživatel zakázal automatickou náhradu „Neuvedeno“.

ID nejsou stabilní mezi různými množinami lidí: změna abecedního pořadí je může posunout. Po regeneraci kontaktů vždy regeneruj i vztahy; nespojuj staré vztahy s novými ID.

## Hierarchie a relationships.json

Hierarchii zachovávají vnořené `table.ochTable`, `td.ochCellManager` a `td.ochCellSubordinate`. Čti skutečné vnoření, nikoli pořadí osob nebo názvy oddělení. Zdroj obsahuje i chybné otevření `<table class='innerLayout'` bez koncového `>`; stávající parser ho výslovně toleruje.

Role jedné osoby mohou být na více místech stromu. Export do kontaktových vazeb je slučuje, takže může mít jeden kontakt více nadřízených. Nevnucuj jediného nadřízeného. Vazby osoby na sebe po sloučení rolí vynech, opakované dvojice deduplikuj.

Kořen JSON: `{ "relationships": [...] }`. Každá vazba:

```json
{
  "id": "nové UUID v4",
  "sourceId": "ID nadřízeného",
  "targetId": "ID podřízeného",
  "type": "organizational",
  "primary": true,
  "scenarioId": "50d7e04e-b91b-4b13-aab5-f1073a14c77d"
}
```

`type`, `primary` a `scenarioId` jsou uživatelem určené konstanty. UUID se generují při každém běhu znovu. Skript ověřuje jedinečnost jmen, vnoření tabulek, existenci kontaktů a nepřítomnost cyklů.

## Dosavadní výsledky a kontrola

Historické výsledky pro původní dump (nepožaduj stejná čísla u nového záznamu):

- 104 karet, 53 unikátních lidí, 56 rolí; tři lidé mají více rolí.
- Všech 53 lidí má zachycený obrázek; u 13 je obsah obrázku shodný, pravděpodobně výchozí avatar.
- 50 lidí má e-mail, 39 telefon.
- Kód má 52 lidí: 51 v `code`, Milan Jaroš má `codes: ["514", "516"]`.
- Jiří Jiránek má ve zdroji prázdné oddělení.
- Hierarchie: 70 unikátních vazeb pokrývajících 53 kontaktů, dva vynechané vztahy osoby na sebe; kontrola cyklů prošla.

Po změně ověř validní JSON, jedinečnost ID, existenci všech koncových kontaktů ve vztazích, správný směr vazeb a shodu dekódované base64 s obrazovým souborem. Generátor importu již porovnává obrazové bajty a ověřuje jedinečnost ID. Úspěšná lokální kontrola neznamená přijetí cílovou aplikací; kompletní její schéma zde není dostupné. Úplnost zachycených 53 kontaktů vůči celému Plusportalu také není potvrzená: výběrový seznam obsahuje i další osoby bez kompletních karet v zachyceném diagramu.
