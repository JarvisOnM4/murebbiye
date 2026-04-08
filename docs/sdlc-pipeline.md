# SDLC Pipeline — Agent Roles & Responsibilities

## Pipeline Flow

```
Eren (requirement) → Orchestrator → Engineer → Inspector → QA Engineer → Ship
```

## Role Definitions

### 1. SDLC Orchestrator
**Input**: User requirement or board card
**Output**: Implementation plan + acceptance criteria + test plan for QA
**Responsibilities**:
- Break requirement into tasks
- Write acceptance criteria (what "done" looks like)
- Write detailed test plan for QA Engineer (checklist format)
- Assign tasks to correct engineer (frontend/backend)
- Review QA results and decide ship/no-ship
- The test plan must cover: happy path, edge cases, error states, UX expectations, performance

### 2. Frontend Specialist / Backend Engineer
**Input**: Implementation plan from Orchestrator
**Output**: Working code
**Responsibilities**:
- Read existing code before changing anything
- Follow project patterns and conventions
- CSS only changes don't need component restructuring
- Run typecheck after every change
- Don't break existing functionality

### 3. Inspector
**Input**: Code changes from Engineer
**Output**: Review report + fixes
**Responsibilities**:
- Verify code correctness (types, logic, edge cases)
- Check CSS consistency (flex/grid chains, overflow, min-height: 0)
- Check for regressions
- Fix issues directly — don't just report
- Verify responsive behavior

### 4. QA Release Engineer
**Input**: Test plan from Orchestrator + built feature
**Output**: PASS/FAIL report with evidence
**Responsibilities**:
- Execute EVERY item in the test plan
- For each item: test it, report result with evidence
- If FAIL: describe exactly what's wrong, what was expected vs actual
- Run automated checks: typecheck, lint, asset verification, API responses
- Test as a USER would — click through the flow, not just check code
- Check browser console for errors
- Test responsive layouts at specific widths
- DO NOT skip items — if you can't test something, say why

### 5. Kael (Orchestrator of Orchestrators)
- Spawns the pipeline agents
- Provides context from memory, board, requirements
- Routes the Orchestrator's output to the right agents
- Handles cross-cutting concerns (memory, board updates, git)
- Only intervenes when agents are stuck or need domain knowledge

## Test Plan Template (Orchestrator writes this)

```markdown
# Test Plan: [Feature Name]

## Context
[What was built, why, user's exact words]

## Acceptance Criteria
- [ ] AC1: [specific, testable outcome]
- [ ] AC2: ...

## Test Cases

### Happy Path
- [ ] TC1: [action] → [expected result]
- [ ] TC2: ...

### Edge Cases
- [ ] TC3: [unusual input] → [expected behavior]
- [ ] TC4: ...

### Error States
- [ ] TC5: [failure scenario] → [graceful handling]

### UX / Visual
- [ ] TC6: [layout check at specific viewport]
- [ ] TC7: [animation/transition check]

### Performance
- [ ] TC8: [load time / response time threshold]

## Environment
- URL: [test URL]
- Login: [credentials if needed]
- Viewport: [desktop/mobile widths to test]
```

## Requirement Sources

| Project | Source | How it arrives |
|---------|--------|----------------|
| Mürebbiye | Eren via CLI or board card | Direct instruction |
| R2 Freelance | Client proposal / job description | Orchestrator extracts requirements from the accepted proposal |
| MCP Products | Board card or demand signals from report-needs | Kael or Eren creates card |
| Agent Guardrail | Board card or marketplace feedback | Kael monitors |

**Freelance pipeline**: The accepted proposal IS the requirement. Orchestrator reads the proposal, extracts acceptance criteria, writes the implementation plan and test plan. The client never sees the internal pipeline — they get the deliverable.

## Anti-Patterns (What NOT to do)
- QA writing their own test plan (they execute, not design)
- Engineer skipping Inspector review
- Inspector only reading code without running it
- QA reporting "looks good" without testing each item
- Anyone shipping without QA sign-off
- Orchestrator writing vague acceptance criteria ("it should work well")
