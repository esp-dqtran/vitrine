import { readFileSync } from "node:fs";
import type { DesignFlow } from "./designSystem.ts";
import { appImages, saveAppFlows } from "./db.ts";

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as JsonObject;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

export function parseFlowManifest(raw: string, allowedImageIds: ReadonlySet<number>): DesignFlow[] {
  let root: JsonObject;
  try {
    root = object(JSON.parse(raw), "manifest");
  } catch (error) {
    throw new Error(`Flow manifest is not valid JSON: ${(error as Error).message}`);
  }

  if (!Array.isArray(root.flows)) throw new Error("manifest.flows must be an array");
  const seenFlowIds = new Set<string>();
  return root.flows.map((flowValue, flowIndex) => {
    const flow = object(flowValue, `flows[${flowIndex}]`);
    const id = text(flow.id, `flows[${flowIndex}].id`);
    if (seenFlowIds.has(id)) throw new Error(`Duplicate flow id ${id}`);
    seenFlowIds.add(id);
    if (!Array.isArray(flow.steps) || flow.steps.length === 0) throw new Error(`Flow ${id} must have at least one step`);
    const seenImageIds = new Set<number>();
    const steps = flow.steps.map((stepValue, stepIndex) => {
      const step = object(stepValue, `flows[${flowIndex}].steps[${stepIndex}]`);
      const imageId = step.imageId;
      if (typeof imageId !== "number" || !Number.isInteger(imageId) || !allowedImageIds.has(imageId)) {
        throw new Error(`Unknown image id ${String(imageId)} in flow ${id}`);
      }
      if (seenImageIds.has(imageId)) throw new Error(`Duplicate image id ${imageId} in flow ${id}`);
      seenImageIds.add(imageId);
      const label = text(step.label, `flows[${flowIndex}].steps[${stepIndex}].label`);
      return { label, interaction: typeof step.interaction === "string" && step.interaction.trim() ? step.interaction.trim() : label, evidence: [imageId] };
    });
    const tags = Array.isArray(flow.tags)
      ? [...new Set(flow.tags.filter((tag): tag is string => typeof tag === "string" && !!tag.trim()).map((tag) => tag.trim()))]
      : [];
    return {
      id,
      title: text(flow.title, `flows[${flowIndex}].title`),
      description: text(flow.description, `flows[${flowIndex}].description`),
      tags,
      steps,
    };
  });
}

export async function importFlowManifest(app: string, path: string): Promise<number> {
  const images = await appImages(app);
  const flows = parseFlowManifest(readFileSync(path, "utf8"), new Set(images.map((image) => image.id)));
  await saveAppFlows(app, "web", flows);
  return flows.length;
}
