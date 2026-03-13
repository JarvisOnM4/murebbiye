import type { ElementStatus, ExerciseClue, ExerciseSpec } from "./types";

/**
 * Returns list of layer IDs that should be visible based on matched elements.
 * Always includes defaultVisible layers.
 * Checks dependencies and handles mutuallyExclusive groups.
 */
export function computeVisibleLayers(
  spec: ExerciseSpec,
  matchedElements: Record<string, ElementStatus>
): string[] {
  const visibleSet = new Set<string>();
  const excludedSet = new Set<string>();

  // Always add default-visible layers first
  for (const layer of spec.layers) {
    if (layer.defaultVisible) {
      visibleSet.add(layer.id);
    }
  }

  // Process elements to activate their layers
  for (const element of spec.elements) {
    const status = matchedElements[element.id];
    if (status !== "present") {
      continue;
    }

    // Check dependency: if dependsOn is set, that element must also be "present"
    if (element.dependsOn) {
      const depStatus = matchedElements[element.dependsOn];
      if (depStatus !== "present") {
        continue;
      }
    }

    for (const layerId of element.activatesLayers) {
      visibleSet.add(layerId);
    }
  }

  // Handle mutuallyExclusive: for each layer that is visible and has
  // mutuallyExclusive siblings, remove those siblings.
  // Process layers in zIndex order so higher-specificity layers win.
  const layerById = new Map(spec.layers.map((l) => [l.id, l]));
  const sortedVisible = Array.from(visibleSet).sort((a, b) => {
    const za = layerById.get(a)?.zIndex ?? 0;
    const zb = layerById.get(b)?.zIndex ?? 0;
    return za - zb;
  });

  for (const layerId of sortedVisible) {
    if (excludedSet.has(layerId)) {
      visibleSet.delete(layerId);
      continue;
    }
    const layer = layerById.get(layerId);
    if (layer?.mutuallyExclusive) {
      for (const excluded of layer.mutuallyExclusive) {
        excludedSet.add(excluded);
        visibleSet.delete(excluded);
      }
    }
  }

  return Array.from(visibleSet);
}

/**
 * Returns true when ALL "required" category elements are "present".
 */
export function checkCompletion(
  spec: ExerciseSpec,
  matchedElements: Record<string, ElementStatus>
): boolean {
  const requiredElements = spec.elements.filter((e) => e.category === "required");
  return requiredElements.every((e) => matchedElements[e.id] === "present");
}

/**
 * Returns the next hint — skips clues for already-matched elements, sorts by order.
 * Returns null if no more hints available.
 */
export function getNextHint(
  spec: ExerciseSpec,
  hintsUsed: number,
  matchedElements: Record<string, ElementStatus>
): ExerciseClue | null {
  // Filter out clues for already-present elements, then sort by order
  const availableClues = spec.clues
    .filter((clue) => matchedElements[clue.elementId] !== "present")
    .sort((a, b) => a.order - b.order);

  if (hintsUsed >= availableClues.length) {
    return null;
  }

  return availableClues[hintsUsed] ?? null;
}

/**
 * Merges two analysis records with sticky-upgrade semantics:
 * Elements stay "present" once detected. "partial" upgrades to "present".
 * "missing" upgrades to "partial" or "present". Never downgrades.
 */
export function mergeAnalysis(
  previous: Record<string, ElementStatus>,
  current: Record<string, ElementStatus>
): Record<string, ElementStatus> {
  const statusRank: Record<ElementStatus, number> = {
    missing: 0,
    partial: 1,
    present: 2,
  };

  const result: Record<string, ElementStatus> = { ...previous };

  for (const [elementId, newStatus] of Object.entries(current)) {
    const existingStatus = result[elementId] ?? "missing";
    const existingRank = statusRank[existingStatus] ?? 0;
    const newRank = statusRank[newStatus] ?? 0;

    if (newRank > existingRank) {
      result[elementId] = newStatus;
    }
  }

  return result;
}
