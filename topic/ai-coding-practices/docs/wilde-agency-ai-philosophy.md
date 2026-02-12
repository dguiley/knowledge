# Wilde Agency AI Development Philosophy

A synthesis of proven context engineering principles with Protocol OS innovations.

---

## Core Belief

**AI cannot replace thinking. It can only amplify the thinking you have done—or the lack of thinking you have done.**

This is the foundational truth. Every technique, tool, and protocol exists to ensure the AI amplifies *good* thinking, not propagates bad assumptions.

---

## The Problem with Current AI Dev

### Dex's Observations (AI Engineer, Dec 2024)

From 100k developer survey:
- Most AI coding leads to **massive rework and churn**
- Works great for greenfield, fails for **brownfield codebases**
- "Too much slop, tech debt factory"

**The harsh reality**: You're shipping more, but a lot of it is just reworking the slop you shipped last week.

### The Senior Engineer Rift

> "Staff engineers don't adopt AI because it doesn't make them that much faster. Junior/mid engineers use it because it fills skill gaps—but also produces slop. Senior engineers hate it more every week because they're cleaning up slop shipped by Cursor the week before."

This is not AI's fault. This is not the mid-level engineer's fault. **Cultural change must come from the top.**

---

## The Dumb Zone

**The more context you use, the worse outcomes you get.**

```
Context Window Usage vs Quality

  100% |
       |                     DUMB ZONE
   60% |--------------------X------------
       |                   /
   40% |---------------X--/   <- Diminishing returns begin
       |              /
   20% |         X---/
       |        /                SMART ZONE
    0% |___X___/________________________
         Quality →
```

Around 40% context usage: diminishing returns begin (task-dependent).

**If your MCPs are dumping JSON and UUIDs into context, you're doing all your work in the dumb zone.**

---

## Spec-Driven Development is Dead

> "Spec-driven development is broken. Not the idea, but the phrase."
> — Dex

**Semantic diffusion**: A good term gets popular, then everyone means 100 different things by it, and it becomes useless.

"Spec-driven dev" now means:
- A more detailed prompt
- A PRD
- Verifiable feedback loops
- Treating code like assembly
- Just using markdown files while coding
- Documentation for an open source library

**It's semantically diffused. It's useless now.**

### What Dex *Actually* Recommends

Don't chase buzzwords. Focus on:
1. **Context compaction** - Stay in the smart zone
2. **Research → Plan → Implement** - The cycle, not the acronym
3. **Don't outsource the thinking** - Human in the loop on plans

---

## The Trajectory Problem

> "If you keep yelling at the AI for mistakes, it learns 'do wrong thing → get yelled at' and continues the pattern."

The LLM looks at the conversation:
- I did something wrong → human yelled
- I did something wrong → human yelled
- Therefore: "The next most likely token is... I better do something wrong so the human can yell at me"

**Mind your trajectory.** If a conversation is going poorly, start fresh.

---

## What Dex Gets Right

### 1. Context Compaction

Compress your context into markdown files:
- Exact files and line numbers that matter
- Why decisions were made
- What's been tried and failed

**Compaction is not information loss—it's information organization.**

### 2. Sub-Agents for Context Control

> "Sub-agents are NOT for anthropomorphizing roles (frontend agent, backend agent). They are for controlling context."

Use sub-agents to:
- Search/read/understand → return succinct summary
- Isolate exploration from main context
- Keep the parent agent in the smart zone

### 3. Research → Plan → Implement

| Phase | Purpose | Output |
|-------|---------|--------|
| Research | Understand system, find files | Summary + index |
| Plan | Exact steps with code snippets | Reviewable plan |
| Implement | Follow plan, keep context low | Working code |

**A good plan makes even "the dumbest model" unlikely to screw up.**

### 4. Human Reviews Plans, Not Code

> "I can read 1000 lines of Golang every week. I don't want to. I can read the plans."

Code review's real purpose: **Keep everyone on the same page about how the codebase is changing and why.**

Leaders read plans. Plans are leverage.

---

## Where Protocol Advances Beyond

### Dex's Approach: Static Compaction

- Compress context at key moments
- Start new context windows with compressed state
- Human manually decides when to compact

**Limitation**: Context correctness depends on when you compacted and what you included.

### Protocol's Approach: Dynamic Context Surfacing

The Protocol system treats context as a **living, queryable knowledge base**:

```
┌─────────────────────────────────────────────────────┐
│                  ALL CONTEXT                         │
│  (protocols, work logs, captures, codebase)         │
│                                                      │
│    ┌─────────────────────────────────────┐          │
│    │     INDEXED & AVAILABLE             │          │
│    │  (activation patterns, tags, refs)  │          │
│    │                                      │          │
│    │    ┌────────────────────┐           │          │
│    │    │  SURFACED NOW      │           │          │
│    │    │  (current step's   │           │          │
│    │    │   minimum context) │           │          │
│    │    └────────────────────┘           │          │
│    └─────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
```

**Key Innovation**: The correct context changes as you travel down the path. Protocol uses algorithms/tools to surface the right context at each step, not just at compaction moments.

### Specific Advances

#### 1. Activation Patterns (Semantic Protocol Discovery)

