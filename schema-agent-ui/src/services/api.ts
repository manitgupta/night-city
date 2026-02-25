
export interface ConversionResponse {
    converted_ddl: string;
    logs: string[];
    report?: string;
}

export interface ChatResponse {
    response: string;
    suggested_fix?: {
        explanation: string;
        fixed_ddl: string;
    };
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:8001" : "");

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

export interface SourceConnectionConfig {
    dialect: string;
    host: string;
    port: string;
    username: string;
    password: string;
    database: string;
}

export interface SourceConnectionResponse {
    success: boolean;
    message: string;
    session_id?: string;
}

export interface SpannerConnectionConfig {
    project_id: string;
    instance_id: string;
    database_id: string;
}

export interface SpannerConnectionResponse {
    success: boolean;
    message: string;
    session_id?: string;
}


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

        // Handle NDJSON stream if response header indicates it, or just parse chunks
        // Check content-type
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/x-ndjson")) {
            // It's a stream! But this method signature expects a Promise<ConversionResponse>.
            // We'll consume the stream entirely here for backward compatibility or 
            // ideally we'd use a different method. 
            // BUT, since we are adding a NEW method `convertSchemaStream` below, we can leave this one 
            // to fail or just read the last result processing.
            // Let's implement `convertSchemaStream` properly below and leave this one as legacy (async/await non-streaming).
            // However, since we CHANGED the backend to ALWAYS stream, this method needs to adapt 
            // to consume the stream and return the final Result.

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let finalResult: ConversionResponse | null = null;

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const data = JSON.parse(line);
                            if (data.type === 'result') {
                                finalResult = data;
                            }
                        } catch (e) {
                            console.warn("Failed to parse chunk", e);
                        }
                    }
                }
            }

            if (finalResult) return finalResult;
            throw new Error("Stream did not return a final result");
        }

        return response.json();
    },

    async convertSchemaStream(
        sourceDdl: string,
        sourceDialect: string,
        onChunk: (chunk: any) => void
    ): Promise<ConversionResponse> {
        return this._streamRequest(
            `${API_BASE_URL}/convert`,
            { source_ddl: sourceDdl, source_dialect: sourceDialect },
            onChunk
        );
    },

    async convertSchemaAuto(
        sourceDdl: string,
        sourceDialect: string,
        onChunk: (chunk: any) => void
    ): Promise<ConversionResponse> {
        return this._streamRequest(
            `${API_BASE_URL}/multi_turn_convert_schema_stream_v2`,
            { source_ddl: sourceDdl, source_dialect: sourceDialect },
            onChunk
        );
    },

    async convertQueryAuto(
        sourceQuery: string,
        spannerSessionId: string,
        sourceDialect: string | null = null,
        onChunk: (chunk: any) => void
    ): Promise<ConversionResponse> {
        return this._streamRequest(
            `${API_BASE_URL}/multi_turn_convert_query_stream_v2`,
            {
                source_query: sourceQuery,
                spanner_session_id: spannerSessionId,
                source_dialect: sourceDialect
            },
            onChunk
        );
    },

    async _streamRequest(
        url: string,
        body: any,
        onChunk: (chunk: any) => void
    ): Promise<ConversionResponse> {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
            throw new Error(errorData.detail || `Conversion failed: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let finalResult: ConversionResponse | null = null;
        let buffer = "";

        if (reader) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        onChunk(data);

                        if (data.type === 'result') {
                            finalResult = data;
                        }
                    } catch (e) {
                        console.warn("Failed to parse chunk", e);
                    }
                }
            }
        }

        if (buffer.trim()) {
            try {
                const data = JSON.parse(buffer);
                onChunk(data);
                if (data.type === 'result') finalResult = data;
            } catch (e) { }
        }

        if (finalResult) return finalResult;
        throw new Error("Stream ended without result");
    },

    async chat(message: string, source_ddl: string, output_ddl: string, selection: any): Promise<ChatResponse> {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: message,
                source_ddl: source_ddl,
                output_ddl: output_ddl,
                selection: selection
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
            throw new Error(errorData.detail || `Chat failed: ${response.statusText}`);
        }

        return response.json();
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

    async validateSpannerQuery(sessionId: string, sql: string) {
        const response = await fetch(`${API_BASE_URL}/spanner/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId, sql }),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Failed to execute query");
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

    async getConfidenceScore(source_code: string, target_code: string, conversion_report: string, type: 'schema' | 'query') {
        const response = await fetch(`${API_BASE_URL}/confidence`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source_code, target_code, conversion_report, type }),
        });
        if (!response.ok) throw new Error("Failed to get confidence score");
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
    },

    async connectSource(config: SourceConnectionConfig): Promise<SourceConnectionResponse> {
        const response = await fetch(`${API_BASE_URL}/source/connect`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(config),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
            throw new Error(errorData.detail || `Connection failed: ${response.statusText}`);
        }

        return response.json();
    },

    async connectSpanner(config: SpannerConnectionConfig): Promise<SpannerConnectionResponse> {
        const response = await fetch(`${API_BASE_URL}/spanner/connect`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(config),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
            throw new Error(errorData.detail || `Connection failed: ${response.statusText}`);
        }

        return response.json();
    }
};

export interface AnalyzeResponse {
    explanation: string;
    fixed_ddl: string;
}
