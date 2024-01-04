export const API_BASEPATH = "https://api.promptify.com/api";

export interface Templates {
	id: number;
	title: string;
	slug: string;
	description: string;
	prompts?: [
		{
			id: number;
			order: number;
			title: string;
			content: string;
		}
	];
}
export interface TemplatesWithPagination {
	count: number;
	next: string | null;
	previous: string | null;
	results: Templates[];
}

export interface Inputs {
	city: string,
	requirement: string
}

export type InputType = "string" | "number" | "options";

export interface IPromptInput {
	name: string;
	fullName: string;
	type: InputType;
	required: boolean;
	defaultValue?: string | number | null;
	options?: string[] | null;
	prompt?: number;
}

export interface PromptsExecutions {
  id: number;
  prompt: number;
  executed_by: number;
  output: string;
  parameters: {
    [key: number | string]: string | number;
  };
  content?: string;
  created_at: Date | string;
  tokens_spent: number;
  errors?: string;
}

export interface IExecution {
  id: number;
  title: string;
  created_at: Date | string;
  prompt_executions?: PromptsExecutions[];
  is_favorite: boolean;
  parameters?: { [key: string]: any };
  contextual_overrides?: { [key: string]: any };
  template?: {
    title: string;
    slug: string;
    thumbnail: string;
  };
  hash: string;
  feedback?: string;
  executed_by?: number;
  errors?: string;
}
