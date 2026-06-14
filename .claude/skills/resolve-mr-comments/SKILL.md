---
name: resolve-mr-comments
description: "Resolve open MR/PR review comments: fetch comments from GitLab, analyze each one, fix valid issues or explain false positives, commit, push, and reply on the MR. Use this skill when the user asks to resolve, address, or fix MR comments, review feedback, or code review notes from a merge request. Requires the MR URL as input (e.g. https://gitlab.com/org/project/-/merge_requests/123)."
---

# Resolve MR Comments

Systematically resolve all open review comments on a GitLab merge request: analyze each comment, fix valid issues, explain false positives, commit, push, and reply.

## Prerequisites

- `ANALITIKA_GITLAB_TOKEN` environment variable must be set (GitLab personal/project access token with `api` scope)
- `curl` and `jq` available on PATH
- You must be inside the git repository for the MR

## Process

```
Parse MR URL → extract project path + MR number
        |
        v
Fetch open discussions via GitLab API (curl + token)
        |
        v
Checkout the MR source branch
        |
        v
For each unresolved comment: read the code at the referenced location
        |
        v
Analyze: valid issue or false positive?
        |
        v
Fix valid issues / prepare explanations for false positives
        |
        v
Run project verification checks
        |
        v
Commit and push fixes
        |
        v
Reply in-thread and resolve each discussion on the MR
```

## Step 1: Parse the MR URL

Extract the GitLab host, project path, and MR number from the URL.

```
https://gitlab.com/org/subgroup/project/-/merge_requests/42
  host:    gitlab.com
  project: org/subgroup/project   (URL-encode as org%2Fsubgroup%2Fproject)
  mr:      42
```

URL-encode the project path (replace each `/` with `%2F`):

```bash
PROJECT_ENCODED=$(echo "$PROJECT_PATH" | python3 -c "import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read().strip(), safe=''))")
```

Verify the token is set:
```bash
: "${ANALITIKA_GITLAB_TOKEN:?ANALITIKA_GITLAB_TOKEN is not set}"
```

## Step 2: Fetch Unresolved Discussions

Use the GitLab **discussions** API (not the notes API) — discussions include the thread ID needed for replying and resolving.

```bash
curl -s -H "PRIVATE-TOKEN: $ANALITIKA_GITLAB_TOKEN" \
  "https://${GITLAB_HOST}/api/v4/projects/${PROJECT_ENCODED}/merge_requests/${MR_NUMBER}/discussions?per_page=100" \
  | jq '.[] | select(.notes[0].resolvable == true and .notes[0].resolved == false)'
```

For each unresolved discussion, extract:
- **`discussion.id`** — needed for replying in-thread and resolving
- **`discussion.notes[0].id`** — the original review comment
- **`discussion.notes[0].author.username`**
- **`discussion.notes[0].position.new_path`** — file path
- **`discussion.notes[0].position.new_line`** — line number
- **`discussion.notes[0].body`** — the comment text

If a discussion has no `position` (general MR comment, not on a file), it still needs a reply but has no specific code location to examine.

## Step 3: Check Out the MR Branch

Fetch the source branch name from the MR:

```bash
SOURCE_BRANCH=$(curl -s -H "PRIVATE-TOKEN: $ANALITIKA_GITLAB_TOKEN" \
  "https://${GITLAB_HOST}/api/v4/projects/${PROJECT_ENCODED}/merge_requests/${MR_NUMBER}" \
  | jq -r '.source_branch')

git checkout "$SOURCE_BRANCH"
git pull origin "$SOURCE_BRANCH"
```

If the branch is already checked out in a worktree, work from that worktree path instead.

## Step 4: Analyze Each Comment

For each unresolved comment:

1. **Read the code** at the referenced file and line — never assume what the code does
2. **Understand the surrounding context** — read the wider file, related interfaces, base classes, callers
3. **Classify** as one of:
   - **Valid issue** — real problem that should be fixed
   - **False positive** — code is correct, but reviewer may have missed context (e.g., error handling exists upstream, a pattern is intentional by architecture decision)
   - **Improvement suggestion** — valid but optional; respect the reviewer's judgment on whether to implement

