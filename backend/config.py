# backend/config.py

from dotenv import load_dotenv
import os

# Load the .env file from the root project directory
# The find_dotenv() function will automatically search upwards for the .env file
from dotenv import find_dotenv
load_dotenv(find_dotenv())

# Load all the environment variables into Python constants
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
RUNPOD_LLM_URL = os.getenv("RUNPOD_LLM_URL") 