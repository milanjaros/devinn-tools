# Lokální ovládání vrat Aktion

Vyžaduje Node.js 22 nebo novější, bez dalších balíčků a instalací.

1. Spusť `Start.cmd` (nebo `node server.mjs`).
2. Otevři http://127.0.0.1:8787.
3. Zadej svůj účet Aktion a heslo, případně zvol přihlášení PINem.
4. Po načtení seznamu klikni na Otevřít u správného vstupu. Tlačítko ihned odešle skutečný příkaz.

Server běží pouze na 127.0.0.1. Ukončení: Ctrl+C v jeho okně. Jiný port: nastav proměnnou `PORT` před spuštěním.
Výchozí adresa Aktionu je http://213.168.177.207:8090, lze ji změnit ve formuláři. K Aktionu se aplikace připojí až po odeslání přihlášení.

## Vyzkoušení bez vrat

Spusť `Demo.cmd` nebo `node server.mjs --demo`. Přihlášení `demo` / `demo`. Demo používá místní simulaci výměny RSA a AES a nikdy nekomunikuje se skutečným serverem. Spouštěj buď demo, nebo ostrý režim; oba používají port 8787.

## Protokol a omezení

Implementace vychází z JavaScriptu v dodaném aktion.ipa: RSAES-PKCS1-v1_5, textový klíč relace, CryptoJS/OpenSSL AES-256-CBC, EVP_BytesToKey s MD5. Metody -1/-2 navazují relaci, 0 přihlašuje, 1 načítá dveře a 2 předává Id vybraného vstupu.

Přihlášení potřebuje platný účet a oprávnění serveru. Podporováno je standardní přihlášení (0) a PIN (4); OAuth/SSO není implementováno. U vazby na zařízení lze vyplnit správcem přidělené HwId. Jinak klient generuje nové ID pro připojení. Účet, heslo a klíče zůstávají v paměti procesu, neukládají se na disk ani do úložiště prohlížeče. Prohlížeč dostává pouze identifikátor lokální relace. Relace se po 30 minutách nečinnosti při dalším požadavku odstraní; restart odstraní všechny relace.

IsEnabled u relé znamená aktuální stav, nikoli zákaz ovládání. Přepínací relé má tlačítko Přepnout. Odpověď serveru potvrzuje přijetí příkazu, nikoli fyzickou polohu vrat. Při chybě nebo ztrátě odpovědi se příkaz automaticky neopakuje. Při vypršení relace se znovu přihlas.

Původní protokol používá HTTP a veřejný RSA klíč neposkytuje ověření identity serveru. Aplikace tento protokol reprodukuje. Pokud správce poskytuje HTTPS adresu, můžeš ji použít ve formuláři.

## Diagnostické logy

Při spuštění přes `Start.cmd`, `Demo.cmd` nebo `node server.mjs` se logy automaticky zapisují do `app/logs/aktion-RRRR-MM-DD.jsonl` (datum a čas UTC). Každý řádek je samostatný JSON. Po změně kódu je nutné server restartovat. Starší pokusy před zavedením logování nelze zpětně obnovit.

Log obsahuje náhodné diagnostické `trace`, metodu a číslo příkazu, HTTP stav, délky a trvání, typ dešifrované odpovědi, vybrané názvy polí, číselný kód chyby a krok selhání. Metody -1/-2 znamenají získání RSA klíče a výměnu AES klíče; 0 přihlášení, 1 seznam, 2 otevření. Hodnoty textových odpovědí, těla požadavků, hesla, uživatelská jména, session ID, klíče a tokeny se neukládají. Booleovské a číselné odpovědi se zaznamenají, aby šlo rozlišit např. `false` od očekávaného objektu.

Denní soubor se při dosažení 5 MiB přesune na `.jsonl.previous` (předchozí záloha stejného dne se přepíše). Soubory z jiných dnů zůstávají zachované. Chyba zápisu se zobrazí v konzoli. Logy nejsou dostupné přes webové API.

Poslední záznamy lze přečíst v PowerShellu z adresáře `app`:

```powershell
Get-Content -Encoding UTF8 (Get-ChildItem .\logs\*.jsonl | Sort-Object LastWriteTime | Select-Object -Last 1).FullName -Tail 40
```

## Spuštění testů

`node app.test.mjs` spouští lokální testy včetně výměny RSA, AES, přihlášení, seznamu a příkazu proti simulaci. Test kompatibility navíc použije CryptoJS z rozbaleného IPA v `../analysis/extracted`. Skutečný server ani vrata nejsou součástí testů.
