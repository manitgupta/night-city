import asyncio
import os
import logging
from dotenv import load_dotenv

# Load env before importing agent
load_dotenv()

from app.agent import agent_service
from app.context_manager import context_manager

async def test_rag_conversion():
    source_ddl = """
    CREATE TABLE Orders (
        OrderId INT PRIMARY KEY,
        OrderDate TIMESTAMP
    );
    
    CREATE TABLE OrderItems (
        OrderId INT,
        ItemId INT,
        Quantity INT,
        PRIMARY KEY (OrderId, ItemId),
        FOREIGN KEY (OrderId) REFERENCES Orders(OrderId)
    );
    """
    
    print("--- Testing RAG Logic ---")
    ddl = context_manager.get_ddl_hints(source_ddl)
    features = context_manager.get_feature_hints(source_ddl)
    print(f"Detected DDL Hints: {len(ddl)}")
    print(f"Detected Feature Hints: {len(features)}")
    
    if any(h['topic'] == 'Interleaving Requirement' for h in features):
        print("SUCCESS: Detected 'Interleaving Requirement' feature hint.")
    else:
        print("FAILURE: Did not detect 'Interleaving Requirement' feature hint.")

    print("\n--- Running Conversion (Verification Disabled) ---")
    result = await agent_service.convert_schema(source_ddl, "MySQL", verify_ddl=False)
    
    print("\n--- Conversion Result ---")
    print(result['converted_ddl'])
    
    # Check if Interleave was used
    if "INTERLEAVE IN PARENT" in result['converted_ddl']:
        print("\nSUCCESS: Agent used INTERLEAVE IN PARENT!")
    else:
        print("\nWARNING: Agent did not use INTERLEAVE IN PARENT (or output format differed).")

if __name__ == "__main__":
    asyncio.run(test_rag_conversion())
