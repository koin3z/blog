# Comprehension rubric

Evaluate only claims the user actually made. Do not penalize omitted detail outside the question's
scope.

## Evaluation axes

Check the axes that matter to the concept:

1. **Causality**: the explanation connects the need or cause to the mechanism and result.
2. **Actors and boundaries**: responsibilities belong to the correct component, layer, or trust
   boundary.
3. **Order and flow**: state, data, or control moves in the correct direction and sequence.
4. **Conditions and scope**: the explanation states when the claim applies and avoids
   overgeneralization.
5. **Constraints and trade-offs**: an important limitation or failure condition is not erased.
6. **Distinctions**: adjacent concepts are not collapsed merely because they cooperate.

## Verdicts

### 正確

Use when the central causal relation and the constraints required by the question are correct.
Minor wording differences or omitted optional detail do not lower the verdict.

### 部分的

Use when the conclusion is broadly correct but a necessary cause, condition, boundary, actor, or
step is missing or ambiguous. Also use when shorthand could mislead in another context even though
the immediate intuition is useful.

### 誤り

Use when the explanation reverses a causal link, assigns responsibility to the wrong actor,
misorders the process, applies the concept outside its valid scope, or conflates concepts in a way
that changes the technical conclusion.

## Response form

Respond in this order:

1. `判定: 正確|部分的|誤り`
2. `合っている点:` state only what the user got right.
3. `不足・修正点:` identify the smallest consequential gap; omit this line when none exists.
4. Give a short correction focused on that gap.
5. If another attempt will test the repaired causal model, ask exactly one paraphrase question and
   stop.

Do not use praise as a substitute for assessment. Do not evaluate personality, intelligence, or
effort.

## Common comprehension gaps

- reciting a definition without explaining why the mechanism changes an outcome
- treating correlation or sequence as causation
- reversing client/server, producer/consumer, control-plane/data-plane, or
  authentication/authorization responsibilities
- confusing an API resource with its controller or runtime implementation
- stating a default, common implementation, or vendor behavior as a protocol requirement
- treating a necessary condition as sufficient, or a mitigation as complete prevention
- omitting the trust boundary, attacker capability, failure path, or version assumption that makes
  the conclusion valid
- using one label for two layers that cooperate but have different responsibilities

Do not save a user's wording as confirmed understanding while one of these gaps changes its
technical meaning.
