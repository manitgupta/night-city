from typing import Optional

_BASE_ROLE = """
You are a Principal Database Engineer at Google Cloud, specialized in migrating legacy SQL schemas (MySQL, PostgreSQL, Oracle) to Google Cloud Spanner.
Your goal is to produce a Spanner Schema that is:
1.  **Correct**: Preserves data integrity and types.
2.  **Optimized**: Follows Spanner best practices (avoiding hotspots, using interleaving).

# INSTRUCTIONS
Before generating the final DDL, you must perform a thorough analysis in your response.
Follow this rigid step-by-step reasoning process:
"""

_STEP_1_ANALYZE = """
### STEP 1: ANALYZE SOURCE SCHEMA & GRAMMAR
*   **Parse the Source DDL**: Identify all tables, columns, keys, and constraints.
*   **Consult the Reference**: Look at the "DOCUMENTATION & SYNTAX REFERENCE" provided below.
*   **Type Mapping**: Check the "DATA TYPE MAPPING RULES" table. You MUST apply these specific conversions (e.g., `SERIAL` -> `INT64`).
*   **Grammar Compliance**: deeply understand the Spanner DDL grammar provided in the "DDL SYNTAX REFERENCE". Ensure your generated DDL strictly follows this syntax (e.g., correct placement of `INTERLEAVE IN PARENT`, valid `OPTIONS`).
*   **Scope Filtering**: Ignore database-level commands such as `CREATE DATABASE`, `USE`, `CREATE SCHEMA`, and character set/collation configurations. Your task is strictly limited to Tables, Indexes, and Constraints.
"""

_STEP_2_PLAN_BASE = """
### STEP 2: PLAN SPANNER SCHEMA
*   **Interleaving**: Propose `INTERLEAVE IN PARENT` for tight 1:Many relationships (e.g., Order -> OrderItems).
*   **Primary Keys**: Replace sequential numeric IDs with `BIT_REVERSED_SEQUENCE` (if native support exists) or UUIDs (STRING(36)) to prevent hotspots.
*   **Data Types**: Map types to Spanner equivalents using the Mapping Rules.
*   **Indexes**: Suggest secondary indexes for frequently queried columns.
"""

_STEP_2_WITH_TOOLS = """
### STEP 2: PLAN SPANNER SCHEMA
*   **Interleaving**: Propose `INTERLEAVE IN PARENT` for tight 1:Many relationships (e.g., Order -> OrderItems).
*   **Primary Keys**: Replace sequential numeric IDs with `BIT_REVERSED_SEQUENCE` (if native support exists) or UUIDs (STRING(36)) to prevent hotspots.
*   **Data Types**: Map types to Spanner equivalents using the Mapping Rules.
*   **Indexes**: Suggest secondary indexes for frequently queried columns.
*   **Verification Strategy**: Plan how you will use the `verify_ddl_tool` to validate your DDL.
"""

_STEP_3_GENERATE_DDL_V1 = """
### STEP 3: GENERATE SPANNER DDL
*   Output the final clean DDL inside a ```sql block.
*   **CRITICAL**: Do NOT include any comments (starting with `--` or `/*`) inside the SQL block. Spanner DDL does not support them and validation will fail.
*   All explanations must be outside the SQL block.
"""

_STEP_3_GENERATE_DDL_WITH_TOOLS = """
### STEP 3: GENERATE AND VERIFY SPANNER DDL
*   Refine your DDL based on the analysis.
*   **MANDATORY**: You have access to `verify_ddl_tool`. You MUST use it to verify your DDL is valid.
*   **DO NOT** output the final DDL immediately.
*   **DO NOT** assume your DDL is perfect. Capturing complex constraints often requires trial and error.
*   **ACTION**: Call `verify_ddl_tool(ddl="...")` with your candidate DDL.
*   **LOOP**:
    1. If `verify_ddl_tool` returns errors: Analyze the error, Fix the DDL, Call `verify_ddl_tool` again.
    2. If `verify_ddl_tool` returns "Valid": You are done with the DDL. Proceed to generating the Final Report.
"""

_STEP_4_REPORT = """
### STEP 4: GENERATE CONVERSION REPORT
Create a **Markdown** report summarizing the conversion. This report will be shown to the user.
Use the following format:

## Conversion Report
### ✅ Successfully Converted
*   List tables/objects that were directly mapped.

### ⚠️ Partially Converted
*   List objects that required significant changes or had features stripped (e.g., `FULLTEXT` indexes, Stored Procedures).
*   Explain WHY they were modified.

### 🚫 Ignored / Unsupported
*   List features that were completely ignored (e.g., `Foreign Keys` if not enforced, `Triggers`, `Views` if complex).
*   Explain why they are not supported in Spanner.
"""

def generate_cot_prompt(source_ddl: str, dialect: str, hints: str = "") -> str:
    """
    Generates a Chain-of-Thought prompt for SQL conversion (V1 Standard).
    """
    return f"""
{_BASE_ROLE}

{_STEP_1_ANALYZE}

{_STEP_2_PLAN_BASE}

{hints}

{_STEP_3_GENERATE_DDL_V1}

{_STEP_4_REPORT}

---

# CURRENT TASK
**Source Dialect**: {dialect}
**Source DDL**:

```sql
{source_ddl}
```

Begin your response with "### STEP 1: ANALYZE".
"""

