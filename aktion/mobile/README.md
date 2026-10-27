# Aktion Vrata pro iPhone

Sdílené webové rozhraní z `app/public` běží na Windows přes existující Node server a v iPhonu uvnitř `WKWebView`. Malý vlastní obal nahrazuje Cordovu: nepotřebujeme její pluginy, npm závislosti ani vzdálený web. Přímou komunikaci s Aktionem, kryptografii, Klíčenku a App Intents zajišťuje Swift. Windows používá původní Node implementaci protokolu; její testy a nativní testy ověřují stejný formát zpráv.

Minimální verze je iOS 16. Aplikace má zatím podporu iPhonu. Není to samostatná aplikace na ploše CarPlay: z auta ji spouštíš přes Siri a Zkratky. Widget CarPlay není součástí této verze.

## 1. Vyzkoušení na Windows

Z kořene projektu:

```powershell
node app/server.mjs --demo
```

Otevři **http://127.0.0.1:8787**, přihlas se jako `demo` / `demo`. V nástrojích pro vývojáře prohlížeče můžeš zapnout mobilní rozměry. Jde o stejné HTML, CSS a JavaScript jako v iPhonu. Demo se skutečným Aktionem nekomunikuje.

Pro skutečný účet ukonči demo a spusť `node app/server.mjs`. Tlačítko Otevřít už odešle skutečný příkaz.

Klíčenku, nativní protokol, Siri a CarPlay na Windows nespustíš. Panel pro uložení vrat do Zkratek se zobrazuje pouze v iOS aplikaci. Pro změny UI upravuj `app/public`, nikoli generované `mobile/www`.

Lokální kontroly:

```powershell
node app/app.test.mjs
node mobile/web.test.mjs
node mobile/prepare.mjs
```

## 2. První build přes GitHub bez podpisu

1. Nahraj projekt do svého GitHub repozitáře včetně `.github/workflows/ios.yml`. Nikdy nenahrávej heslo Aktionu ani podpisové soubory.
2. V záložce **Actions** povol workflow, pokud je potřeba.
3. Otevři workflow **iOS app → Run workflow**. Ponech **signed** vypnuté. Případně se build spustí automaticky po změně příslušných souborů v repozitáři.
4. Po úspěšném dokončení stáhni v části **Artifacts** soubor `Aktion-iOS-unsigned` a rozbal ZIP. Uvnitř je `Aktion-unsigned.ipa`.

Workflow nejdřív spouští webové testy na Windows a nativní protokolové testy na macOS. Potom XcodeGen vytvoří projekt a Xcode aplikaci sestaví. IPA bez podpisu nejde přímo otevřít a instalovat z aplikace Soubory. Vyžaduje následné podepsání.

macOS runner GitHubu nahrazuje vlastní Mac. Jeho účtování závisí na typu repozitáře a tvém plánu GitHub Actions; před prvním buildem zkontroluj rozpočet Actions. Workflow aplikaci nikam nepublikuje. Artefakty mají retenci 7 dní.

### Instalace z Windows přes AltStore Classic

Tohle je první cesta pro vyzkoušení bez placeného Apple Developer členství:

