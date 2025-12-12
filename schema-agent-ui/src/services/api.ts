
export interface ConversionResponse {
    converted_ddl: string;
    logs: string[];
    report?: string;
}

export interface ChatResponse {
    response: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:8001" : "");

export interface ValidationResponse {
    valid: boolean;
    errors: string[];
}

export interface MigrateResponse {
    success: boolean;
    message: string;
    database_uri: string;
}

export interface ConfigResponse {
    spanner_project_id: string;
    spanner_instance_id: string;
}


export const api = {
    async convertSchema(sourceDdl: string, sourceDialect: string, verify: boolean): Promise<ConversionResponse> {
        const response = await fetch(`${API_BASE_URL}/convert`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                source_ddl: sourceDdl,
                source_dialect: sourceDialect,
                verify_ddl: verify,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
            throw new Error(errorData.detail || `Conversion failed: ${response.statusText}`);
        }

        return response.json();
    },

    async chat(message: string, sourceCode?: string, outputCode?: string, selection?: any): Promise<string> {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: message,
                source_ddl: sourceCode,
                output_ddl: outputCode,
                selection: selection
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
            throw new Error(errorData.detail || `Chat failed: ${response.statusText}`);
        }

        const data: ChatResponse = await response.json();
        return data.response;
    },

    async validateSpannerDDL(ddl: string): Promise<ValidationResponse> {
        const response = await fetch(`${API_BASE_URL}/validate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                ddl: ddl,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
            throw new Error(errorData.detail || `Validation failed: ${response.statusText}`);
        }

        return response.json();
    },

    async analyzeError(sourceDdl: string, generatedDdl: string, errorMessage: string): Promise<AnalyzeResponse> {
        const response = await fetch(`${API_BASE_URL}/analyze_error`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                source_ddl: sourceDdl,
                generated_ddl: generatedDdl,
                error_message: errorMessage
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
            throw new Error(errorData.detail || `Analysis failed: ${response.statusText}`);
        }

        return response.json();
    },

    async migrateSchema(projectId: string, instanceId: string, databaseId: string, ddl: string): Promise<MigrateResponse> {
        const response = await fetch(`${API_BASE_URL}/migrate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                project_id: projectId,
                instance_id: instanceId,
                database_id: databaseId,
                ddl: ddl,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
            throw new Error(errorData.detail || `Migration failed: ${response.statusText}`);
        }

        return response.json();
    },

    async getConfig(): Promise<ConfigResponse> {
        const response = await fetch(`${API_BASE_URL}/config`);
        if (!response.ok) {
            throw new Error("Failed to fetch config");
        }
        return response.json();
    }
};

export interface AnalyzeResponse {
    explanation: string;
    fixed_ddl: string;
}
