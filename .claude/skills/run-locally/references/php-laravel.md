# PHP / Laravel — Run Locally

## Detection
File: `composer.json`

## Pre-flight
Check `vendor/` exists; if missing, run `composer install`:
```bash
[ -d "vendor" ] || composer install
```

Check `.env` exists:
```bash
[ -f ".env" ] || (cp .env.example .env && php artisan key:generate)
```

---

## Build
```bash
composer install --no-interaction
```
For a compiled frontend (if `package.json` also present):
```bash
npm install && npm run build 2>/dev/null || true
```
Success signal: `Generating autoload files` + exit 0

## Test
```bash
composer run test
```
Or directly:
```bash
php artisan test --parallel 2>/dev/null || php artisan test
```
Success signal: `PASS` / `Tests: X passed`
Failure: `FAIL` / `Tests: X failed`

## Run
```bash
php artisan serve --host=0.0.0.0 --port=8000
```
Startup signal: `Starting Laravel development server`
Port: 8000
Log file: `/tmp/run-locally-laravel.log`

If the project uses Docker Compose for local development:
```bash
docker-compose up
```
Check for `docker-compose.yml` first and prefer it if present.

## Health check
```bash
curl -s http://localhost:8000/api/v1/health 2>/dev/null | head -1
```
