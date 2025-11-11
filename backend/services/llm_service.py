# backend/services/llm_service.py

import json
import requests
import google.generativeai as genai
from typing import List, Dict
from .. import config
from ..database import queries

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

    def _get_ollama_brainstorm(self, prompt: str, context: str = None) -> dict:
        """
        Brainstorm via Ollama and return parsed JSON {label, fullText}.
        This stays structured to keep brainstorm deterministic (Option B).
        """
        settings = queries.get_settings_db(); runpod_url = settings.get('runpod_url')
        if not runpod_url:
            raise ValueError("RunPod URL not configured.")
        model_name = settings.get('ollama_model_name', 'llama3')
        instruction = f'Directly respond to: "{prompt}"'
        if context:
            instruction = f'Given context: "{context}", respond to: "{prompt}"'
        prompt_for_llm = f'{instruction}\n\nYou MUST expand the answer so it is actually useful to the user.Format your entire output as a single, raw JSON object with keys "label" and "fullText".'
        payload = {"model": model_name, "prompt": prompt_for_llm, "stream": False, "format": "json"}
        url = f"{runpod_url.rstrip('/')}/api/generate"
        response_data = self._get_ollama_response_safely(url, payload)
        # response_data expected shape: {'response': '...'} where response is JSON string or already parsed
        if isinstance(response_data, dict) and 'response' in response_data:
            raw = response_data['response']
        else:
            raw = json.dumps(response_data)
        # defensive parse
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # try cleaning code fences
            cleaned = raw.strip().replace('```json', '').replace('```', '')
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                print(f"Ollama brainstorm failed to return valid JSON. Raw text: {raw}")
                return {"label": "Formatting Error", "fullText": "The AI failed to return a response in the correct JSON format."}

    def _get_ollama_chat(self, history: List, user_message: str, node_context: str) -> str:
        """
        Chat path for Ollama (pure or serverless), unified to the "background is not constraint"
        instruction. Returns assistant text.
        """
        # We proxy into _get_ollama_response with is_brainstorm=False to reuse detection logic
        result = self._get_ollama_response(
            user_message,
            f"{node_context}\n\nIMPORTANT: Do not limit to only the provided info. Think in all directions relevant to the topic. Use world knowledge freely.",
            history,
            is_brainstorm=False
        )
        # result is expected to be a string (assistant content) or serialized fallback
        if isinstance(result, str):
            return result
        # If dict returned unexpectedly, fallback to dumping readable string
        return json.dumps(result)

    # --- Full Gemini and public functions for safety ---
    def _get_gemini_brainstorm(self, prompt: str, context: str = None) -> dict:
        """
        Gemini brainstorm keeps JSON structured format (Option B).
        """
        settings = queries.get_settings_db()
        api_key = settings.get('gemini_api_key') or config.GOOGLE_API_KEY
        if not api_key:
            raise ValueError("Gemini API key is not configured in settings or .env file.")
        genai.configure(api_key=api_key)
        
        model = genai.GenerativeModel('gemini-2.0-flash')
        instruction = f'Directly respond to: "{prompt}"'
        if context:
            instruction = f'Given context: "{context}", take "{context}" as a starting point , think deep about the subject of context and related info to it and fields, respond to: "{prompt}"'
        structured_prompt = f'{instruction}\n\nFormat your output as a single JSON object with keys "label" and "fullText".'
        
        response = model.generate_content(structured_prompt)
        
        if not response.parts:
            print("Gemini brainstorm response was blocked or empty.")
            return {"label": "Response Blocked", "fullText": "The AI response was blocked by Gemini's safety filters."}
        
        # Defensive check for non-JSON response from Gemini
        try:
            cleaned_response_text = response.text.strip().replace('```json', '').replace('```', '')
            return json.loads(cleaned_response_text)
        except json.JSONDecodeError:
             print(f"Gemini brainstorm failed to return valid JSON. Raw text: {response.text}")
             return {"label": "Formatting Error", "fullText": "The AI failed to return a response in the correct JSON format."}
    
    def _get_gemini_chat(self, history: List, user_message: str, node_context: str) -> str:
        """
        Fully corrected Gemini chat function using the same system instruction as Ollama chat.
        This will ALWAYS answer the user directly and will not respond with "the context does not specify".
        """
        settings = queries.get_settings_db()
        api_key = settings.get('gemini_api_key') or config.GOOGLE_API_KEY
        if not api_key:
            raise ValueError("Gemini API key is not configured.")
        genai.configure(api_key=api_key)

        model = genai.GenerativeModel('gemini-2.0-flash')

        # SYSTEM INSTRUCTION (identical policy as ollama fix)
        system_instruction = self._build_chat_system_instruction(node_context and "do not limit to the info provided, think in all directions to the subject provided, no limits to answers")

        # Build chat history for Gemini
        gem_history = [{"role": "user", "parts": [system_instruction]}]

        # convert our history format to gemini format
        for h in history:
            r = h.get('role', 'user')
            c = h.get('parts', [''])[0]
            gem_history.append({"role": r, "parts": [c]})

        try:
            chat = model.start_chat(history=gem_history)
            resp = chat.send_message(user_message)
            if not resp.parts:
                return "I’m sorry, I couldn’t generate a response."
            return resp.text
        except Exception as e:
            print(f"Gemini chat error: {e}")
            return f"Gemini error: {str(e)}"

    def get_brainstorm_response(self, prompt: str, context: str = None) -> dict:
        settings = queries.get_settings_db()
        provider = settings.get('ai_provider', 'gemini')
        
        if provider == 'runpod':
            model_name = settings.get('ollama_model_name', 'llama3')
            response_data = self._get_ollama_brainstorm(prompt, context)
            return {"response": response_data, "model_name": model_name}
        
        # Default to Gemini
        model_name = 'gemini-2.0-flash'
        response_data = self._get_gemini_brainstorm(prompt, context)
        return {"response": response_data, "model_name": model_name}

    def get_chat_response(self, history: List, user_message: str, node_context: str) -> dict:
        settings = queries.get_settings_db(); provider = settings.get('ai_provider', 'gemini')
        model_name_used = provider
        
        if provider == 'runpod':
            model_name_used = settings.get('ollama_model_name', 'llama3')
            response_text = self._get_ollama_chat(history, user_message, node_context)
            return {"response": response_text, "model_name": model_name_used}
        
        # Gemini provider
        response_text = self._get_gemini_chat(history, user_message, node_context)
        model_name_used = 'gemini-2.0-flash'
        return {"response": response_text, "model_name": model_name_used}
    
    
llm_service = LLMService()