1. Nainstaluj **AltServer pro Windows** a jeho požadované komponenty Apple podle [oficiálního návodu AltStore](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows).
2. Připoj a odemkni iPhone, potvrď důvěru počítači. Pomocí AltServeru na něj nainstaluj AltStore Classic.
3. Dle pokynů AltStore potvrď důvěru vývojáři a zapni Vývojářský režim v **Nastavení → Soukromí a zabezpečení → Režim vývojáře**.
4. Přenes `Aktion-unsigned.ipa` do Souborů v iPhonu. V AltStore Classic v části **My Apps** tlačítkem **+** vyber IPA a nech ho podepsat a nainstalovat. AltServer musí být dostupný podle pokynů AltStore.
5. Bez placeného členství se podpis obnovuje každých 7 dní; nech běžet AltServer a nastav obnovování podle návodu AltStore. [Omezení a obnovování](https://faq.altstore.io/altstore-classic/your-altstore).

Nejde o AltStore PAL z evropského alternativního tržiště; ten není náhradou za Classic pro libovolný vlastní IPA. Instalace této konkrétní aplikace přes AltStore, viditelnost jejích App Intents i chování se zamčeným telefonem vyžadují první ověření na tvém iPhonu. Neslibujeme jejich funkčnost jen na základě úspěšného buildu.

## 3. Volitelný podepsaný Ad Hoc build

Pro tuto větev potřebuješ **placené Apple Developer Program členství**. Není potřeba veřejná publikace aplikace ani App Review.

V [Apple Developer účtu](https://developer.apple.com/account/resources/):

1. Zaregistruj explicitní **App ID**, například `cz.tvojejmeno.aktion`. Výchozí `cz.aktion.personal` v projektu je pouze zástupný identifikátor; zvol svůj vlastní a potom ho neměň mezi aktualizacemi.
2. Zaregistruj **UDID svého iPhonu**. Získáš ho například přes iTunes na Windows po zobrazení identifikátoru připojeného telefonu.
3. Vytvoř certifikát **Apple Distribution** a uchovej jeho privátní klíč. Certifikát potřebujeme ve formátu `.p12`, který obsahuje certifikát i privátní klíč, chráněný heslem.
4. Vytvoř **Ad Hoc provisioning profile** pro toto App ID, certifikát a telefon. Stáhni `.mobileprovision`.

Nemáš-li dosud certifikát, lze žádost CSR a privátní klíč vytvořit na Windows pomocí OpenSSL, CSR odeslat v Apple Developer portálu a vydaný `.cer` pak s klíčem převést na `.p12`. Vlastní Mac k tomu není nutný. Přesné příkazy doladíme podle dostupné instalace OpenSSL; privátní klíč ani heslo neposílej do chatu.

V GitHub repozitáři otevři **Settings → Secrets and variables → Actions**:

| Typ | Název | Obsah |
| --- | --- | --- |
| Variable | `IOS_BUNDLE_ID` | Tvoje App ID, např. `cz.tvojejmeno.aktion` |
| Secret | `IOS_CERTIFICATE_BASE64` | Celý `.p12` zakódovaný Base64 |
| Secret | `IOS_CERTIFICATE_PASSWORD` | Heslo k `.p12` |
| Secret | `IOS_PROFILE_BASE64` | Celý `.mobileprovision` zakódovaný Base64 |

Pro převod souborů do Base64 v PowerShellu (cesty nahraď skutečnými):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\podpis\distribution.p12')) | Set-Clipboard
# Vlož do secretu IOS_CERTIFICATE_BASE64.
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\podpis\aktion.mobileprovision')) | Set-Clipboard
# Vlož do secretu IOS_PROFILE_BASE64.
```

Spusť **Actions → iOS app → Run workflow** a zapni **signed**. Podepsané buildy se spouštějí pouze ručně; pull requesty nemají důvod dostávat přístup k podpisovým údajům. Workflow ověří shodu App ID, platnost profilu a přítomnost registrovaných zařízení, pak vyexportuje IPA. Certifikát a profil nejsou součástí artefaktu vedle IPA, profil je ale přirozeně zabalený uvnitř podepsané aplikace.

**Instalace podepsaného IPA je samostatný krok.** Stažení artefaktu v Safari aplikaci nenainstaluje. Bez Macu lze zajistit OTA distribuci pomocí HTTPS hostingu IPA a instalačního manifestu, případně vhodného distribučního nástroje, který zachová podpis. Workflow zatím hosting ani OTA manifest nezřizuje. Pro první instalaci použij větev AltStore výše; pro Ad Hoc instalaci společně vybereme dostupný HTTPS hosting. Ad Hoc aplikace také potřebuje obnovení po expiraci profilu, nejde o trvalou instalaci navždy.

## 4. Nastavení účtu a Zkratky v iPhonu

1. Otevři aplikaci **Aktion Vrata** a přihlas se. Telefon potřebuje internetové nebo síťové spojení se zadaným serverem Aktion.
2. V panelu **Zkratka pro iPhone** vyber konkrétní vrata. Relé se pro tuto akci nenabízejí.
3. Pro používání se zamčeným telefonem výslovně zaškrtni volbu **Povolit také akci „Otevřít vrata z auta“ při zamčeném telefonu**. Tato akce může být vyvolána bez ověření totožnosti hlasem přes Siri; identitou vůči Aktionu zůstává uložený účet.
4. Klepni na **Uložit účet a vrata pro Zkratky**. Teprve tím se účet, heslo/PIN, ID zařízení a vybraná vrata uloží do Klíčenky. Webové úložiště je nedostane.
5. V aplikaci **Zkratky** vytvoř zkratku a vyhledej akce aplikace Aktion Vrata:
   - **Otevřít uložená vrata** vyžaduje ověření uživatele.
   - **Otevřít vrata z auta** nevyžaduje ověření a provede se jen při výslovném povolení v uloženém nastavení.
6. Pojmenuj ji například „Otevřít vjezd“. V CarPlay spusť Siri a vyslov jméno zkratky v jazyce, který máš pro Siri nastavený. Rozpoznání českého názvu závisí na podpoře jazyka Siri; může být praktičtější anglický název.

Po restartu musíš iPhone alespoň jednou odemknout, aby byla Klíčenka dostupná. Zkratka není automatizace při připojení CarPlay; vrata se sama při připojení auta neotevírají.

Každé spuštění Zkratky vytvoří čerstvou relaci, přihlásí uložený účet, načte jeho aktuální oprávnění a odešle právě jeden příkaz pro uložené ID. Příkaz se při ztrátě odpovědi automaticky neopakuje. Potvrzení serveru neznamená ověřenou fyzickou polohu vrat. Délka navázání spojení a dostupný čas pro App Intent se musí ověřit na reálném připojení.

**Smazat uložené nastavení** odstraní profil z Klíčenky a zakáže další spuštění Zkratky; právě aktivní přihlášení v aplikaci ponechá do odhlášení. **Odhlásit se** odstraní aktivní přihlášení i uložený profil. Odinstalace aplikace sama o sobě nemusí odstranit položku Klíčenky; před odinstalací použij smazání v aplikaci.

## Soubory a ověření

- `app/public/`: jediné zdroje webového rozhraní.
- `mobile/prepare.mjs`: kopírování webu do generovaného balíčku, bez bundleru a npm závislostí.
- `mobile/iOS/`: obal WKWebView, omezený most, Klíčenka, účet a App Intents.
- `mobile/Core/`: Swift Package s protokolem RSA/AES a testy bez fyzických vrat.
- `mobile/project.yml`: XcodeGen specifikace projektu.
- `.github/workflows/ios.yml`: Windows testy, macOS testy, archivace a export IPA.

Swift testy ověřují AES proti pevnému vektoru ze stávající Node implementace, skutečnou RSA výměnu s lokálním simulovaným protějškem, identitu účtu, zachování číselného ID dveří, odmítnutí cizího ID, expiraci relace a neopakování příkazu při chybě. Windows testy ověřují webový i nativní transport a sdílený řadič UI.

Implementace zatím nebyla sestavena na macOS ani vyzkoušena na zařízení. První úspěšný běh GitHub workflow a test na iPhonu jsou nutné před běžným používáním. Při vývoji nebyly odeslány žádné příkazy fyzickým vratům.

Původní server používá HTTP. iOS obal kvůli kompatibilitě dovoluje HTTP v URLSession; nezakazuje ověřování certifikátů HTTPS. Pokud správce poskytne HTTPS adresu, nastav ji. Podporováno je standardní přihlášení a PIN; OAuth/SSO není implementováno.

Podklady: [Podepisování v GitHub Actions](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications), [Ad Hoc profily Apple](https://developer.apple.com/help/account/provisioning-profiles/create-an-ad-hoc-provisioning-profile), [ověření App Intent](https://developer.apple.com/documentation/appintents/appintent/authenticationpolicy).
