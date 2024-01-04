/* eslint-disable n8n-nodes-base/node-param-description-missing-from-dynamic-options */
/* eslint-disable n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options */
import {
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	INodeExecutionData,
	ResourceMapperValue,
} from 'n8n-workflow';
import { getTemplates, getInputs, promptifyApiRequest, getExecutionById } from './GenericFunctions';
import { API_BASEPATH, Templates } from './types';
import { fetchEventSource } from '@fortaine/fetch-event-source';

export class Promptify implements INodeType {

	description: INodeTypeDescription = {
		displayName: 'Promptify',
		name: 'promptify',
		group: ['transform'],
		version: 1,
		description: 'Basic Promptify Node',
		icon: 'file:promptify.svg',
		defaults: {
			name: 'Promptify',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'promptifyApi',
				required: true,
			},
		],
		documentationUrl: 'https://github.com/ysfbsf/promptify-n8n/blob/main/README.md',
		properties: [
			{
				displayName: 'Templates',
				name: 'template',
				type: 'options',
				default: '',
				typeOptions: {
					loadOptionsMethod: 'getTemplates'
				},
				required: true
			},
			{
				displayName: 'Inputs',
				name: 'inputs',
				type: 'resourceMapper',
				noDataExpression: true,
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				required: true,
				typeOptions: {
					loadOptionsDependsOn: ['template'],
					resourceMapper: {
						resourceMapperMethod: 'getInputs',
						mode: 'update',
						fieldWords: {
							singular: 'input',
							plural: 'inputs',
						},
						addAllFields: true,
						multiKeyMatch: true,
					},
				},
			},
		],
	};


	methods = {
		loadOptions: {
			getTemplates
		},
		resourceMapping: {
			getInputs
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const templateId = this.getNodeParameter('template', 0) as string;
		const inputs = this.getNodeParameter('inputs', 0) as ResourceMapperValue;

		const values = inputs.value || {};
		const requiredInvalid = inputs.schema.filter(field => field.required && !(field.id in values));
		if (requiredInvalid.length > 0) {
			const invalids = requiredInvalid.map(field => field.displayName).join(", ");
			throw Error(`Enter or map all required fields: ${invalids}`);
		}

		const template: Templates = await promptifyApiRequest.call(this, 'GET', `/meta/templates/${templateId}`);
		const inputsData = template.prompts?.map(prompt => ({
			prompt: prompt.id,
			contextual_overrides: [],
			prompt_params: inputs.value
		}))

		const credentials = await this.getCredentials('promptifyApi');
		let generatedContent = "";
		const context = this;

		const generateExecution = new Promise<void>(async (resolve, reject) => {
			let executionId: number;

			await fetchEventSource(`${API_BASEPATH}/meta/templates/${templateId}/execute`, {
				method: "POST",
				headers: {
					Authorization: `Token ${credentials.apiToken as string}`,
					Accept: "application/json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify(inputsData),
				openWhenHidden: true,
				onopen: async (res: Response) => {
					if (res.ok && res.status === 200) {
						this.logger.info(`[SPARK_GENERATE]: ${template.title}`)
					} else if (res.status >= 400 && res.status < 500 && res.status !== 429) {
						throw Error(res.statusText);
					}
				},
				onmessage(msg) {
					try {
						if (msg.event === "infer" && msg.data.includes("template_execution_id") && !executionId) {
							const message: { template_execution_id: number } = JSON.parse(msg.data.trim());
							executionId = message.template_execution_id;
						}
					} catch (_) {}
				},
				onclose: async () => {
					try {
						const execution = await getExecutionById(context, executionId);

						if (execution.errors) {
							generatedContent = "Something wrong happened";
							reject();
						}

						generatedContent = execution.prompt_executions?.[0].output.replace(/\n(\s+)?/g, "").replace(/.*?\{/, "{") || "";
						resolve();
					} catch (_) {
						generatedContent = "Something wrong happened";
						reject();
					}
				},
				onerror(err) {
					generatedContent = "Something wrong happened";
					reject();
				},
			})
		})

		await generateExecution;

		const promptifyGenerated = {
			template: {
				slug: template.slug,
				title: template.title,
				description: template.description,
			},
			content: generatedContent
		}

		return this.prepareOutputData([{
			json: promptifyGenerated
		}]);
	}
}
