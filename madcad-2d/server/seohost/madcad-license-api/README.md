# MadCAD License API for SEOHost

Deploy this directory as `public_html/api/madcad/v1`. The API creates its JSON store outside the public document root in `private_data/madcad-licensing`, locks every read/write transaction, hashes passwords with PHP `password_hash`, stores only SHA-256 hashes of random session tokens and rate-limits registration and login attempts.

Required hosting capabilities: HTTPS, PHP 7.4+ with JSON, mbstring and password hashing, and write access to the domain-level `private_data` directory.

The desktop application uses only HTTPS and never stores a password. Its session token is encrypted using Electron `safeStorage`. Personal use remains available without an account. Commercial trial and commercial entitlements are authoritative on this service, limited by named user and active device count, and cached for 30 days of offline work.

Password recovery sends a single-use, 60-minute token using the hosting PHP mail transport. Configure and test delivery for `noreply@madmagsystem.pl`; changing a password invalidates every existing session. The request endpoint always returns the same public message, whether or not the account exists.

After deployment, POST `{}` to `/health`. Treat the deployment as ready only when it returns `{"ok":true,"service":"madcad-license"}` over HTTPS. A browser GET intentionally returns 405.

## Commercial-plan administration

Create `private_data/madcad-licensing/admin.secret` outside `public_html` with one random value containing at least 32 characters. Never commit or place that value under `public_html`. Administrative requests are POST JSON and pass it as `adminToken`:

- `/admin/users` lists accounts, current entitlement, and devices without password hashes or session tokens.
- `/admin/grant-commercial` accepts `email`, `seats`, and optional ISO `expiresAt` (empty means no expiry).
- `/admin/revoke-commercial` accepts `email`.
- `/admin/revoke-device` accepts `email` and `installationId`.

The administrative secret belongs only in the private hosting directory or an administrator password manager. The desktop app must never receive it, so a user cannot promote their own account by changing a request.

Open `/api/madcad/v1/admin.html` to use the no-dependency administration page. It keeps the secret only in memory for the lifetime of the tab, renders all server values with `textContent`, and is protected by a restrictive Content Security Policy. Remove access to the page at the reverse proxy if administration will be performed exclusively through direct API calls.
