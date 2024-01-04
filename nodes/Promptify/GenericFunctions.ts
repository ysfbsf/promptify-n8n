import { IDataObject, IExecuteFunctions, IHttpRequestMethods, ILoadOptionsFunctions, INodePropertyOptions, ResourceMapperFields } from "n8n-workflow"
import { API_BASEPATH, IExecution, IPromptInput, InputType, Templates } from "./types";

export async function promptifyApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	path: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	uri?: string,
) {

	const credentials = await this.getCredentials('promptifyApi')

	const res = await this.helpers.requestWithAuthentication.call(this, 'promptifyApi', {
		method,
		headers: {
			Authorization: `Token ${credentials.apiToken}`,
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body,
		qs,
		uri: uri || API_BASEPATH + path,
		json: true
	});

	return res;
}

export async function getTemplates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const templates: Templates[] = await promptifyApiRequest.call(this, 'GET', '/meta/templates?status=published&is_internal=false');

	return templates.map(template => ({
		name: template.title,
		value: template.id,
		description: template.description
	}));
}

export async function getInputs(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
	const templateId = this.getNodeParameter('template');
	const template: Templates = await promptifyApiRequest.call(this, 'GET', `/meta/templates/${templateId}`);

	const inputs: IPromptInput[] = [];
	template.prompts?.forEach(prompt => {
		const _newInputs = getInputsFromString(prompt.content).filter(newInput => !inputs.some(input => input.name === newInput.name))
		inputs.push(..._newInputs);
	})

	return {
		fields: inputs.map(input => (
			{
				id: input.name,
				displayName: input.fullName,
				defaultMatch: true,
				canBeUsedToMatch: true,
				required: input.required,
				display: true,
				type: input.type,
			}
		))
	}
}

export async function getExecutionById(context: IExecuteFunctions, executionId: number): Promise<IExecution> {
	const execution: IExecution = await promptifyApiRequest.call(context, 'GET', `/meta/template-executions/${executionId}`);

	return execution
}

const getInputsFromString = (str: string): IPromptInput[] => {
	const regex = /{{(.*?)}}/g;
	const inputs: IPromptInput[] = [];
	let match;

	while ((match = regex.exec(str)) !== null) {
		const parts = match[1].split(":");

		const exists = inputs.find(input => input.name === parts[0]);
		if (!exists) {
			const type = getType(parts[1]);
			const options =
				type === "options" && parts[3]?.startsWith('"') && parts[3]?.endsWith('"') // options format: "option1,option2"
					? Array.from(new Set(parts[3].slice(1, -1).split(","))).filter(option => option.trim()) // duplicates & empty options removed
					: null;

			if (type === "options" && !options?.length) {
				continue;
			}

			const _newInput: IPromptInput = {
				name: parts[0],
				fullName: parts[0]
					.replace(/([a-z])([A-Z])/g, "$1 $2")
					.toLowerCase()
					.replace(/^./, parts[0][0].toUpperCase()),
				type: type,
				required: parts[2] ? parts[2].toLowerCase() !== "false" : true, // required by default
				options: options,
			};

			inputs.push(_newInput);
		}
	}

	return inputs;
};

const getType = (str: string): InputType => {
	switch (str) {
		case "integer":
		case "number":
			return "number";
		case "code":
			return "string";
		case "choices":
			return "options";
		default:
			return "string";
	}
};

export const parseMessageData = (data: string): any => {
  // Replace single quotes with double quotes
  data = data.replace(/'/g, '"');
  data = data = data.replace(/\n/g, "<br>");

  // Handle triple double quotes
  data = data.replace(/"""/g, '"\\""');

  // Correctly escape double quotes inside message property value
  data = data.replace(/"message": "(.*?)",/g, (match, p1) => {
    return `"message": "${p1.split('\\"').join('"').replace(/"/g, '\\"')}",`;
  });

  // Revert 'word-ending contractions' to their original form
  data = data.replace(/"\\"([a-z]{1,2})"/gi, '"\'$1"');

  const parsedData = JSON.parse(data);

  return parsedData;
}
