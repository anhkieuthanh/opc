import type { ServerAdapterModule } from "../types.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

export const httpAdapter: ServerAdapterModule = {
  type: "http",
  execute,
  testEnvironment,
  models: [],
  agentConfigurationDoc: `# http agent configuration

Adapter: http

Core fields:
- url (string, required): endpoint to invoke
- method (string, optional): HTTP method, default POST
- headers (object, optional): request headers, including bridge auth such as Authorization or x-bridge-token
- payloadTemplate (object, optional): JSON payload template merged with Paperclip correlation data such as runId/run_id and any available dispatch_id from context
- timeoutMs (number, optional): request timeout in milliseconds
- healthUrl (string, optional): safe endpoint for adapter environment checks when the dispatch URL should not be probed directly
- healthMethod (string, optional): probe method for healthUrl, default GET when healthUrl is set

Bridge response mapping:
- JSON success bodies are mapped into AdapterExecutionResult.summary and resultJson
- JSON failure bodies can populate errorMessage, errorCode, errorMeta, and summary without requiring operators to inspect the remote runtime directly
`,
};
