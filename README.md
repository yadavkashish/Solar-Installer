# Surya Path

An end-to-end assessment implementation for a Nagpur rooftop-solar installer. The product is deliberately small: intake, bill review, explainable qualification, deterministic quote/PDF, and a project timeline.

## Assumptions

- 1,400 units/kW/year generation, ₹65,000/kW installed price, 80% self-consumption and ₹8/unit avoided rate are configurable demo assumptions.
- Roof sizing uses 10 m²/kW as a documented demo assumption.
- Fractional kW is allowed for price/generation but subsidy uses completed whole kW, rounded down.
- The brief's subsidy is a demo rule awaiting production policy verification.
- Lead scores are baseline rules, not predicted conversion likelihoods. Tenant or low-score leads receive a short sales call, never rejection.

See [deployment.md](deployment.md) and `docs/TDD.md` for detailed design.
