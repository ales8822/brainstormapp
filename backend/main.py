import os
import google.generativeai as genai
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware # <-- ADD THIS IMPORT

# Load environment variables from the .env file
load_dotenv()

# Configure the Gemini API key
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("No GOOGLE_API_KEY found in environment variables.")
genai.configure(api_key=api_key)

# Initialize the FastAPI app
app = FastAPI()

# --- ADD CORS MIDDLEWARE ---
# This allows your frontend (running on a different address) to communicate with your backend.
origins = [
    "http://127.0.0.1:5500", # Common address for VS Code Live Server
    "http://localhost:5500", # Also a common address for VS Code Live Server
    "http://localhost:8000", # Allow requests from backend itself (for docs)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, etc.)
    allow_headers=["*"], # Allows all headers
)
# -------------------------

# Define the data model for incoming requests
class BrainstormRequest(BaseModel):
    prompt: str

# Create an endpoint to handle brainstorming requests
@app.post("/api/brainstorm")
async def brainstorm_idea(request: BrainstormRequest):
    """
    Receives a prompt and uses Gemini to brainstorm on it.
    """
    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(request.prompt)
        return {"response": response.text}
    except Exception as e:
        return {"error": str(e)}

# A simple root endpoint to check if the server is running
@app.get("/")
def read_root():
    return {"status": "Brainstorming API is running!"}