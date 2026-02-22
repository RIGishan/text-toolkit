import type { TransformDefinition, TransformId, TransformOptionValue } from "./types";
import { whitespaceNormalizeTransform } from "./whitespace";
import { transcriptCleanTransform } from "./transcript";
import { dedupeLinesTransform } from "./dedupe";

export const TRANSFORMS: Record<TransformId, TransformDefinition<any>> = {
  "whitespace/normalize": whitespaceNormalizeTransform,
  "transcript/clean": transcriptCleanTransform,
  "text/dedupe-lines": dedupeLinesTransform,
};

export const TRANSFORM_LIST = Object.values(TRANSFORMS).sort((a, b) => a.name.localeCompare(b.name));

export function defaultOptionsFor(transformId: TransformId): Record<string, TransformOptionValue> {
  const t = TRANSFORMS[transformId];
  const out: Record<string, TransformOptionValue> = {};
  for (const f of t.schema.fields) out[f.key] = f.default;
  return out;
}