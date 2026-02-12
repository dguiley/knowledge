# Actionable Items Audit

**STATUS: ACTIONED** (2024-12-18)

Extracted from Dex's talk, mapped to Protocol OS coverage.

## Actions Taken

- ✅ Updated `agent-spawn` - modern Claude Code behavior, anti-patterns, return compression
- ✅ Updated `orchestrate` - Context Budget (Smart Zone), Trajectory Health sections
- ✅ Updated `plan-phases` - [detailed] requirements, Plan Quality Test (dumb model test)
- ✅ Created `anti-patterns` protocol in protocol-standards.md
- ✅ Created `ai-dev-philosophy` protocol in thinking/ai-dev-philosophy.md
- ✅ Added leverage hierarchy and quotes to `orchestrate.philosophy`
- ✅ Added Protocol differentiator diagram to `ai-dev-philosophy`
- ✅ Regenerated all protocol indexes

---

## RESEARCH Phase Actions

| # | Actionable Item | Current Protocol Coverage | Gap? |
|---|-----------------|---------------------------|------|
| R1 | Spawn sub-agents for exploration to avoid polluting main context | `agent-spawn` ✅ | No |
| R2 | Return succinct summary from sub-agent, not raw findings | `agent-spawn` partial - mentions "knowledge summary" | **Strengthen** - add explicit "compress before return" |
| R3 | Build research doc with exact files + line numbers | `research` ✅ mentions outputs | No |
| R4 | Create uncertainty map (what we know vs don't) | `research` ✅ has uncertainty map format | No |
| R5 | Use on-demand research over static docs (they lie) | `decision-context` ✅ "compress truth from code" | No |
| R6 | Research should be objective - stay in "teacher" persona | `rpi` ✅ phase personas | No |

**Research Gaps**: Minor - strengthen sub-agent return compression guidance.

---

## PLANNING Phase Actions

| # | Actionable Item | Current Protocol Coverage | Gap? |
|---|-----------------|---------------------------|------|
| P1 | Include actual code snippets in plans (not just descriptions) | `plan-phases` partial - mentions "rough pseudocode" | **Strengthen** - Dex shows real code in plans |
| P2 | Specify exact files and line numbers in plan steps | `plan-phases` partial - "[detailed]" level mentions files | **Strengthen** - make explicit |
| P3 | Include verification criteria per step | `plan-phases` ✅ mentions verification | No |
| P4 | Track assumptions with certainty levels | `plan-phases` ✅ explicit format | No |
| P5 | Flag LOW certainty assumptions as slop risk | `plan-phases` ✅ with ⚠️ marker | No |
| P6 | Keep later phases [rough] - don't over-detail future | `plan-phases` ✅ progressive detailing | No |
| P7 | Reference protocols (@proto:) not inline patterns | `plan-phases` ✅ explicit principle | No |
| P8 | Plan should be readable by "dumbest model" | NOT EXPLICIT | **Add** - clarity test |
| P9 | Human reviews plan BEFORE implementation | `orchestrate` ✅ gates by interaction level | No |

**Planning Gaps**:
- P1/P2: Strengthen guidance on code snippets and file specificity
- P8: Add "dumb model test" as quality check

---

## IMPLEMENTATION Phase Actions

| # | Actionable Item | Current Protocol Coverage | Gap? |
|---|-----------------|---------------------------|------|
| I1 | Monitor context budget, compact at 35-40% | `compact` partial - mentions 35% proactive | **Strengthen** - more prominent |
| I2 | Start fresh context if trajectory is bad (yelling pattern) | `stuck` partial - mentions recovery | **Add** - explicit trajectory check |
| I3 | Compact includes index (files, patterns, decisions) | `compact` ✅ explicit preservation | No |
| I4 | Log all implementation steps | `work-log` ✅ | No |
| I5 | Verify after each step before continuing | `orchestrate` ✅ implement loop | No |
| I6 | If stuck, check interaction level for escalation | `stuck` ✅ behavior by level | No |
| I7 | Don't batch - keep steps small and verified | NOT EXPLICIT | **Add** - step size guidance |

**Implementation Gaps**:
- I1: Make context budget monitoring more prominent
- I2: Add explicit "bad trajectory" detection and reset
- I7: Add guidance on step granularity

---

## GENERAL Session Actions

| # | Actionable Item | Current Protocol Coverage | Gap? |
|---|-----------------|---------------------------|------|
| G1 | Pick one tool, get reps (don't min-max across tools) | NOT IN PROTOCOLS | Philosophy only |
| G2 | Match formality to uncertainty, not complexity | `orchestrate` ✅ explicit principle | No |
| G3 | Mental alignment - team stays on same page via plans | `orchestrate.philosophy` mentions it | **Strengthen** |
| G4 | Sub-agents for context control, NOT anthropomorphized roles | `agent-spawn` partial | **Add** - explicit anti-pattern |
| G5 | MCP sprawl kills you - minimize tools in context | NOT EXPLICIT | **Add** - tool hygiene |
| G6 | Watch for tools that "spew markdown to make you feel good" | NOT EXPLICIT | **Add** - anti-pattern |

**General Gaps**:
- G4: Add explicit anti-pattern warning
- G5: Add MCP/tool hygiene guidance
- G6: Add "feel-good markdown" anti-pattern

---

## Summary: What's Missing

### Needs Strengthening (exists but weak)

1. **Sub-agent return compression** - Should explicitly say "compress findings before returning to parent"
2. **Code snippets in plans** - Dex shows actual code, not just pseudocode
3. **File + line specificity** - Make mandatory in [detailed] plans
4. **Context budget prominence** - Should be more visible, maybe in `orchestrate` main flow
5. **Mental alignment purpose** - Why we review plans (not just that we do)

### Needs Adding (doesn't exist)

1. **"Dumb model test"** - Can the plan be executed without interpretation?
2. **Trajectory detection** - Recognize when conversation is going badly, reset
3. **Step size guidance** - Keep steps small enough to verify
4. **Sub-agent anti-pattern** - "NOT for frontend/backend/QA roles"
5. **MCP hygiene** - Minimize tools, watch context pollution
6. **Feel-good markdown anti-pattern** - Tools that generate docs without value

### Philosophy Only (not actionable per-session)

1. "Pick one tool, get reps" - Organizational guidance
2. "Cultural change from the top" - Team/leadership guidance
3. "Spec-driven dev is dead" - Terminology awareness

---

## Proposed Changes

### Option A: Enhance Existing Protocols

Add to `orchestrate`:
- Context budget check in IMPLEMENT loop (more prominent)
- Trajectory check: "If 3+ corrections in conversation, consider fresh context"

Add to `plan-phases`:
- "Dumb model test" in quality criteria
- Strengthen [detailed] to require code snippets

Add to `agent-spawn`:
- Anti-pattern: "NOT for role anthropomorphization"
- Return format: "Compress to <500 tokens before return"

Add to `compact`:
- Move context budget thresholds to be more visible

### Option B: New "Session Hygiene" Protocol

Create `session-hygiene` protocol with:
- Context budget monitoring
- Trajectory detection
- MCP/tool hygiene
- Anti-patterns collected in one place

### Option C: Enhance + New Anti-Patterns Section

Enhance existing protocols (Option A) PLUS add:
- `anti-patterns` protocol collecting all the "don't do this" items
- Reference from relevant protocols

---

## Recommendation

**Option A + partial C**:
- Strengthen existing protocols (keeps things where people look)
- Add `anti-patterns` reference protocol (easy lookup for "what NOT to do")
- Keep philosophy doc separate (`ai-dev-philosophy`) for protocol authors