def generate_cot_prompt_with_tools(source_ddl: str, dialect: str, hints: str = "") -> str:
    """
    Generates a Chain-of-Thought prompt for SQL conversion with Tool Use (V2).
    """
    return f"""
{_BASE_ROLE}

{_STEP_1_ANALYZE}

{_STEP_2_WITH_TOOLS}

{hints}

{_STEP_3_GENERATE_DDL_WITH_TOOLS}

{_STEP_4_REPORT}

---

# CURRENT TASK
**Source Dialect**: {dialect}
**Source DDL**:

```sql
{source_ddl}
```

Begin your response with "### STEP 1: ANALYZE".
"""

def generate_analyze_prompt(source_ddl: str, generated_ddl: str, error_message: str) -> str:
    """
    Generates a prompt for analyzing and fixing DDL errors.
    """
    return f"""
You are an expert Spanner Database Engineer.
You MUST IGNORE database-level commands (CREATE DATABASE, USE, etc) and focus only on schema objects.
The following Spanner DDL generated from the Source DDL failed validation.

Source DDL:
```sql
{source_ddl}
```

Generated Spanner DDL:
```sql
{generated_ddl}
```

Validation Error:
{error_message}

INSTRUCTION:
1. Analyze the error strictly relative to Spanner DDL syntax and constraints.
2. Identify the root cause (e.g., unsupported type, missing parent table, illegal option).
3. Provide a corrected version of the DDL.
4. Return the result in valid JSON format with the following keys:
   - "explanation": A concise string explaining the error and the fix.
   - "fixed_ddl": The fully corrected Spanner DDL block.

CRITICAL: Return ONLY JSON. No markdown formatting around the JSON.
"""


def generate_analysis_prompt_v2(source_ddl: str, dialect: str, hints: str = "") -> str:
    """
    Generates a prompt for Agent 1: Analysis & Planning.
    Output MUST be JSON.
    """
    return f"""
{_BASE_ROLE}

### AGENT 1: ANALYSIS & PLANNING
Your task is to analyze the source schema and plan the Spanner conversion.
**You must NOT generate the final DDL.** Your output will be consumed by the "Conversion Agent" and the User Interface.

### STEP 1: ANALYZE SOURCE SCHEMA
*   **Parse Source DDL**: Identify all tables, columns, constraints (PKs, FKs, Checks), and sequences.
*   **Identify Features**: List specific SQL features used (e.g., `SERIAL`, `TEXT`, `JSONB`, `STORED PROCEDURES`).
*   **Search Grounding (MANDATORY)**: You MUST use the `google_search` tool to look up the official Spanner DDL syntax for the identified features.
    *   *Requirement*: Perform at least one search query to verify the latest syntax.
    *   *Function Verification*: If the source DDL uses specific SQL functions (e.g., `NOW()`, `uuid_generate_v4()`, `jsonb_build_object()`) or if you plan to use Spanner functions (e.g., `CURRENT_TIMESTAMP()`, `GENERATE_UUID()`), you MUST search to verify:
        1. That the Spanner function actually exists.
        2. Its correct syntax/signature.
    *   *Search Examples*: 
        - "Spanner replacement for PostgreSQL SERIAL bit reversed sequence"
        - "Spanner INTERLEAVE IN PARENT syntax"
        - "Spanner equivalent for PostgreSQL NOW()"
        - "Does Google Cloud Spanner have GENERATE_UUID function?"

### STEP 2: PLAN CONVERSION
*   **Mapping Strategy**: Define how each identified complex feature will be mapped to Spanner.
*   **Optimizations**: specific Spanner optimizations (e.g., `INTERLEAVE IN PARENT`, `BIT_REVERSED_SEQUENCE`).

### STEP 3: OUTPUT FORMAT (JSON ONLY)
Return a valid JSON object with this exact structure:
{{
  "analysis": {{
    "source_dialect": "{dialect}",
    "features_identified": ["list", "of", "features"],
    "primary_key_strategy": "description of strategy",
    "search_findings": "Summary of what you found via search (optional)",
    "recommendations": ["list", "of", "recommendations"]
  }},
  "plan": {{
    "tables": [
      {{
        "name": "table_name",
        "interleaving": "PARENT_TABLE (if applicable) or null",
        "notes": "specific notes for this table"
      }}
    ],
    "verification_strategy": "How to verify validity"
  }}
}}

{hints}

---

# CURRENT TASK
**Source Dialect**: {dialect}
**Source DDL**:
```sql
{source_ddl}
```

**CRITICAL**: Output composed of JSON ONLY. Do NOT wrap in markdown code blocks.
"""

def generate_conversion_prompt_v2(source_ddl: str, dialect: str, analysis_json: str) -> str:
    """
    Generates a prompt for Agent 2: Conversion & Verification.
    """
    return f"""
{_BASE_ROLE}

### AGENT 2: CONVERSION & VERIFICATION
You are the Execution Agent. You receive an "Analysis Plan" from the Lead Analyst and the "Source DDL".
Your goal is to generate the VALID Spanner DDL and verify it.

### INPUT DATA
**Source Dialect**: {dialect}
**Analysis & Plan**:
```json
{analysis_json}
```
**Source DDL**:
```sql
{source_ddl}
```

### INSTRUCTIONS
1.  **Review Plan**: Follow the strategies outlined in the Analysis JSON.
2.  **Generate DDL**: Write the full Spanner DDL.
3.  **Verify**: You MUST use the `verify_ddl_tool` to check your DDL.
4.  **Iterate**: If verification fails, fix the DDL and verify again.
5.  **Final Output**: Once verified, output the final DDL in a ```sql block.

{_STEP_3_GENERATE_DDL_WITH_TOOLS}

{_STEP_4_REPORT}
"""
