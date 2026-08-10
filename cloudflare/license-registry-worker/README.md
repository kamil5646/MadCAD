# MadCAD License Registry Worker

Cloudflare Worker, który udostępnia publiczny rejestr licencji dla aplikacji oraz prywatny endpoint aktualizacji dla panelu admin.

## Endpointy

- `GET /v1/license-registry` - publiczny odczyt rejestru (dla aplikacji)
- `POST /v1/license-registry` - prywatna aktualizacja rejestru (Bearer token)
- `POST /v1/license-tokens/issue-private` - wystawienie tokenu private (self-service)
- `POST /v1/license-tokens/verify` - weryfikacja tokenu przez aplikację desktop
- `POST /v1/paypal/create-order` - utworzenie zamówienia PayPal dla licencji commercial
- `POST /v1/paypal/capture-order` - finalizacja płatności PayPal i wystawienie tokenu commercial
- `GET /healthz` - health check

## Wymagania

- Cloudflare account
- `wrangler login`

## Setup

1. Wejdź do katalogu worker:

```bash
cd cloudflare/license-registry-worker
npm install
```

2. Utwórz KV namespace:

```bash
npx wrangler kv namespace create LICENSE_REGISTRY_KV
```

3. Wklej zwrócony `id` do `wrangler.toml` (`[[kv_namespaces]].id`).

4. Ustaw sekret admina (token używany tylko przez panel admin):

```bash
npx wrangler secret put ADMIN_TOKEN
```

5. (Opcjonalnie) skonfiguruj PayPal:

```bash
npx wrangler secret put PAYPAL_CLIENT_ID
npx wrangler secret put PAYPAL_SECRET
```

W `wrangler.toml` możesz dodać opcjonalne zmienne:

- `PAYPAL_API_BASE` - np. `https://api-m.sandbox.paypal.com` (sandbox) lub pominąć dla production
- `PAYPAL_COMMERCIAL_AMOUNT` - domyślna cena, np. `99.00`
- `PAYPAL_CURRENCY` - np. `USD`, `PLN`
- `PAYPAL_COMMERCIAL_DURATION_DAYS` - np. `365` (0 = bez terminu)
- `PAYPAL_RETURN_URL` i `PAYPAL_CANCEL_URL` - URL powrotu/anulowania (jeśli używasz redirect flow)

6. Deploy:

```bash
npm run deploy
```

## Użycie z frontendem

W panelu admin na stronie MadCAD wpisz:

- URL API: `https://<twoj-worker>.workers.dev/v1/license-registry`
- Admin token: ten sam co `ADMIN_TOKEN`

Po tym każda zmiana tokenów w panelu będzie automatycznie wysyłana do Workera.

## Użycie z aplikacją desktop

Po pierwszym deployu zaktualizuj plik:

- `docs/license-endpoints.json`

Dodaj tam URL endpointu Workera, np.:

```json
{
  "version": 2,
  "updatedAt": "2026-03-08T19:03:00Z",
  "verifyUrls": [
    "https://<twoj-worker>.workers.dev/v1/license-tokens/verify"
  ],
  "registryApiUrls": [
    "https://<twoj-worker>.workers.dev/v1/license-registry"
  ]
}
```

Aplikacja pobiera ten plik dynamicznie, więc nie wymaga nowego buildu po zmianie URL backendu.

## Uwaga o stanie licencjonowania w aplikacji (madcad-2d)

Od wersji `5.7.2` aplikacja desktop ma **tymczasowo wyłączony** ekran aktywacji licencji (patrz
`madcad-2d/README.md`). Ten Worker i rejestr tokenów pozostają w pełni funkcjonalne i niezmienione -
wyłączenie dotyczy wyłącznie warstwy UI po stronie aplikacji desktop.
