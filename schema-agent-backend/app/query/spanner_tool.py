from typing import Dict, Any, List
from google.cloud import spanner
import logging
import asyncio
from app.models import SpannerConnectionConfig
from app.query.interface import SourceDatabaseTool

logger = logging.getLogger(__name__)

class SpannerDatabaseTool(SourceDatabaseTool):
    def __init__(self, config: SpannerConnectionConfig):
        self.config = config
        self.client = None
        self.instance = None
        self.database = None

    def _get_database(self):
        if not self.database:
            if not self.client:
                self.client = spanner.Client(project=self.config.project_id)
            if not self.instance:
                self.instance = self.client.instance(self.config.instance_id)
            self.database = self.instance.database(self.config.database_id)
        return self.database

    async def verify_connection(self) -> bool:
        def _verify():
            database = self._get_database()
            with database.snapshot() as snapshot:
                results = snapshot.execute_sql("SELECT 1")
                for _ in results:
                    pass
            return True

        try:
            return await asyncio.to_thread(_verify)
        except Exception as e:
            logger.error(f"Spanner Connection Verification Failed: {e}")
            return False

    async def run_query(self, sql: str) -> Dict[str, Any]:
        def _run():
            database = self._get_database()
            with database.snapshot() as snapshot:
                results = snapshot.execute_sql(sql)
                
                # Spanner returns 'StreamedResultSet' which we can iterate
                # We need to extract columns and rows
                # Note: 'fields' availability might depend on whether results are consumed
                
                rows = []
                columns = []
                
                # Consume first to get metadata if possible, or just iterate
                # google.cloud.spanner returns Row objects
                for row in results:
                    rows.append(list(row))
                
                if results.fields:
                    columns = [field.name for field in results.fields]
                    
                return {"columns": columns, "rows": rows}

        try:
            return await asyncio.to_thread(_run)
        except Exception as e:
            logger.error(f"Spanner Run Query Failed: {e}")
            return {"error": str(e)}

    async def explain_query(self, sql: str) -> Dict[str, Any]:
        # Spanner supports query execution plans.
        # We can use profile/plan mode.
        try:
            # For now, just execute it as a query since regular SQL might not have direct EXPLAIN syntax 
            # effectively standardized across drivers, but we can try basic execution execution or specific hints.
            # Actually, Spanner client has `execute_sql` with `query_mode`.
            # We'll implement a specific explain logic if possible, or just fallback to run_query for now
            # since the interface expects a dict.
            # Let's try to get the query plan.
            
            def _explain():
                database = self._get_database()
                with database.snapshot() as snapshot:
                    # QUERY_MODE_PLAN gives the plan without execution stats
                    # QUERY_MODE_PROFILE gives plan + stats
                    from google.cloud.spanner_v1 import Type
                    from google.cloud.spanner_v1.types import ResultSetStats
                    
                    # We need to access the underlying method or use appropriate flags
                    # The python client supports query_mode in execute_sql
                    # But it returns a StreamedResultSet. We need to check stats.
                    
                    # However, strictly returning JSON might be tricky without parsing.
                    # For simplicity in this iteration, we just run the query and return it,
                    # or maybe just return a placeholder feature not yet fully supported.
                    
                    # Let's try a simple approach: Just run it.
                    # TODO: Implement full visual query plan later.
                    pass
            
            # Placeholder:
            # return await self.run_query(f"DESCRIBE ({sql})") 
            # actually let's just return a message
            return {"message": "Explain not fully implemented for Spanner yet"}

        except Exception as e:
            logger.error(f"Spanner Explain Failed: {e}")
            return {"error": str(e)}
