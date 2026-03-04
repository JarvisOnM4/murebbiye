# Decision: Zeus → CLI Pivot for LLM Backend

**Date**: 2026-03-04
**Status**: Active
**Context**: AWS GPU quota requests (us-east-1 + us-east-2) pending with no action from Amazon.

## Problem

`llm.ts` expects Zeus Gateway (OpenAI-compatible proxy on AWS GPU spot instances). Zeus is unavailable — quota cases 177187097100968 and 177187110900613 stalled. Mürebbiye is blocked on LLM access.

## Decision

Replace Zeus dependency with `claude_cli` and `codex_cli` for the current development phase.

### Two-tier strategy:

| Phase | LLM Usage | Backend |
|-------|-----------|---------|
| **Now (Phase 0-1)** | Content generation, lesson drafting, media descriptions | `claude_cli` / `codex_cli` (batch, offline) |
| **Deploy (Phase 2+)** | Runtime student assistant, interactive features | Anthropic API direct OR AWS Bedrock (decision deferred) |

### Rationale

- Phase 0-1 is all content creation — no runtime API needed
- CLI tools are free (covered by existing Claude subscription)
- Avoids blocking mürebbiye on Zeus infrastructure
- When Phase 2 arrives, we choose between:
  - **Anthropic API**: Direct, simpler, no AWS dependency for LLM
  - **AWS Bedrock**: Already in CDK stack, Claude Haiku at ~$5-10/mo
  - **Zeus**: If quotas approved by then, cheapest option

### What changes now

- `llm.ts` is NOT modified yet (no runtime LLM needed in Phase 0-1)
- Content generation scripts will call `claude_cli --print` or `codex_cli`
- Architecture docs updated to reflect CLI-first development mode
- When deploying, `llm.ts` will be updated to support Anthropic API as primary, Bedrock as fallback

## Impact

- No infrastructure cost for LLM during development
- Content creation can start immediately
- No code changes to existing platform — CLI is used externally
