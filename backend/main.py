import os
import google.generativeai as genai
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables from the .env file
load_dotenv()

# Configure the Gemini API key
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("No GOOGLE_API_KEY found in environment variables.")
genai.configure(api_key=api_key)

# Initialize the FastAPI app
app = FastAPI()

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
        # Initialize the Gemini model
        # NOTE: As of now, the model is 'gemini-1.5-flash'. 'gemini-2.0-flash' is a placeholder for the future.
        # We will use the latest available flash model.
        model = genai.GenerativeModel('gemini-2.0-flash')

        # Generate content using the provided prompt
        response = model.generate_content(request.prompt)

        # Return the generated text
        return {"response": response.text}
    except Exception as e:
        # Handle potential errors during API call
        return {"error": str(e)}

# A simple root endpoint to check if the server is running
@app.get("/")
def read_root():
    return {"status": "Brainstorming API is running!"}