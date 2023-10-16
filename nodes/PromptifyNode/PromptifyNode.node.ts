import {
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	INodeExecutionData,
} from 'n8n-workflow';
import { getTemplates, getInputs } from './GenericFunctions';
import { Templates } from './types';
import { fetchEventSource, EventSourceMessage } from '@ai-zen/node-fetch-event-source';

export class PromptifyNode implements INodeType {

	description: INodeTypeDescription = {
		displayName: 'Promptify',
		name: 'promptify',
		group: ['transform'],
		version: 1,
		description: 'Basic Promptify Node',
		// icon: 'file:promptify.svg',
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
		properties: [
			{
				displayName: 'Templates',
				name: 'template',
				type: 'options',
				default: '',
				placeholder: 'Choose a template',
				description: 'Choose a template and start generating',
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
		const inputs = this.getNodeParameter('inputs', 0) as any;
    let generatedContent: string = "";

		const options = {
			method: "GET",
			headers: {
				"x-lf-source": "n8n"
			},
			uri: `https://promptify.adtitan.io/api/meta/templates/${templateId}`,
			json: true
		};
		const template: Templates = await this.helpers.requestWithAuthentication.call(this, 'promptifyApi', options);
		const inputsData = template.prompts?.map(prompt => ({
			prompt: prompt.id,
			contextual_overrides: [],
			prompt_params: inputs.value
		}))

		const credentials = await this.getCredentials('promptifyApi')

		await fetchEventSource(`https://promptify.adtitan.io/api/meta/templates/${templateId}/execute/`, {
      method: "POST",
      headers: {
        Authorization: `Token ${credentials.apiToken as string}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(inputsData),
			onopen: async (res: any) => {
				console.log('open',res)
			},
			onmessage: (event:EventSourceMessage) => {
				console.log(event)
					try {
						const parseData = JSON.parse(event.data.replace(/'/g, '"'));
						const message = parseData.message;

						if (event.event === "infer" && event.data) {
								generatedContent += message || "";
						} else {
								if (message === "[C OMPLETED]" || message === "[COMPLETED]") {
									console.log("[COMPLETED]: ",generatedContent)
								}

								if (message === "[INITIALIZING]") {
									console.log("INITIALIZING")
								}

								if (message.includes("[ERROR]")) {
									console.error("ERROR", message)
								}
						}
					} catch {
						console.error(event);
					}
			},
			onerror: (err) => {
				console.error(err)
			},
			onclose:() => {
				console.error('close')
			},
		})

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
