from typing import List, Dict
from app.knowledge_base import SPANNER_KNOWLEDGE_BASE, MAPPING_RULES

class ContextManager:
    def __init__(self):
        self.kb = SPANNER_KNOWLEDGE_BASE
        self.mappings = MAPPING_RULES

    def get_hints(self, source_ddl: str) -> List[Dict[str, str]]:
        """
        Scans source_ddl for keywords and returns relevant knowledge base entries.
        Returns a list of hints (topic, rule, syntax).
        """
        hints = []
        source_upper = source_ddl.upper()
        
        # Simple keyword matching for now. 
        # In a real RAG system, we would embed the source_ddl and semantic search.
        for entry in self.kb:
            # If ANY keyword matches, we include the hint
            for keyword in entry["keywords"]:
                if keyword in source_upper:
                    hints.append({
                        "topic": entry["topic"],
                        "rule": entry["rule"],
                        "syntax": entry["syntax"]
                    })
                    break # Avoid adding same hint multiple times if multiple keywords match
        
        return hints

    def get_mapping_rules(self, dialect: str) -> List[Dict[str, str]]:
        """
        Returns mapping rules for the specific dialect.
        """
        # Normalize dialect name (e.g. "postgres" -> "PostgreSQL")
        d = dialect.lower()
        if "postgres" in d:
            return self.mappings.get("PostgreSQL", [])
        elif "mysql" in d:
            return self.mappings.get("MySQL", [])
        return []

    def format_hints_for_prompt(self, hints: List[Dict[str, str]], mapping_rules: List[Dict[str, str]] = None) -> str:
        """
        Formats the hints and mapping rules into a string block for the LLM prompt.
        """
        if not hints and not mapping_rules:
            return ""
            
        block = "### DOCUMENTATION & SYNTAX REFERENCE (Based on Source Patterns)\n"
        
        if mapping_rules:
             block += "#### 1. DATA TYPE MAPPING RULES (Deterministic)\n"
             block += "You MUST apply the following type conversions:\n"
             block += "| Source Type | Spanner Type | Notes |\n"
             block += "|---|---|---|\n"
             for rule in mapping_rules:
                 block += f"| `{rule['source_type']}` | `{rule['spanner_type']}` | {rule['note']} |\n"
             block += "\n"

        if hints:
            block += "#### 2. DDL SYNTAX REFERENCE\n"
            block += "Use the following official Spanner DDL syntax definitions. **You must strictly adhere to this grammar.**\n\n"
            for i, hint in enumerate(hints, 1):
                block += f"**{hint['topic']}**\n"
                block += f"{hint['rule']}\n"
                block += f"```sql\n{hint['syntax'].strip()}\n```\n\n"
            
        return block

# Global instance
context_manager = ContextManager()
