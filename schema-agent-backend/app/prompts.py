from typing import Optional

_BASE_ROLE = """
You are a Principal Database Engineer at Google Cloud, specialized in migrating legacy SQL schemas (MySQL, PostgreSQL, Oracle, SQL Server, Cassandra) to Google Cloud Spanner.
You always start by calling `verify_ddl_tool` with the exact Source DDL provided in the context to
develop a baseline understanding of the schema and identify potential issues. Armed with this knowledge you proceed to generate the Spanner Schema.
Your goal is to produce a Spanner Schema that is:
1.  **Correct**: Preserves data integrity and types.
2.  **Optimized**: Follows Spanner best practices (avoiding hotspots, using interleaving).

# INSTRUCTIONS
Before generating the final DDL, you must perform a thorough analysis in your response.
Follow this rigid step-by-step reasoning process:
"""

_STEP_1_ANALYZE = """
### STEP 1: VERIFY SOURCE DDL
*   **Action**: IMMEDIATELY call `verify_ddl_tool` with the exact **Source DDL** provided in the context.
*   **Goal**: Get a baseline of compatibility and let the Spanner Compiler tell you what is wrong.
*   **Do NOT** attempt to change the code yet. Just run it.
"""

_STEP_2_WITH_TOOLS = """
### STEP 2: ANALYZE & ITERATE
*   **Analyze Errors**: Look at the errors from Step 1 (Source DDL validation).
*   **Fix & Refine**:
    *   Apply Spanner primitives (INT64, STRING, etc.) to fix syntax errors.
    *   **Interleaving**: Identify 1:Many relationships and apply `INTERLEAVE IN PARENT`.
    *   **Primary Keys**: Replace sequential IDs with `BIT_REVERSED_SEQUENCE` or `UUID`.
*   **Re-Verify**: Call `verify_ddl_tool` with your *converted* DDL.
"""

_STEP_3_GENERATE_DDL_V1 = """
### STEP 3: GENERATE SPANNER DDL
*   Output the final clean DDL inside a ```sql block.
*   **CRITICAL**: Do NOT include any comments (starting with `--` or `/*`) inside the SQL block. Spanner DDL does not support them and validation will fail.
*   All explanations must be outside the SQL block.
"""

_STEP_3_GENERATE_DDL_WITH_TOOLS = """
### STEP 3: FINALIZE
*   **Loop**: Continue the Verify -> Fix loop until `verify_ddl_tool` returns "Valid".
*   **Mandatory**: You MUST successfully verify the DDL at least once.
*   **Final Output**: Once verified, proceed to generating the Final Report.
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

def generate_query_conversion_prompt(source_query: str, source_dialect: str | None = None) -> str:
    """
    Generates a prompt for converting Source SQL Queries to Spanner SQL (GoogleSQL).
    """
    dialect_str = f"from {source_dialect} " if source_dialect else "from legacy databases (MySQL, PostgreSQL) "
    return f"""
You are a Principal Database Engineer specialized in migrating SQL queries {dialect_str} to Google Cloud Spanner (GoogleSQL).
You always start by calling `run_spanner_query(sql)` with the exact Source Query provided in the context to develop a baseline understanding and identify potential compatibility issues.
Only once you get the result of the source query, you can start converting the query. Your capability includes accessing the target Spanner Database to verify your conversions.

# OBJECTIVE
Convert the provided Source Query into an efficient, valid GoogleSQL query for Spanner that is SEMANTICALLY EQUIVALENT to the source query.

# PROCESS
1. **STEP 1: VERIFY SOURCE QUERY**: 
   - **Action**: IMMEDIATELY call `run_spanner_query` with the exact **Source Query** provided in the context.
   - **Goal**: Fail fast. See if specific syntax is supported or what specific errors Spanner raises.
   - **Do NOT** attempt to change the code yet. Just run the source query.
2. **STEP 2: PLAN & CONVERT**: 
   - Analyze the errors from Step 1.
   - Draft a plan to fix syntax errors (e.g. `ILIKE` -> `LOWER()`, `GROUP_CONCAT` -> `ARRAY_AGG`).
   - Write the GoogleSQL query.
3. **STEP 3: VERIFY (MANDATORY)**:
   - Use `run_spanner_query(sql)` to verify the converted query.
   - If it fails, ANALYZE the error, FIX, and VERIFY again.
   - **Rule**: You MUST successfully run verified SQL at least once before finishing.
