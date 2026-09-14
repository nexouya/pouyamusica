import type { ComponentType } from "react";
import type { ViewId } from "../../types";

export type FeatureModule = {
  /** Stable id used as route / ViewId */
  id: ViewId | string;
  /** Sidebar label */
  label: string;
  /** Icon component (size prop) */
  Icon: ComponentType<{ size?: number; className?: string; filled?: boolean }>;
  /** Page component */
  component: ComponentType;
  /** Hide from primary nav (still routable) */
  hidden?: boolean;
  /** Order in sidebar (lower first) */
  order?: number;
};

const registry = new Map<string, FeatureModule>();

export function registerFeature(mod: FeatureModule) {
  registry.set(mod.id, mod);
}

export function getFeature(id: string): FeatureModule | undefined {
  return registry.get(id);
}

export function listFeatures(): FeatureModule[] {
  return [...registry.values()].sort(
    (a, b) => (a.order ?? 100) - (b.order ?? 100),
  );
}

export function listNavFeatures(): FeatureModule[] {
  return listFeatures().filter((f) => !f.hidden);
}