```markdown
# api-optimization
<!--
  activation_patterns: [
    "API is slow",
    "rate limited by vendor",
    "too many external calls"
  ]
-->
```

Protocols declare *when* they apply. The system matches problems to solutions semantically.

**vs Dex**: Manual decision of what context to include.

#### 2. Uncertainty-Driven Interaction

```markdown
ASSUMPTIONS:
- A1: OAuth2 preferred | certainty: LOW | basis: guess ⚠️
- A2: Postgres backend | certainty: HIGH | basis: fact (schema)
```

Protocol tracks assumption certainty explicitly:
- HIGH certainty → proceed autonomously
- LOW certainty on load-bearing assumption → **stop and ask**

**vs Dex**: Plans reviewed but assumptions not systematically tracked.

#### 3. Mipmap-Style Knowledge Resolution

```
Level 3 - Tree summary:      750 tokens  (whole workspace)
Level 2 - Asset summaries:  3,000 tokens (per-asset)
Level 1 - Detailed summary: 12,500 tokens (section summaries)
Level 0 - Full content:     50,000 tokens (all assets)
```

**Always start at Level 3, drill down as needed.**

Like texture mipmaps in 3D graphics—load the resolution you need.

#### 4. Progressive Plan Detailing

```markdown
### P1: Auth System [rough]
- Goal: User registration, login, session management
- Approach: use @proto:oauth, implement with NextAuth
- Depends: Nothing

### P2: User Profiles [rough]
- Goal: Profile creation, editing, viewing
- Depends: P1
```

Later phases stay **[rough]** until executed. Reality changes plans—don't fight it.

**vs Dex**: Plans are detailed upfront.

#### 5. Slop Cascade Prevention

When Assumption A1 supports A2 supports A3:
- Flag the dependency chain
- LOW at root = HIGH RISK for all dependents
- Interactive mode catches these early

**The insight**: A bad line of research is worse than a bad line of code—it cascades into a hundred bad lines.

---

## Quotable Truths

### On Context

> "The only way to get better performance out of an LLM is to put better tokens in."

> "Every turn of the loop, the agent picks the next tool. There could be hundreds of right next steps and hundreds of wrong next steps. The only thing that influences what comes out is what's in the conversation so far."

### On Tools

> "Watch out for tools that just spew out a bunch of markdown files to make you feel good."

> "If you have too many MCPs, you are doing all your work in the dumb zone."

### On Learning

> "How do I know how much context engineering to use? It takes reps. You will get it wrong. You have to get it wrong over and over again."

> "Pick one tool and get some reps. I recommend against min-maxing across Claude, Codex, Cursor..."

### On Leverage

> "A bad line of code is a bad line of code. A bad part of a plan could be a hundred bad lines of code. A bad line of research—a misunderstanding of how the system works—your whole thing is going to be hosed."

> "Move human effort and focus to the highest leverage parts of the pipeline."

### On Adoption

> "This is not AI's fault. This is not the mid-level engineer's fault. Cultural change is really hard and it needs to come from the top if it's going to work."

---

## The Wilde Agency Way

### Philosophy

1. **Context is everything** - The smart zone is real. Respect it.
2. **Protocols over prompts** - Reusable patterns, not one-off instructions
3. **Index everything** - References work, not inlined content
4. **Uncertainty is data** - Track it, act on it, don't hide it
5. **Plans are disposable** - The map is not the territory
6. **Don't outsource thinking** - AI amplifies, doesn't replace

### Practice

1. **Start with research** - Understand before you build
2. **Surface minimum context** - Just enough for HIGH certainty
3. **Review plans, not just code** - Catch slop before it cascades
4. **Track assumptions explicitly** - Certainty levels on everything load-bearing
5. **Compact proactively** - Stay in the smart zone
6. **Log everything** - Future you will thank present you

### Anti-Patterns

- Dumping entire codebases into context
- One-shot prompting for complex tasks
- Static CLAUDE.md files that drift from reality
- Sub-agents for "roles" instead of context control
- Planning later phases in detail (they'll change)
- Hiding uncertainty behind confident language

---

## Summary: From Dex's RPI to Protocol OS

| Aspect | Dex's RPI | Protocol OS |
|--------|-----------|-------------|
| Context management | Manual compaction | Dynamic surfacing |
| Protocol discovery | Human decision | Activation patterns |
| Assumption tracking | Implicit | Explicit with certainty |
| Plan detail | Upfront detail | Progressive detailing |
| Knowledge resolution | Single level | Mipmap hierarchy |
| Slop detection | Plan review | Cascade prevention |

**Both agree on fundamentals**:
- Stay in smart zone
- Research before planning
- Human reviews plans
- Sub-agents for context
- Don't outsource thinking

**Protocol advances with**:
- Algorithmic context surfacing
- Semantic protocol matching
- Explicit uncertainty tracking
- Multi-resolution knowledge
- Cascade risk detection

---

## Sources

- Dex, "Advanced Context Engineering for Coding Agents" (AI Engineer, Dec 2024)
- Protocol OS documentation (`protocol/core/*.md`)
- 12 Factor Agents (AI Engineer, June 2024)

---

*"There is no perfect prompt. There is no silver bullet. Pick one tool and get some reps."*
