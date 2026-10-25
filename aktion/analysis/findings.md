Analýza aktion.ipa

Balíček obsahuje Cordova aplikaci a čitelný (obfuskovaný) JavaScript.
Zdroj komunikace: extracted/Payload/Aktion.app/www/js/comm.js.
Pomocný výpis s dekódovanými řetězci: decoded/comm.js.decoded.js (pouze pro čtení, nespouštět).

Potvrzeno z kódu:
- MethodType -1 získává veřejný RSA klíč.
- MethodType -2 předává SessionId a RSA šifrované AesKey.
- RSAEncrypt používá pkcs1pad2, tedy RSAES-PKCS1-v1_5.
- getSessionKey generuje CryptoJS.MD5(randomText(20,30)).toString().
- Klíč je předáván jako textové heslo CryptoJS.AES.encrypt(JSON.stringify(request), getSessionKey()).
- Obal požadavku je JSON s data = SessionId + výsledek šifrování.
- MethodType 0 = přihlášení, 1 = seznam dveří, 2 = otevření dveří.
- Při MethodType 2 je MethodData rovno Id vybraných dveří.
- Běžné požadavky zahrnují LoginName, Password, LoginType, MethodType, Version, Language, CommandId a MethodData.
- LoginName a Password se čtou z lokálního úložiště; pro LoginType 8 se používají accessToken a idToken.

Zachycený RSA ciphertext neposkytuje původní klíč relace. Historickou komunikaci nelze na základě těchto nálezů samotných dešifrovat.
Vlastní klient může založit novou relaci s vlastním klíčem; stále potřebuje platné přihlašovací údaje a oprávnění.
Nebyl kontaktován server ani odeslán příkaz bráně. Kompatibilita se skutečným serverem nebyla testována.