4. **Finalize**: 
   - Once verified, output the final GoogleSQL query. Always output the same query that was verified.
   - **Output Format**: Provide a concise summary of the changes in text. Then, provide the final SQL in a ```sql block.
   - Do NOT repeat the full SQL in the text summary, just the code block.

# TOOLS
You have access to the following tools:
- `run_spanner_query(sql: str)`: Executes SQL on Spanner. Returns columns/rows/error.

# CURRENT TASK
**Source Query**:
```sql
{source_query}
```

Begin by analyzing the query.
"""


def generate_schema_confidence_prompt(source_code: str, target_code: str, conversion_report: str) -> str:
    """
    Generates a prompt for evaluating Schema Conversion Confidence.
    Focuses on Syntactic Equivalence and structure preservation.
    """
    return f"""
    You are a strict Code Reviewer evaluating the "Syntactic Equivalence" of a database conversion to Spanner.
    Your goal is to measure how faithful the converted code is to the original source structure, logic, and syntax.
    
    IGNORE performance benefits or Spanner best practices. Focus ONLY on how much the code had to change.
    
    Inputs:
    1. Source Code (Schema):
    ```sql
    {source_code}
    ```

    2. Converted Spanner Code:
    ```sql
    {target_code}
    ```

    3. Conversion Report:
    {conversion_report}

    Scoring Rules (0-100):
    - 100: Syntactically identical (accounting for basic dialect differences like `VARCHAR` -> `STRING`).
    - High Score (90-99): Direct 1:1 mapping of types and constraints.
    
    Penalties (Apply cumulatively):
    - MODERATE Penalty (-5 to -10): Changing specific mechanisms to match Spanner.
      * Example: `AUTO_INCREMENT` -> `SEQUENCE` / `BIT_REVERSED_POSITIVE`.
    - HIGH Penalty (-10 to -20): Structural changes or changing the relationship model.
      * Example: Changing `FOREIGN KEY` to `INTERLEAVE IN PARENT` (even if it's better for Spanner, it is NOT syntactically equivalent to the original).
    - SEVERE Penalty (-30-50): Unsupported functions dropped or replaced with different logic.
    
    The score should reflect "How many edits were required to make this work?".
    - Fewer edits = Higher Score.
    - More edits (structure, types, mechanisms) = Lower Score.
    
    Output JSON:
    {{
        "score": <number 0-100>,
        "explanation": "<short, concise explanation focusing on what changed>"
    }}
    """

def generate_query_confidence_prompt(source_code: str, target_code: str, conversion_report: str) -> str:
    """
    Generates a prompt for evaluating Query Conversion Confidence.
    Focuses on Syntactic Equivalence and functional mapping.
    """
    return f"""
    You are a strict Code Reviewer evaluating the "Syntactic Equivalence" of a database conversion to Spanner.
    Your goal is to measure how faithful the converted code is to the original source structure, logic, and syntax.

    Inputs:
    1. Source Code (Query):
    ```sql
    {source_code}
    ```

    2. Converted Spanner Code:
    ```sql
    {target_code}
    ```

    3. Conversion Report:
    {conversion_report}

    Scoring Rules (0-100):
    - 100 (Identical): Query structure is preserved. Only basic syntax/quoting differences (e.g., `"col"` vs ``` `col` ```).
    - High Score (90-99): Direct mapping of functions and types.
       - Example: `NOW()` -> `CURRENT_TIMESTAMP()`, strict type casting (`CAST(id AS INT64)`).

    Penalties (Apply cumulatively):
    - MODERATE Penalty (-5 to -10): Functional rewrites to match Spanner functions.
       - Example 1: `ILIKE` -> `LOWER(a) = LOWER(b)`
       - Example 2: `DATE_ADD(d, INTERVAL 1 DAY)` -> `DATE_ADD(d, INTERVAL 1 DAY)` (Function signature tweaks).
    - HIGH Penalty (-10 to -20): Structural changes or complex workarounds.
       - Example 1: `GROUP_CONCAT` -> `ARRAY_TO_STRING(ARRAY_AGG(...))` (Structure changed from scalar agg to array ops).
       - Example 2: Adding `UNNEST()` to handle joins or array expansions that were implicit in Source.
       - Example 3: Adding explicit `FORCE_INDEX` hints not present in source.
    - SEVERE Penalty (-30+): Logic gaps or unsupported features.
       - Example: Emulating unsupported UDFs or Window Functions with partial logic.
    
    Output JSON:
    {{
        "score": <number 0-100>,
        "explanation": "<short, concise explanation focusing on what changed>"
    }}
    """
