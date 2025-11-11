# backend/services/llm_service.py

import json
import requests
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
import base64
from pathlib import Path
from PIL import Image
from typing import List, Dict, Optional
from .. import config
from ..database import queries


# --- THE FIX: Define the project root correctly, once. ---
# __file__ is in backend/services/llm_service.py
# .parent -> services
# .parent -> backend
# .parent -> brainstorming_app (the project root)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

# A simple in-memory cache for the detected API mode
# { "base_url": "pure_ollama" | "serverless" }
API_MODE_CACHE = {}

class LLMService:
    def __init__(self):
        if not config.GOOGLE_API_KEY:
            print("Warning: GOOGLE_API_KEY not found.")

    def _get_ollama_response_safely(self, url: str, payload: dict, timeout: int = 60) -> dict:
        """
        POSTs to the Ollama endpoint and returns parsed JSON.
        Defensive: checks content-type and logs raw body on unexpected responses.
        """
        response = requests.post(url, json=payload, timeout=timeout)
        
        # Check the Content-Type header before trying to parse as JSON
        content_type = response.headers.get('content-type', '')
        if 'application/json' not in content_type:
            print(f"ERROR: Ollama endpoint returned non-JSON response. Status: {response.status_code}")
            # Log some of the raw response for debugging
            raw_body = response.text or "<no body>"
            print(f"Raw Response Body (first 1000 chars): {raw_body[:1000]}...")
            # Raise a helpful error so callers can catch or propagate
            raise ValueError(f"Ollama server responded with unexpected content type: {content_type}. Status: {response.status_code}")

        response.raise_for_status()
        return response.json()
    
    def _prepare_image_for_ollama(self, attachment_path: str) -> Optional[str]:
        if not attachment_path:
            return None
        try:
            full_path = PROJECT_ROOT / "frontend" / attachment_path
            print(f"Opening image for Ollama: {full_path}")
            with open(full_path, "rb") as image_file:
                return base64.b64encode(image_file.read()).decode('utf-8')
        except Exception as e:
            print(f"Error processing image for Ollama: {e}")
            return None
        
    def _detect_and_cache_api_mode(self, base_url: str) -> str:
        """
        Detects the type of Ollama API at the given URL and caches the result.
        Returns 'pure_ollama' or 'serverless'.
        """
        if base_url in API_MODE_CACHE:
            return API_MODE_CACHE[base_url]

        print(f"--- No cached API mode found for {base_url}. Detecting... ---")
        
        # Test 1: Try Pure Ollama endpoint
        try:
            test_url = f"{base_url.rstrip('/')}/api/tags"
            response = requests.get(test_url, timeout=4)
            if response.status_code == 200:
                print(">>> Detected: Pure Ollama API")
                API_MODE_CACHE[base_url] = 'pure_ollama'
                return 'pure_ollama'
        except requests.exceptions.RequestException:
            pass # Failed, so try the next one

        # Test 2: Try Serverless/OpenAI-compatible endpoint
        # We send a request we expect to fail with a 401/405/422 but NOT a 404
        try:
            test_url = f"{base_url.rstrip('/')}/v1/chat/completions"
            response = requests.post(test_url, json={"model": "test"}, timeout=4)
            if response.status_code != 404:
                print(">>> Detected: Serverless / OpenAI-Compatible API")
                API_MODE_CACHE[base_url] = 'serverless'
                return 'serverless'
        except requests.exceptions.RequestException:
            pass

        # If both fail, raise an error
        raise ValueError(f"Could not determine API type for endpoint: {base_url}. Please check the URL and ensure the pod is running.")

    def _build_chat_system_instruction(self, node_context: str) -> str:
        """
        Returns a system instruction string used for chat modes (not brainstorm).
        This instruction forces direct answers and prevents "context police" behavior.
        """
        return (
            "You are a helpful assistant.\n"
            "You ALWAYS answer the user directly and concisely unless the user asks for detail.\n"
            "You may use world knowledge freely.\n"
            "The text below is ONLY background. It is NOT a constraint.\n"
            "NEVER say things like: 'the context does not specify' or 'based on the provided context'.\n"
            "NEVER refer to the background explicitly (do not say 'the context says' or similar).\n"
            "Answer normally, like a smart human.\n"
            "\n"
            "--- BACKGROUND ---\n"
            f"{node_context}\n"
            "------------------\n"
        )

    def _get_ollama_response(self, prompt: str, context: str, history: List[Dict], is_brainstorm: bool) -> str:
        """
        Low-level helper to call Ollama (supports pure_ollama and serverless).
        Returns the assistant text (string) for chat, or a raw response for brainstorm.
        """
        settings = queries.get_settings_db()
        base_url = settings.get('runpod_url')
        if not base_url:
            raise ValueError("RunPod URL is not configured in settings.")
        
        api_mode = self._detect_and_cache_api_mode(base_url)
        model_name = settings.get('ollama_model_name', 'llama3')
        print(f"Using Ollama model: {model_name} in '{api_mode}' mode.")

        if api_mode == 'pure_ollama':
            url = f"{base_url.rstrip('/')}/api/generate"
            if is_brainstorm:
                # Brainstorm must still return JSON object
                instruction = f'Directly respond to: "{prompt}"'
                if context:
                    instruction = f'Given context: "{context}", respond to: "{prompt}"'
                final_prompt = f'{instruction}\n\nYou MUST expand the answer so it is actually useful to the user.Format your entire output as a single, raw JSON object with keys "label" and "fullText".'
                payload = {"model": model_name, "prompt": final_prompt, "stream": False, "format": "json"}
                response_json = self._get_ollama_response_safely(url, payload)
                return response_json  # caller will parse
            else:
                # Chat mode: use system-style instruction + history + user message
                system_instruction = self._build_chat_system_instruction(context or "")
                final_prompt = system_instruction + "\n"
                # append history in a simple role: content format
                for h in history:
                    role = h.get('role', 'user')
                    content = h.get('parts', [''])[0]
                    final_prompt += f"{role}: {content}\n"
                final_prompt += f"user: {prompt}\nassistant:"
                payload = {"model": model_name, "prompt": final_prompt, "stream": False}
                response_json = self._get_ollama_response_safely(url, payload)
                # Ollama pure returns {'response': '...'} typically
                if isinstance(response_json, dict) and 'response' in response_json:
                    return response_json['response']
                # fallback to raw string if different shape
                return json.dumps(response_json)

        elif api_mode == 'serverless':
            url = f"{base_url.rstrip('/')}/v1/chat/completions"
            # Build system instruction as a message
            system_instruction = self._build_chat_system_instruction(context or "")
            history_for_api = [{"role": h.get('role', 'user'), "content": h.get('parts', [''])[0]} for h in history]
            if is_brainstorm:
                # Brainstorm: structured JSON output expected
                instruction = f'Directly respond to: "{prompt}"'
                if context:
                    instruction = f'Given context: "{context}", respond to: "{prompt}"'
                prompt_for_llm = f'{instruction}\n\nYou MUST expand the answer so it is actually useful to the user.Format your entire output as a single, raw JSON object with keys "label" and "fullText".'
                messages = [{"role": "user", "content": prompt_for_llm}]
                payload = {"model": model_name, "messages": messages, "stream": False}
                response = requests.post(url, json=payload, timeout=60)
                response.raise_for_status()
                return response.json()  # caller will parse
            else:
                # Chat mode: include the system instruction message and full history
                messages = [{"role": "user", "content": system_instruction}] + history_for_api + [{"role": "user", "content": prompt}]
                payload = {"model": model_name, "messages": messages, "stream": False}
                response = requests.post(url, json=payload, timeout=60)
                response.raise_for_status()
                # Standard OpenAI-compatible response shape
                choices = response.json().get('choices', [])
                if choices and 'message' in choices[0]:
                    return choices[0]['message']['content']
                # fallback
                return json.dumps(response.json())
        else:
            raise ValueError("Unknown API mode detected.")

    def _get_ollama_brainstorm(self, prompt: str, context: str = None, attachment_path: str = None) -> dict:
        settings = queries.get_settings_db()
        base_url = settings.get('runpod_url')
        if not base_url: raise ValueError("RunPod URL not configured in settings.")

        api_mode = 'pure_ollama' # We are standardizing on the pure Ollama template now
        url = f"{base_url.rstrip('/')}/api/generate"
        
        model_name = settings.get('ollama_model_name', 'llava') # Default to a vision model
        print(f"Using Ollama model: {model_name} in '{api_mode}' mode.")

        instruction = f'Directly respond to the user prompt about the provided context and/or image: "{prompt}"'
        if context: instruction = f'Given context: "{context}", respond to: "{prompt}"'
        prompt_for_llm = f'{instruction}\n\nYou MUST expand the answer so it is actually useful to the user.Format your entire output as a single, raw JSON object with keys "label" and "fullText".'

        payload = {"model": model_name, "prompt": prompt_for_llm, "stream": False, "format": "json"}
        
        # Add image data if present
        if attachment_path:
            base64_image = self._prepare_image_for_ollama(attachment_path)
            if base64_image:
                # LLaVA and other vision models expect the 'images' key
                payload['images'] = [base64_image]

        response = requests.post(url, json=payload, timeout=120) # Longer timeout for images
        response.raise_for_status()
        return json.loads(response.json()['response'])

    def _get_ollama_chat(self, history: List, user_message: str, node_context: str, attachment_path: str = None) -> str:
        settings = queries.get_settings_db(); base_url = settings.get('runpod_url')
        if not base_url: raise ValueError("RunPod URL is not configured.")
        url = f"{base_url.rstrip('/')}/api/generate"; model_name = settings.get('ollama_model_name', 'llava')
        
        final_prompt = f"System Context:\n{node_context}\n\n"
        for h in history: final_prompt += f"{h['role']}: {h['parts'][0]}\n"
        final_prompt += f"user: {user_message}\nassistant:"

        payload = {"model": model_name, "prompt": final_prompt, "stream": False}

        # --- THE FIX: Add the image to the payload ---
        if attachment_path:
            base64_image = self._prepare_image_for_ollama(attachment_path)
            if base64_image:
                payload['images'] = [base64_image]
        
        response = requests.post(url, json=payload, timeout=120)
        response.raise_for_status()
        return response.json()['response']

    # --- Full Gemini and public functions for safety ---
    def _get_gemini_brainstorm(self, prompt: str, context: str = None, attachment_path: str = None) -> dict:
        settings = queries.get_settings_db(); api_key = settings.get('gemini_api_key') or config.GOOGLE_API_KEY
        if not api_key: raise ValueError("Gemini API key is not configured.")
        genai.configure(api_key=api_key)
        
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        content = []
        # Put image first for better performance with vision models
        if attachment_path:
            try:
                full_path = PROJECT_ROOT / "frontend" / attachment_path

                img = Image.open(full_path)
                content.append(img)
            except Exception as e:
                print(f"Error opening image for Gemini: {e}")

        # Add the text prompt after the image
        instruction = f'Directly respond to: "{prompt}"' if prompt else "Describe the attached image in detail."
        if context: instruction = f'Given context: "{context}", respond to: "{prompt}"'
        structured_prompt = f'{instruction}\n\nFormat your output as a single JSON object with keys "label" and "fullText".'
        content.append(structured_prompt)

        try:
            response = model.generate_content(content)
            
            if not response.parts:
                print("Gemini response was blocked or empty.")
                return {"label": "Response Blocked", "fullText": "The AI response was blocked by safety filters."}
            
            cleaned_response_text = response.text.strip().replace('```json', '').replace('```', '')
            return json.loads(cleaned_response_text)

        except google_exceptions.ResourceExhausted as e:
            # --- THE FIX: Handle the rate limit error ---
            print(f"Gemini Rate Limit Exceeded: {e}")
            return {"label": "Rate Limit Error", "fullText": "Too many requests sent to the Gemini API. Please wait a minute and try again."}
        except json.JSONDecodeError:
            print(f"Gemini failed to return valid JSON. Raw text: {response.text}")
            return {"label": "Formatting Error", "fullText": f"AI failed to return valid JSON. Raw: '{response.text}'"}
        except Exception as e:
             # Handle other potential API errors
            print(f"An unexpected Gemini API error occurred: {e}")
            return {"label": "API Error", "fullText": f"An unexpected error occurred with the Gemini API: {str(e)}"}
    
    def _get_gemini_chat(self, history: List[Dict], user_message: str, node_context: str, attachment_path: str = None) -> str:
        print("we are initializing __get_gemini_chat func from llm_service.py")
        """
        Gemini chat mode that persists an image context across multiple turns.
        If an image was sent initially, it is automatically reattached for all later messages.
        """
        settings = queries.get_settings_db()
        api_key = settings.get('gemini_api_key') or config.GOOGLE_API_KEY
        if not api_key:
            raise ValueError("Gemini API key is not configured.")
        genai.configure(api_key=api_key)

        model = genai.GenerativeModel('gemini-2.0-flash')

        # Keep a static chat object and persistent image cache
        # so that the model remembers conversation history.
        if not hasattr(self, "_gemini_chat_session"):
            self._gemini_chat_session = model.start_chat(history=[])
            self._gemini_image = None

        # If this is the first call or a new image was uploaded, store it.
        if attachment_path:
            try:
                full_path = PROJECT_ROOT / "frontend" / attachment_path
                print(f"🖼️ Loading Gemini image from: {full_path}")

                img = Image.open(full_path)
                self._gemini_image = img
                print("✅ Stored new persistent image for Gemini chat session.")
            except Exception as e:
                print(f"⚠️ Error loading image for Gemini chat: {e}")

        try:
            # Build the multimodal message for this turn
            content = [
                f"Use the following as context for this conversation:\n{node_context}\n\n"
            ]

            # Always reattach the image if one was previously set
            if getattr(self, "_gemini_image", None):
                content.append(self._gemini_image)

            # Finally, add the user's new question or statement
            content.append(f"User message: {user_message}")

            # Send it to the chat session
            response = self._gemini_chat_session.send_message(content)

            return response.text if response.parts else "I'm sorry, I could not generate a response."

        except Exception as e:
            print(f"Gemini chat error: {e}")
            return f"An error occurred with the Gemini API: {str(e)}"

        
    # --- PUBLIC SWITCHER FUNCTIONS ---
    def get_brainstorm_response(self, prompt: str, context: str = None, attachment_path: str = None) -> dict:
        settings = queries.get_settings_db(); provider = settings.get('ai_provider', 'gemini')
        model_name_used = provider
        if provider == 'runpod':
            model_name_used = settings.get('ollama_model_name', 'llava')
            response_data = self._get_ollama_brainstorm(prompt, context, attachment_path)
            return {"response": response_data, "model_name": model_name_used}
        model_name_used = 'gemini-2.0-flash'
        response_data = self._get_gemini_brainstorm(prompt, context, attachment_path)
        return {"response": response_data, "model_name": model_name_used}

    def get_chat_response(self, history: List, user_message: str, node_context: str, attachment_path: str = None) -> dict:
        print("we are initializing get_chat_response func from llm_service.py")
        settings = queries.get_settings_db(); provider = settings.get('ai_provider', 'gemini')
        model_name_used = provider
        if provider == 'runpod':
            model_name_used = settings.get('ollama_model_name', 'llava')
            response_text = self._get_ollama_chat(history, user_message, node_context, attachment_path)
            return {"response": response_text, "model_name": model_name_used}
        model_name_used = 'gemini-2.0-flash'
        print(f"🔎 attachment_path received: {attachment_path!r}")
        print(f"📜 node_context: {node_context[:100]}...") 
        response_text = self._get_gemini_chat(history, user_message, node_context, attachment_path)
        return {"response": response_text, "model_name": model_name_used}
    
    
llm_service = LLMService()
