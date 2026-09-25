import type { DraftCasePackage } from "./schemas.ts";

/** Closed coverage, no implicit outcomes and no outcome data in public metadata. */
export function sharedCatalogueProblems(c: DraftCasePackage): string[] {
  const errors: string[] = [];
  const actions = new Map(
    c.action_catalogue.actions.map((a) => [a.action_id, a]),
  );
  const rules = new Set(c.rules.rules.map((r) => r.rule_id));
  const sources = new Set(c.validation.sources.map((s) => s.source_id));
  for (const a of actions.values()) {
    const p = a.outcome_policy;
    if (!p) continue;
    if (
      p.source_ids.some((s) => !sources.has(s)) ||
      p.rule_ids.some((r) => !rules.has(r))
    ) errors.push("Outcome provenance/reference is unresolved.");
    if (
      a.observation_acquisition &&
      a.observation_acquisition.duration_seconds !== p.duration_seconds
    ) {
      errors.push(
        "Acquisition and outcome duration must agree, not add twice.",
      );
    }
    if (
      p.behavior === "NO_MODELED_BENEFIT" &&
      (p.rule_ids.length || a.investigation || a.observation_acquisition ||
        c.rules.rules.some((r) =>
          JSON.stringify(r).includes(`\"${a.action_id}\"`)
        ))
    ) {
      errors.push(
        "No-benefit policy cannot silently invoke a Case clinical rule/result/acquisition.",
      );
    }
  }
  const original = c.action_catalogue.shared;
  if (!original) return errors;
  // Same binding/parameter/provenance rules apply to explicitly searched special tests.
  const s = {...original, catalogue:{...original.catalogue,actions:[...original.catalogue.actions,...(original.search_only?.actions??[])]},
    bindings:[...original.bindings,...(original.search_only?.bindings??[])]};
  if (!s.catalogue.identity) {
    errors.push("Shared catalogue must have a versioned identity.");
  }
  const publicIds = new Set(s.catalogue.actions.map((a) => a.action_id));
  const bound = new Set<string>(),
    targets = new Set<string>(),
    aliases = new Map<string, string>();
  if (s.bindings.length !== publicIds.size) {
    errors.push("Shared coverage must be exhaustive.");
  }
  for (const b of s.bindings) {
    if (bound.has(b.concept_id) || targets.has(b.case_action_id)) {
      errors.push("Duplicate shared binding.");
    }
    bound.add(b.concept_id);
    targets.add(b.case_action_id);
    const pub = s.catalogue.actions.find((a) => a.action_id === b.concept_id),
      a = actions.get(b.case_action_id);
    if (!pub || !a?.outcome_policy) {
      errors.push(
        "Binding requires a public concept, Case action and explicit outcome.",
      );
      continue;
    }
    if (!pub.category || !pub.action_id.startsWith("concept.")) {
      errors.push(
        "Shared concepts need category and neutral concept identity.",
      );
    }
    if (
      pub.action_type !== a.action_type ||
      pub.repeat_policy !== a.repeat_policy ||
      pub.confirmation_policy !== a.confirmation_policy ||
      JSON.stringify(pub.parameter_definitions) !==
        JSON.stringify(a.parameter_definitions)
    ) {
      errors.push(
        "Public order structure must match its Case execution contract.",
      );
    }
    const expected = a.prerequisite_action_ids.map((id) =>
      s.bindings.find((x) => x.case_action_id === id)?.concept_id
    ).sort();
    if (
      expected.some((id) => !id) ||
      JSON.stringify(expected) !==
        JSON.stringify([...(pub.prerequisite_concept_ids ?? [])].sort())
    ) {
      errors.push(
        "Shared prerequisite coverage must match Case prerequisites.",
      );
    }
    if (
      !["en-US", "ar-JO"].every((l) => pub.labels.some((x) => x.locale === l))
    ) errors.push("Shared labels must be bilingual.");
    for (const group of pub.aliases ?? []) {
      for (const phrase of group.phrases) {
        const key = `${group.locale}:${phrase.trim().toLowerCase()}`,
          previous = aliases.get(key);
        if (previous && previous !== b.concept_id) {
          errors.push("Conflicting controlled alias.");
        }
        aliases.set(key, b.concept_id);
      }
    }
  }
  if ([...publicIds].some((id) => !bound.has(id))) {
    errors.push("Unbound shared concept.");
  }
  return errors;
}
