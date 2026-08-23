# Podpisywanie i notaryzacja MadCAD na macOS

Oficjalna paczka macOS musi być podpisana certyfikatem `Developer ID Application`, zaakceptowana przez usługę notaryzacji Apple i ostemplowana biletem Gatekeepera. Zwykły certyfikat `Apple Development` nie nadaje się do dystrybucji poza Xcode.

## Wymagania Apple

1. Aktywne członkostwo Apple Developer Program.
2. Certyfikat `Developer ID Application` utworzony w Apple Developer → Certificates, Identifiers & Profiles.
3. Certyfikat wraz z kluczem prywatnym wyeksportowany z Pęku kluczy jako chroniony hasłem plik `.p12`.
4. Klucz zespołu App Store Connect API z rolą App Manager, zapisane Key ID i Issuer ID oraz pobrany jeden raz plik `.p8`.

Klucza prywatnego, pliku `.p12`, `.p8` ani ich haseł nie wolno dodawać do repozytorium.

## Sekrety GitHub Actions

W ustawieniach repozytorium należy utworzyć:

| Sekret | Zawartość |
|---|---|
| `MACOS_CERTIFICATE_P12_BASE64` | plik `.p12` zakodowany pojedynczą linią Base64 |
| `MACOS_CERTIFICATE_PASSWORD` | hasło eksportu `.p12` |
| `APPLE_API_KEY_P8` | pełna zawartość pliku `AuthKey_*.p8` |
| `APPLE_API_KEY_ID` | dziesięcioznakowy identyfikator klucza |
| `APPLE_API_ISSUER_ID` | Issuer ID zespołu App Store Connect |

Sekrety można wprowadzić bez umieszczania ich w historii powłoki:

```sh
base64 < DeveloperID.p12 | tr -d '\n' | gh secret set MACOS_CERTIFICATE_P12_BASE64
gh secret set MACOS_CERTIFICATE_PASSWORD
gh secret set APPLE_API_KEY_P8 < AuthKey_XXXXXXXXXX.p8
gh secret set APPLE_API_KEY_ID
gh secret set APPLE_API_ISSUER_ID
```

## Blokady bezpieczeństwa wydania

Workflow wydania kończy się błędem, jeśli brakuje któregokolwiek sekretu macOS. Po zbudowaniu rozpakowuje paczkę i obowiązkowo sprawdza:

- integralność podpisu `codesign --verify --deep --strict`;
- urząd certyfikacji `Developer ID Application` i dziesięcioznakowy Team ID;
- dołączony bilet Apple przez `xcrun stapler validate`;
- akceptację aplikacji przez Gatekeepera za pomocą `spctl --assess`;
- sumę SHA-256 gotowego archiwum.

Windows pozostaje niepodpisany do czasu pozyskania osobnego certyfikatu Authenticode lub usługi Trusted Signing. Certyfikat Apple nie może podpisać instalatora Windows.
