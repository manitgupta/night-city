from typing import List, Dict
from app.knowledge_base import SPANNER_KNOWLEDGE_BASE

class ContextManager:
    def __init__(self):
        self.kb = SPANNER_KNOWLEDGE_BASE

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

    def format_hints_for_prompt(self, hints: List[Dict[str, str]]) -> str:
        """
        Formats the hints into a string block for the LLM prompt.
        """
        if not hints:
            return ""
            
        block = "### DOCUMENTATION & SYNTAX REFERENCE (Based on Source Patterns)\n"
        block += "Use the following official Spanner DDL syntax definitions to guide your conversion:\n\n"
        
        for i, hint in enumerate(hints, 1):
            block += f"#### {i}. {hint['topic']}\n"
            block += f"{hint['rule']}\n"
            block += f"```sql\n{hint['syntax'].strip()}\n```\n\n"
            
        return block

# Global instance
context_manager = ContextManager()
