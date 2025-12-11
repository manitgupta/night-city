
export interface ConversionResponse {
    converted_ddl: string;
    logs: string[];
}

export interface ChatResponse {
    response: string;
}

const API_BASE_URL = "http://localhost:8001";

export const api = {
    async convertSchema(sourceDdl: string, sourceDialect: string): Promise<ConversionResponse> {
        const response = await fetch(`${API_BASE_URL}/convert`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                source_ddl: sourceDdl,
                source_dialect: sourceDialect,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
            throw new Error(errorData.detail || `Conversion failed: ${response.statusText}`);
        }

        return response.json();
    },

    async chat(message: string): Promise<string> {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: message,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
            throw new Error(errorData.detail || `Chat failed: ${response.statusText}`);
        }

        const data: ChatResponse = await response.json();
        return data.response;
    }
};
