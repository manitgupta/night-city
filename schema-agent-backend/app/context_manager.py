from typing import List, Dict
from app.knowledge_base import DDL_SYNTAX_KNOWLEDGE_BASE, MAPPING_RULES_KNOWLEDGE_BASE, FEATURE_BASED_KNOWLEDGE_BASE

class ContextManager:
    def __init__(self):
        self.ddl_kb = DDL_SYNTAX_KNOWLEDGE_BASE
        self.feature_kb = FEATURE_BASED_KNOWLEDGE_BASE
        self.mappings = MAPPING_RULES_KNOWLEDGE_BASE

    def get_ddl_hints(self, source_ddl: str) -> List[Dict[str, str]]:
        """
        Scans source_ddl for keywords and returns relevant DDL Syntax definitions.
        """
        hints = []
        source_upper = source_ddl.upper()
        
        for entry in self.ddl_kb:
            for keyword in entry["keywords"]:
                if keyword in source_upper:
                    hints.append(entry)
                    break 
        return hints

    def get_feature_hints(self, source_ddl: str) -> List[Dict[str, str]]:
        """
        Scans source for patterns triggering specific Feature rules (e.g. Interleaving checks).
        """
        hints = []
        source_upper = source_ddl.upper()
        
        for entry in self.feature_kb:
            for keyword in entry["keywords"]:
                if keyword in source_upper:
                    hints.append(entry)
                    break
        return hints

    def get_mapping_rules(self, dialect: str) -> List[Dict[str, str]]:
        """
        Returns mapping rules for the specific dialect.
        """
        d = dialect.lower()
        if "postgres" in d:
            return self.mappings.get("PostgreSQL", [])
        elif "mysql" in d:
            return self.mappings.get("MySQL", [])
        elif "oracle" in d:
            return self.mappings.get("Oracle", [])
        elif "sqlserver" in d:
            return self.mappings.get("SQL Server", [])
        elif "cassandra" in d or "cql" in d:
            return self.mappings.get("Cassandra", [])
        return []

    def format_hints_for_prompt(self, ddl_hints: List[Dict[str, str]], feature_hints: List[Dict[str, str]], mapping_rules: List[Dict[str, str]]) -> str:
        """
        Formats all hints into a string block for the LLM prompt.
        """
        if not ddl_hints and not feature_hints and not mapping_rules:
            return ""
            
        block = "### DOCUMENTATION & SYNTAX REFERENCE (Based on Source Patterns)\n"
        
        # 1. Mappings
        if mapping_rules:
            block += "#### 1. MAPPING HINTS (Deterministic Data Types)\n"
            block += "You MUST apply the following type conversions:\n"
            block += "| Source Type | Spanner Type | Notes |\n"
            block += "|---|---|---|\n"
            for rule in mapping_rules:
                block += f"| `{rule['source_type']}` | `{rule['spanner_type']}` | {rule['note']} |\n"
            block += "\n"

        # 2. Feature Hints
        if feature_hints:
            block += "#### 2. FEATURE HINTS (Critical Logic)\n"
            for i, hint in enumerate(feature_hints, 1):
                block += f"**{hint['topic']}**\n"
                block += f"Rule: {hint['rule']}\n"
                if hint.get("syntax"):
                    block += f"Reference: `{hint['syntax']}`\n"
                block += "\n"

        # 3. DDL Syntax
        if ddl_hints:
            block += "#### 3. DDL HINTS (Syntax Reference)\n"
            block += "Use the following official Spanner DDL syntax definitions. **You must strictly adhere to this grammar.**\n\n"
            for i, hint in enumerate(ddl_hints, 1):
                block += f"**{hint['topic']}**\n"
                block += f"{hint['rule']}\n"
                block += f"```sql\n{hint['syntax'].strip()}\n```\n\n"
            
        return block

# Global instance
context_manager = ContextManager()
