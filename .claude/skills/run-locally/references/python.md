# Python — Run Locally (FastAPI / bordock)

## Detection
Files: `pyproject.toml`, `requirements.txt`, `Makefile`

## Pre-flight
Check virtual environment is active or exists:
```bash
# Activate if venv exists but not active
[ -d ".venv" ] && [ -z "$VIRTUAL_ENV" ] && source .venv/bin/activate
# Or conda
[ -n "$CONDA_DEFAULT_ENV" ] && echo "conda active: $CONDA_DEFAULT_ENV"
```

---

## FastAPI with Makefile (bordock pattern)

### Build
```bash
make build 2>/dev/null || echo "NO_MAKE_BUILD"
```
If no Makefile or no build target, skip (Python is interpreted — no compile step).

### Test
```bash
make test
```
If no Makefile test target: `pytest --tb=short`
Success signal: `passed`
Failure: `failed` or `error`

### Run
```bash
make start
```
If no Makefile: check for `docker-compose.yml`
```bash
docker-compose up
```
If neither: fall back to uvicorn:
```bash
uvicorn main:app --reload --port 8123
```
Startup signal: `Application startup complete` or `Uvicorn running on`
Port: 8123 (bordock) or 8000 (pan/generic) — read from env or config

---

## FastAPI with uvicorn (pan / simple pattern)

### Build
Skip — Python is interpreted.

### Test
```bash
# pan uses a smoke test pattern
curl -s http://localhost:8000/pan/health 2>/dev/null || echo "server not running yet"
pytest --tb=short 2>/dev/null || echo "no pytest tests"
```

### Run
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Startup signal: `Application startup complete`
Port: 8000

---

## Health check
```bash
curl -s http://localhost:<port>/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d)"
```
