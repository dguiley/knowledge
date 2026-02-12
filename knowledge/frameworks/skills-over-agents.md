---
type: framework
discovered_from: [aie/build-skills, anthropic/mcp, sean-kochel/claude-skills]
confidence: high
sources: 6+ episodes
created: 2026-01-06
---

# Skills Over Agents

> Don't build complete AI agents from scratch. Build composable, domain-specific skills.

## The Principle

| Build Agents | Build Skills |
|--------------|--------------|
| Monolithic, brittle | Modular, composable |
| Heavy engineering | Lightweight additions |
| Breaks when model changes | Adapts to new models |
| Technical-only contribution | Anyone can create |

## Why Skills Win

1. **Token efficiency** - Progressive disclosure, not context dumps
2. **Composability** - Chain skills together for workflows
3. **Accessibility** - Non-technical people can contribute
4. **Future-proofing** - Model improves, skills still work

> "It's time to stop rebuilding agents and start building skills instead."

## What is a Skill?

A skill is:
- Focused on ONE capability
- Includes instructions + context + examples
- Designed for progressive disclosure
- Chainable with other skills

## The MCP Connection

MCP (Model Context Protocol) is the "USB-C for AI":
- Standard interface between models and tools
- Skills connect via MCP
- Reduces redundant integration work

> "What MCP tries to accomplish is giving this brain... really the limbs into the world."

## Practical Application

Instead of building a "research agent":
1. Build a "web search" skill
2. Build a "summarize content" skill
3. Build a "extract facts" skill
4. Chain them together

Each skill is simple. The composition is powerful.

## Appendix

### A. Source Material

> "Anyone can create [skills] and they give agents the new capabilities that they didn't have before."
> — AIE (Build Skills)

> "Claude skills are very token efficient because they're engineered to progressively disclose context as it's needed."
> — Sean Kochel (Claude Code Skills)

### B. Related Concepts

- Progressive disclosure
- MCP (Model Context Protocol)
- Orchestration over individual tools
