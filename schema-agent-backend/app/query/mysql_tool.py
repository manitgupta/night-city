from typing import Dict, Any, List
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
import logging
import asyncio
from urllib.parse import quote_plus
from app.models import SourceConnectionConfig
from app.query.interface import SourceDatabaseTool

logger = logging.getLogger(__name__)

class MySQLDatabaseTool(SourceDatabaseTool):
    def __init__(self, config: SourceConnectionConfig):
        self.config = config
        # Construct connection string
        # mysql+pymysql://user:password@host:port/dbname
        encoded_user = quote_plus(config.username)
        encoded_password = quote_plus(config.password)
        self.url = f"mysql+pymysql://{encoded_user}:{encoded_password}@{config.host}:{config.port}/{config.database}"
        self.engine = None

    def _get_engine(self) -> Engine:
        if not self.engine:
            self.engine = create_engine(self.url, echo=False)
        return self.engine

    async def verify_connection(self) -> bool:
        def _verify():
            engine = self._get_engine()
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        
        try:
            return await asyncio.to_thread(_verify)
        except Exception as e:
            logger.error(f"MySQL Connection Verification Failed: {e}")
            return False

    async def run_query(self, sql: str) -> Dict[str, Any]:
        def _run():
            engine = self._get_engine()
            with engine.connect() as conn:
                result = conn.execute(text(sql))
                
                if result.returns_rows:
                    columns = list(result.keys())
                    rows = [list(row) for row in result.fetchall()]
                    return {"columns": columns, "rows": rows}
                else:
                    conn.commit()
                    return {"columns": [], "rows": [], "message": f"Affected {result.rowcount} rows"}

        try:
            return await asyncio.to_thread(_run)
        except Exception as e:
             logger.error(f"MySQL Run Query Failed: {e}")
             return {"error": str(e)}

    async def explain_query(self, sql: str) -> Dict[str, Any]:
        try:
            # MySQL EXPLAIN FORMAT=JSON is best if available (MySQL 5.6+)
            explain_sql = f"EXPLAIN FORMAT=JSON {sql}"
            result = await self.run_query(explain_sql)
            
            if "error" in result:
                 # Fallback to normal EXPLAIN
                 explain_sql = f"EXPLAIN {sql}"
                 return await self.run_query(explain_sql)
            
            return result
        except Exception as e:
            logger.error(f"MySQL Explain Failed: {e}")
            return {"error": str(e)}
