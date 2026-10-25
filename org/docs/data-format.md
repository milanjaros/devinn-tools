# JSON formát, schemaVersion 1

Autoritativní runtime schéma je `src/domain/validation.ts`, TypeScript modely jsou `src/domain/models.ts`.

Oddělení (`department`) je nepovinné u zaměstnanců i pozic. Prázdný řetězec, chybějící pole a `null` se při importu převedou na `""`. Vyplnění oddělení není podmínkou uložení kontaktu.

Kompletní databáze má kolekce `people`, `tags`, `relationshipTypes`, `scenarios` a `activeScenarioId`. Pro částečný import jsou všechny kolekce volitelné, `schemaVersion: 1` je povinné. Chybějící kolekce při sloučení ponechají existující záznamy, při nahrazení se vyprázdní. Bez dodaného katalogu typů se při nahrazení použijí tři výchozí typy. Bez varianty vznikne prázdná „Importovaná organizace“.

```json
{
  "schemaVersion": 1,
  "activeScenarioId": "current",
  "people": [
    {"id":"p1","name":"Jan Novák","position":"CTO","department":"R&D","employer":"Moje firma s.r.o.","email":"jan@example.com","phone":"+420 123 456 789","photo":null,"tagIds":["architecture"],"description":"Technologická strategie"}
  ],
  "tags": [
    {"id":"architecture","name":"System Architecture","category":"Odbornost","color":"#648b7b"}
  ],
  "relationshipTypes": [
    {"id":"organizational","name":"Organizační vedení","color":"#648b7b","lineStyle":"solid","allowMultipleParents":false},
    {"id":"professional","name":"Odborné vedení","color":"#8d74c6","lineStyle":"dashed","allowMultipleParents":true},
    {"id":"project","name":"Projektové vedení","color":"#cd984d","lineStyle":"dotted","allowMultipleParents":true}
  ],
  "scenarios": [
    {
      "id":"current","name":"Návrh","description":"Experimentální struktura","protected":false,
      "createdAt":"2026-10-22T12:00:00.000Z","updatedAt":"2026-10-22T12:00:00.000Z",
      "positions":[{"id":"vacancy1","position":"System Architect","department":"R&D","tagIds":["architecture"],"status":"vacant","description":"Nová odborná role"}],
      "relationships":[{"id":"r1","scenarioId":"current","sourceId":"p1","targetId":"vacancy1","type":"organizational","primary":true}],
      "view":{"layoutType":"organizational","visibleTypes":["organizational","professional"],"showDepartments":false,"showTags":false,"showContacts":false,"onlyMatches":false,"collapsedIds":[],"positions":{}}
    }
  ]
}
```

`photo` je null, HTTP(S) URL nebo data URL obrázku PNG/JPEG/WebP/GIF. Lokální fotografie aplikace převádí na data URL kvůli přenositelnosti exportu. Vyplněná pozice má `status: "filled"` a `occupantId` existujícího člověka. Vztahy již odkazují přímo na zaměstnance, nikoliv na obsazenou pozici.

`people[].email` a `people[].phone` jsou řetězce; nevyplněné mají hodnotu `""`. Neprázdný e-mail se validuje, telefon zůstává volný text pro různé formáty a linky. Starší JSON a uložené snapshoty bez těchto polí dostanou prázdné hodnoty. Skutečné kontakty demo neobsahuje. `view.showContacts` určuje zobrazení e-mailu, telefonu a ikony CSV exportu na kartičkách zaměstnanců; výchozí hodnota je `false`. Skrytí údajů na kartičkách je neodstraňuje z dat ani exportu.

Ikona kontaktu při zobrazených kontaktních informacích přímo stahuje vCard (.vcf). Obsahuje pracovní e-mail a telefon, zaměstnavatele, pozici a oddělení. Nahrané PNG/JPEG/WebP/GIF se vkládají do PHOTO jako base64, vzdálené fotografie jako URI. Generovaný SVG avatar se nepřikládá. CSV export není dostupný.

Prázdné nebo duplicitní ID se odmítne. ID uzlů (lidí a všech variantních pozic) i vztahů jsou jedinečná napříč variantami. Odkazy pozic jsou přípustné jen ve vlastní variantě. Všechny štítky, zaměstnanci, typy a aktivní varianta musejí po operaci existovat. Vyplněné pozice nemohou být konci vztahů. U každé kombinace typu a cíle lze mít nejvýše jeden explicitní primární vztah. Více neprimárních rodičů je povoleno podle pravidel typu.

Zjednodušenému importu varianty stačí `id`, `name` a `relationships`. Časy a nastavení se doplní; u vnořeného vztahu vždy rozhoduje ID nadřazené varianty. `scenarioId` lze vynechat; případné staré či odlišné ID import nahradí ID nadřazené varianty. Na nejvyšší úrovni lze dodat `relationships`, jejich `scenarioId` je povinné a musí určit existující nebo současně importovanou variantu.

Sloučení ponechává existující záznam při konfliktu ID. Výslovné povolení přepisu použije importovaný záznam jako celek. Přepis varianty tedy nahrazuje i její pozice, nastavení a vztahy; nejde o rekurzivní sloučení vnořených kolekcí. Počet shodných ID se ukazuje v náhledu. Reference se kontrolují až proti kompletnímu zamýšlenému výsledku, takže lze importovat například vztahy k existujícím lidem. Při chybě se nemění žádná část databáze.

Vztahy jsou orientovány **vedoucí → člen týmu**. Cykly se kontrolují odděleně v každém typu; rozložení používá primární kostru zvoleného typu. Přesun uzlu mění pouze jeho primární příchozí vazbu a zachová všechny vnitřní vazby větve i ostatní typy.

`people[].position` a `scenarios[].positions[].position` označují pracovní pozici. Nové JSON exporty nepoužívají `title`. Import nadále přijímá starší `title`; při přítomnosti obou polí má přednost `position`. Interní model a starší IndexedDB mohou nadále používat `title`. `people[].employer` je název zaměstnavatele jako volný text; při chybějícím poli se doplní prázdný řetězec. Zaměstnavatele lze upravit v detailu a ve formuláři zaměstnance.

