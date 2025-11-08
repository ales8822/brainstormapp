# run.py

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",  # The path to your FastAPI app
        host="127.0.0.1",
        port=8000,
        reload=True        # Uvicorn's reload feature is enabled here
    )