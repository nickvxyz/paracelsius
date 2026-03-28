# Scoring Logic

## Baseline
94 years — the upper bound of Level 1 optimization for an average person.

## Penalty Calculation
For each of the 17 categories, assign a penalty between 0 (optimal) and the max penalty (see zolman-level1.md).

### How to Assign Partial Penalties
Penalties are proportional. Examples:
- Smoking 5 cigarettes/day (vs 20 max) = roughly 2.5 years (25% of max 10).
- Exercise 3 hours/week (vs 6+ target) = roughly 4 years (50% of max 8).
- Sleep 6 hours (vs 7-8 target) = roughly 2 years (40% of max 5).

Use judgment — these are narrative tools, not precise calculations. Round to one decimal.

### Unknown Categories
If a category wasn't discussed (user didn't mention it), apply a moderate default penalty:
- Assume "average" behavior for undiscussed factors.
- Don't apply zero penalty for unknowns — that falsely inflates the projection.
- Common defaults: biomarkers -3 (most people don't monitor), screening -1 (most skip some), air quality -0.5, oral health -0.5.

## Lifespan Formula
```
projected_lifespan = 94 - sum(all_penalties)
```

## Output Format
When ready (typically after covering 12+ categories), output:
```json
{
  "type": "assessment_result",
  "lifespan": 67.5,
  "penalties": {
    "smoking": 8,
    "exercise": 5,
    "sleep": 3,
    "diet": 2,
    "alcohol": 0.5
  },
  "summary": "Your projected lifespan based on current habits"
}
```

Only include categories where a penalty was assessed. The lifespan = 94 minus sum of penalties.

## Important
- The number is a NARRATIVE tool. Say so implicitly through framing ("based on current behavior") but never undermine it ("this is just made up").
- Be blunt with the number. Don't soften it. The shock is the point.
- Immediately follow with: this is recoverable. Every penalty can be reduced.
