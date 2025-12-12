from typing import Optional

def generate_cot_prompt(source_ddl: str, dialect: str, hints: str = "") -> str:
    """
    Generates a Chain-of-Thought prompt for SQL conversion.
    """
    return f"""
You are a Principal Database Engineer at Google Cloud, specialized in migrating legacy SQL schemas (MySQL, PostgreSQL, Oracle) to Google Cloud Spanner.
Your goal is to produce a Spanner Schema that is:
1.  **Correct**: Preserves data integrity and types.
2.  **Optimized**: Follows Spanner best practices (avoiding hotspots, using interleaving).

# INSTRUCTIONS
Before generating the final DDL, you must perform a thorough analysis in your response.
Follow this rigid step-by-step reasoning process:

### STEP 1: ANALYZE SOURCE SCHEMA & GRAMMAR
*   **Parse the Source DDL**: Identify all tables, columns, keys, and constraints.
*   **Consult the Reference**: Look at the "DOCUMENTATION & SYNTAX REFERENCE" provided below.
*   **Type Mapping**: Check the "DATA TYPE MAPPING RULES" table. You MUST apply these specific conversions (e.g., `SERIAL` -> `INT64`).
*   **Grammar Compliance**: deeply understand the Spanner DDL grammar provided in the "DDL SYNTAX REFERENCE". Ensure your generated DDL strictly follows this syntax (e.g., correct placement of `INTERLEAVE IN PARENT`, valid `OPTIONS`).
*   **Scope Filtering**: Ignore database-level commands such as `CREATE DATABASE`, `USE`, `CREATE SCHEMA`, and character set/collation configurations. Your task is strictly limited to Tables, Indexes, and Constraints.

### STEP 2: PLAN SPANNER SCHEMA
*   **Interleaving**: Propose `INTERLEAVE IN PARENT` for tight 1:Many relationships (e.g., Order -> OrderItems).
*   **Primary Keys**: Replace sequential numeric IDs with `BIT_REVERSED_SEQUENCE` (if native support exists) or UUIDs (STRING(36)) to prevent hotspots.
*   **Data Types**: Map types to Spanner equivalents using the Mapping Rules.
*   **Indexes**: Suggest secondary indexes for frequently queried columns.

{hints}

### STEP 3: GENERATE CONVERSION REPORT
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

### STEP 4: GENERATE SPANNER DDL
*   Output the final clean DDL inside a ```sql block.
*   **CRITICAL**: Do NOT include any comments (starting with `--` or `/*`) inside the SQL block. Spanner DDL does not support them and validation will fail.
*   All explanations must be outside the SQL block.

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
