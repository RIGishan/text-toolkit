export type TransformId =
  | "whitespace/normalize"
  | "transcript/clean"
  | "text/dedupe-lines";

export type TransformOptionValue = string | number | boolean;

export type TransformSchemaField =
  | {
      key: string;
      label: string;
      type: "boolean";
      default: boolean;
    }
  | {
      key: string;
      label: string;
      type: "number";
      default: number;
      min?: number;
      max?: number;
      step?: number;
    }
  | {
      key: string;
      label: string;
      type: "select";
      default: string;
      options: { value: string; label: string }[];
    };

export type TransformSchema = {
  fields: TransformSchemaField[];
};

export type TransformDefinition<TOptions extends Record<string, TransformOptionValue>> = {
  id: TransformId;
  name: string;
  description: string;
  schema: TransformSchema;
  apply: (input: string, options: TOptions) => string;
};

export type WorkflowStep = {
  transformId: TransformId;
  options: Record<string, TransformOptionValue>;
};

export type SavedWorkflow = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  steps: WorkflowStep[];
};