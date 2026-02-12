---
type: protocol
discovered_from: [sean-kochel/*, aie/*]
confidence: high
sources: 11+ episodes
created: 2026-01-06
---

# Structured Context for AI Effectiveness

> 90% of AI coding failures stem from insufficient structured context, not model limitations.

## The Problem

Most people:
- Jump into AI tools hoping for magic
- Provide vague prompts expecting specifics
- Wonder why AI "doesn't understand" their codebase

## The Solution

Before any AI interaction, establish:

1. **Spec-driven foundation** - Document what you're building, why, and constraints
2. **Clear requirements** - Specific acceptance criteria, not vague goals
3. **Reference files** - CLAUDE.md, architecture docs, design systems
4. **Decision documentation** - Why you chose X over Y

## Implementation

### Pre-Session Setup
```
1. Write a 1-page spec (what, why, constraints)
2. Create/update reference files
3. Document existing patterns to follow
4. Define "done" criteria
```

### During Development
- Use progressive disclosure (reveal complexity as needed)
- Chunk tasks into digestible pieces
- Clear context between major switches
- Track decisions in documentation

### Token Efficiency
Structured context + progressive disclosure = fewer tokens, better results

> "Claude skills are very token efficient because they're engineered to progressively disclose context as it's needed."

## The 5-Minute Investment

> "This five-minute investment saves you five hours of refactoring down the line."

Before starting any AI coding session:
- [ ] Spec exists with clear scope
- [ ] Reference files are current
- [ ] Design system/patterns documented
- [ ] Success criteria defined

## Appendix

### A. Source Material

> "90% of AI coding fails because of one simple ingredient, structured context."
> — Sean Kochel (GitHub Free Tool)

> "Spec driven development should be your new best friend."
> — Sean Kochel (Codex CLI SpecKit)

### B. Related Concepts

- Design-first development (design system before code)
- Progressive disclosure (reveal as needed)
- Self-documenting code (prevent feature loss)
