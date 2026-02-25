import asyncio
import httpx
import json
import uuid
import sys

from main import app

async def test_migration():
    # Use a tiny public repo. It has a pom.xml and some basic classes. 
    # The agent should clone it, read it, and realize it's an java app.
    test_repo = "https://github.com/spring-projects/spring-petclinic.git"
    
    print(f"Starting test migration for: {test_repo}")
    
    # Instead of ASGITransport, we will hit the live development server
    # to ensure chunks stream in real-time without buffering.
    # Note: ensure that `uvicorn main:app --reload --port 8001` is running!
    live_server_url = "http://localhost:8001"
    
    async with httpx.AsyncClient() as client:
        payload = {
            "github_url": test_repo
        }
        
        # We need to stream the response
        try:
            async with client.stream("POST", f"{live_server_url}/api/migrate-app", json=payload, timeout=600.0) as response:
                if response.status_code != 200:
                    print(f"Failed with status: {response.status_code}")
                    text = await response.aread()
                    print(text)
                    return
                
                async for line in response.aiter_lines():
                    if line:
                        try:
                            # Parse NDJSON chunk
                            chunk = json.loads(line)
                            
                            type_ = chunk.get("type")
                            if type_ == "live_activity":
                                print(f"🟢 [ACTIVITY] {chunk.get('content')}")
                            elif type_ == "log":
                                print(f"   [LOG] {chunk.get('content')}")
                            elif type_ == "thought":
                                print(f"💭 [THOUGHT] {chunk.get('content')}")
                            elif type_ == "result":
                                print(f"\n✅ [RESULT]\n{chunk.get('report')}")
                            elif type_ == "error":
                                print(f"❌ [ERROR] {chunk.get('content')}")
                            else:
                                print(f"   [UKNOWN] {chunk}")
                                
                        except json.JSONDecodeError:
                            print(f"Failed to parse JSON: {line}")
                            
        except Exception as e:
            print(f"Exception during test: {e}")

if __name__ == "__main__":
    asyncio.run(test_migration())
