import type { OptionsWithUri } from 'request';
import type { IDataObject, IExecuteFunctions, IHttpRequestMethods, ILoadOptionsFunctions, INodePropertyOptions, JsonObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { Templates } from './types';

export interface PromptifyCredentials {
	url: string;
	token: string;
}

export class PromptifyApi {
	private credentials?: PromptifyCredentials;

	private executeFunctions: IExecuteFunctions;

	constructor(executeFunctions: IExecuteFunctions) {
		this.executeFunctions = executeFunctions;
	}

	async init() {
		const credentials = await this.executeFunctions.getCredentials('promptifyApi');
		this.credentials = credentials as unknown as PromptifyCredentials;
	}

	protected async request(method: IHttpRequestMethods, endpoint: string, body?: IDataObject) {
		const credentialType = 'promptifyApi';

		const options: OptionsWithUri = {
			rejectUnauthorized: false,
			method,
			uri: (this.credentials?.url) + endpoint,
			body,
			json: true,
		};

		try {
			return await this.executeFunctions.helpers.requestWithAuthentication.call(
				this.executeFunctions,
				credentialType,
				options,
			);
		} catch (error) {
			throw new NodeApiError(this.executeFunctions.getNode(), error as JsonObject);
		}
	}

	public async getTemplates(functions: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const templates: Templates[] = await this.request('GET', '/templates');

		return templates.map(template => ({
			name: template.title,
			value: template.id,
			description: template.description
		}));
	}
}
