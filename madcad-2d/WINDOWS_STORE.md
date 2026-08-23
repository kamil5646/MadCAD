# Darmowa dystrybucja MadCAD przez Microsoft Store

Microsoft Store podpisuje po certyfikacji pakiety AppX/MSIX własnym zaufanym certyfikatem. Nie dotyczy to instalatora NSIS `.exe` pobieranego z GitHub Releases — ten pozostaje osobnym kanałem i wymagałby płatnego Authenticode.

## Konto i rezerwacja nazwy

1. Rozpocznij nowe, bezpłatne konto deweloperskie na `https://storedeveloper.microsoft.com/`.
2. Wybierz typ konta zgodny z rzeczywistym statusem wydawcy. Microsoft opisuje konto indywidualne jako przeznaczone dla działalności hobbystycznej i niekomercyjnej; publikacja związana z działalnością wymaga zweryfikowanego konta Company.
3. W Partner Center otwórz Apps and Games i zarezerwuj nazwę `MadCAD`.
4. Na stronie Product identity skopiuj dokładnie wartości Package/Identity/Name oraz Package/Identity/Publisher.

Nie należy zgadywać tych wartości. Microsoft odrzuci paczkę, jeśli manifest nie odpowiada tożsamości przypisanej do produktu.

## Build techniczny

Build testowy używa nieprodukcyjnej tożsamości `MadCAD2D.StoreTest` i wydawcy `CN=ms`:

```sh
npm run dist:win:store
npm run verify:package -- windows-store
```

Taki pakiet służy wyłącznie do kontroli struktury i nie powinien być wysyłany do Partner Center.

## Build do wysłania

Wartości skopiowane z Product identity należy przekazać przez środowisko:

```powershell
$env:MADCAD_STORE_SUBMISSION = "1"
$env:MADCAD_STORE_IDENTITY_NAME = "wartość Package/Identity/Name"
$env:MADCAD_STORE_PUBLISHER = "wartość Package/Identity/Publisher"
npm run dist:win:store
$env:MADCAD_REQUIRE_STORE_IDENTITY = "1"
npm run verify:package -- windows-store
```

Gotowy plik `release/MadCAD-*-win-x64.appx` można przesłać jako pakiet aplikacji. Po przejściu certyfikacji Microsoft zastępuje podpis swoim certyfikatem.

## Zachowanie aplikacji Store

- pakiet deklaruje tylko wymagane dla Electron `runFullTrust`;
- logotypy kafelków pochodzą z podstawowego logo MadCAD;
- interfejs polski i angielski są zadeklarowane w manifeście;
- własny aktualizator GitHub jest wyłączony, ponieważ aktualizacje instaluje Microsoft Store;
- zwykłe wydanie `.exe` i jego aktualizator pozostają niezależne.
