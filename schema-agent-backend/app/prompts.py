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

### STEP 2: PLAN SPANNER SCHEMA
*   **Interleaving**: Propose `INTERLEAVE IN PARENT` for tight 1:Many relationships (e.g., Order -> OrderItems).
*   **Primary Keys**: Replace sequential numeric IDs with `BIT_REVERSED_SEQUENCE` (if native support exists) or UUIDs (STRING(36)) to prevent hotspots.
*   **Data Types**: Map types to Spanner equivalents using the Mapping Rules.
*   **Indexes**: Suggest secondary indexes for frequently queried columns.

{hints}


### STEP 3: GENERATE SPANNER DDL
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
