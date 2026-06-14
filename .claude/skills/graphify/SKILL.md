---
name: graphify
description: "Use this skill to generate or refresh the project's knowledge graph, open the visual explorer, or run a quick structural query. Triggers: /graphify, 'generate graph', 'refresh graph', 'open graph', 'show graph', 'analyze codebase structure', 'build knowledge graph', 'what is the structure of this project'. For deep structural questions (impact analysis, dependency tracing, cross-cutting changes), use the graphify-explorer agent which queries the graph via MCP tools. This skill handles generation and visual inspection."
---

# Graphify — Knowledge Graph for This Project

Generates and manages the project's knowledge graph. Three modes: **generate**, **view**, **query**.

Graphify runs fully offline — no API keys required. Uses tree-sitter AST parsing for code analysis.

---

## Prerequisites

Verify graphify is installed:

```bash
graphify --version 2>/dev/null && echo "OK" || echo "MISSING — run: uv tool install graphifyy && graphify install"
```

If missing, stop and report the install command. Do not proceed.

---

## MODE 1 — Generate / Refresh the Graph

Run from the project root:

```bash
graphify analyze .
```

This produces three artifacts (all gitignored):
- `graph.html` — visual interactive explorer
- `GRAPH_REPORT.md` — human-readable architectural summary
- `graph.json` — machine-readable graph (consumed by MCP tools)

Wait for completion before reporting. Typical runtime: 30–120 seconds depending on project size.

After generation, read and summarize `GRAPH_REPORT.md`:
- Top-level stats: node count, edge count, component count
- Most connected nodes (architectural hubs)
- Any cycles detected
- Any orphaned modules

---

## MODE 2 — View the Graph

```bash
open graph.html
```

If `graph.html` doesn't exist, run MODE 1 first.

---

## MODE 3 — Quick Query (no MCP needed)

For simple lookups when the graphify-explorer agent is not needed:

```bash
# Count nodes by type
cat graph.json | python3 -c "
import json, sys
g = json.load(sys.stdin)
types = {}
for n in g.get('nodes', []):
    t = n.get('type', 'unknown')
    types[t] = types.get(t, 0) + 1
for t, c in sorted(types.items(), key=lambda x: -x[1]):
    print(f'  {c:4d}  {t}')
"

# Find nodes matching a name pattern (replace PATTERN)
PATTERN="DynamoDb"
cat graph.json | python3 -c "
import json, sys, re
g = json.load(sys.stdin)
hits = [n for n in g.get('nodes', []) if re.search(r'${PATTERN}', n.get('id',''), re.I)]
for n in hits[:20]:
    print(n.get('id'), '—', n.get('type',''))
"
```

For complex queries (callers, paths, impact surfaces), use the graphify-explorer agent.

---

## Staleness Check

Warn if the graph is >7 days old:

```bash
[ -f graph.json ] && find . -maxdepth 1 -name "graph.json" -mtime +7 \
  && echo "STALE — consider regenerating with: graphify analyze ." \
  || echo "Graph is current."
```

---

## Output Report

After MODE 1, report in this format:

```
GRAPHIFY — <project-name>
  Generated: <datetime from GRAPH_REPORT.md>
  Nodes: <N> (<breakdown: N files, N classes, N functions>)
  Edges: <N>
  Cycles: <N detected / none>
  Hubs: <top 3 most-connected node names>
  Report: GRAPH_REPORT.md (read for full analysis)
  Visual: graph.html — open with: open graph.html
```
