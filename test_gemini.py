# test_gemini.py

import google.generativeai as genai
from dotenv import load_dotenv, find_dotenv
import os
from PIL import Image

# --- CONFIGURATION ---
# Load the .env file from the project root
load_dotenv(find_dotenv())
API_KEY = os.getenv("GOOGLE_API_KEY")

if not API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in .env file. Please ensure it's in the project root.")

genai.configure(api_key=API_KEY)

# The name of the image file you placed in the root directory
IMAGE_FILE = "random.jpg"
PROMPT = "Describe this image in detail."

# --- MAIN TEST FUNCTION ---
def run_vision_test():
    print(f"--- Starting Gemini Vision Test ---")
    print(f"Model: gemini-2.0-flash")
    print(f"Image File: {IMAGE_FILE}")
    print(f"Prompt: '{PROMPT}'")
    print("------------------------------------")

    try:
        # Check if the image file exists
        if not os.path.exists(IMAGE_FILE):
            print(f"\nERROR: Image file '{IMAGE_FILE}' not found in the project root directory.")
            print("Please place the image file here and try again.")
            return

        # Load the image
        img = Image.open(IMAGE_FILE)
        print("Image loaded successfully.")

        # Initialize the model
        model = genai.GenerativeModel('gemini-2.0-flash')
        print("Model initialized.")

        # Send the request to the Gemini API
        print("Sending request to Gemini...")
        response = model.generate_content([PROMPT, img])
        
        print("\n--- ✅ SUCCESS! ---")
        print("Gemini API responded successfully.")
        print("\n--- AI RESPONSE ---")
        print(response.text)
        print("--------------------")

    except Exception as e:
        print(f"\n--- ❌ TEST FAILED ---")
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc()

# Run the test
if __name__ == "__main__":
    run_vision_test()