When analyzing, look beyond the immediate flagged line. Things to verify:
- Error handling: is it handled upstream or by the framework?
- State management: is there a single source of truth already?
- Thread/concurrency safety
- Architecture compliance: does the suggested change fit the project's layering (e.g., clean arch domain → application → infrastructure)?

## Step 5: Fix Valid Issues

For each valid issue:
- Make the minimum change that addresses the reviewer's concern
- Follow the project's established architecture patterns
- If the fix touches an interface, update all implementations
- If working in a worktree, ensure all edits target the worktree path

## Step 6: Verify Changes

Detect what verification is available and run it on modified modules:

```bash
# Detect and run the appropriate check
if ./gradlew tasks --all 2>/dev/null | grep -q 'ktlintCheck'; then
  # Kotlin project with ktlint
  ./gradlew :<module>:ktlintCheck || ./gradlew :<module>:ktlintFormat
elif [ -f "./gradlew" ]; then
  # Kotlin/JVM project without ktlint — run tests
  ./gradlew test
fi
```

Fix any errors before committing.

## Step 7: Commit and Push

Stage only the changed files and commit:

```bash
git add <changed-files>
git commit -m "<commit message>"
git push origin "$SOURCE_BRANCH"
```

Capture the commit hash immediately after (`git rev-parse --short HEAD`) — you'll reference it in replies.

**Commit message style** — follow the project's existing convention. Inspect recent commits with `git log --oneline -5` to determine which format is in use:
- Conventional: `fix(module): description` / `refactor(module): description`
- Bracketed: `[FIX] DIG-123 description`

## Step 8: Reply In-Thread and Resolve

Replies must go into the discussion thread, not as standalone MR notes. Use the **discussion notes** endpoint:

### Reply in the discussion thread

```bash
BODY="Your reply text here"

curl -s -X POST \
  -H "PRIVATE-TOKEN: $ANALITIKA_GITLAB_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"body\": $(echo "$BODY" | jq -Rs .)}" \
  "https://${GITLAB_HOST}/api/v4/projects/${PROJECT_ENCODED}/merge_requests/${MR_NUMBER}/discussions/${DISCUSSION_ID}/notes"
```

**For fixed issues:**
```
Fixed in <commit-hash>: <explanation of what changed and why>
```

**For false positives:**
```
<explanation with evidence — cite specific class names, method names, line numbers>
```

### Resolve the discussion

After replying, mark the thread as resolved:

```bash
curl -s -X PUT \
  -H "PRIVATE-TOKEN: $ANALITIKA_GITLAB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resolved": true}' \
  "https://${GITLAB_HOST}/api/v4/projects/${PROJECT_ENCODED}/merge_requests/${MR_NUMBER}/discussions/${DISCUSSION_ID}"
```

**Do NOT resolve** if:
- The answer is uncertain and needs reviewer confirmation
- It's an improvement suggestion you chose not to implement
- You need the reviewer's input before proceeding

### Reply quality

Keep replies:
- **Specific** — reference exact file paths, class/function names, line numbers
- **Evidence-based** — cite the code that supports your explanation
- **Concise** — one clear paragraph, no unnecessary preamble
- **Respectful** — acknowledge the reviewer's concern even when disagreeing

## Common Pitfalls

- **Pagination** — add `?per_page=100` to discussion API calls; for MRs with many threads, check for a `X-Next-Page` response header and loop
- **JSON body escaping** — use `jq -Rs .` to safely encode the reply body; never hand-roll JSON with user-supplied strings
- **Rate limits** — add a brief `sleep 0.5` between POST/PUT calls if you're resolving many discussions in rapid succession
- **Wrong endpoint** — replying to `merge_requests/<N>/notes` creates a standalone comment, not an in-thread reply; always use `discussions/<D>/notes`
