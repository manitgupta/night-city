import asyncio
import json
import os
import sys

# Load environment variables
from dotenv import load_dotenv
load_dotenv(override=True)

# Ensure clean import of app modules
sys.path.append(os.getcwd())

from app.agent import agent_service

SOURCE_DDL = """
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    amount DECIMAL(10, 2)
);
"""

async def run_test():
    print("Starting Multi-Agent Flow Test (Direct Service Call)...")
    
    logs = []
    thoughts = []
    result = None
    
    try:
        # Call the Async Generator directly
        stream = agent_service.multi_turn_convert_schema_stream_v2(
            source_ddl=SOURCE_DDL,
            dialect="PostgreSQL"
        )
        
        async for chunk in stream:
            # Chunk is already a dict, not a JSON string
            data = chunk
            
            if data["type"] == "log":
                logs.append(data["content"])
                print(f"[LOG] {data['content']}")
            elif data["type"] == "thought":
                thoughts.append(data["content"])
                print(f"[THOUGHT] {data['content'][:100]}...")
            elif data["type"] == "result":
                result = data
                print(f"[RESULT] Received Result")
                
    except Exception as e:
        print(f"[ERROR] Exception during test: {e}")
        import traceback
        traceback.print_exc()

    # Assertions
    print("\n--- Verifying Results ---")
    if not logs:
        print("FAILED: No logs captured.")
        exit(1)
        
    phase1_started = any("PHASE 1" in log for log in logs)
    phase2_started = any("PHASE 2" in log for log in logs)
    
    if phase1_started:
        print("PASSED: Phase 1 (Analysis) started.")
    else:
        print("FAILED: Phase 1 did not start.")
        
    if phase2_started:
        print("PASSED: Phase 2 (Conversion) started.")
    else:
        print("FAILED: Phase 2 did not start.")
        
    if result and result.get("converted_ddl"):
        print("PASSED: Received Converted DDL.")
        print("DDL Preview:")
        print(result["converted_ddl"][:200] + "...")
    else:
        print("FAILED: No valid result or DDL empty.")
        exit(1)
        
    print("\nTest Passed Successfully!")

if __name__ == "__main__":
    asyncio.run(run_test())
