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

    def _get_ollama_response(self, prompt: str, context: str, history: List[Dict], is_brainstorm: bool) -> str:
        settings = queries.get_settings_db()
        base_url = settings.get('runpod_url')
        if not base_url: raise ValueError("RunPod URL is not configured in settings.")
        
        api_mode = self._detect_and_cache_api_mode(base_url)
        model_name = settings.get('ollama_model_name', 'llama3')
        print(f"Using Ollama model: {model_name} in '{api_mode}' mode.")

        # --- ADAPTIVE LOGIC ---
        if api_mode == 'pure_ollama':
            url = f"{base_url.rstrip('/')}/api/generate"
            if is_brainstorm:
                final_prompt = f'Given context: "{context}", respond to: "{prompt}"\n\nFormat your entire output as a single, raw JSON object with keys "label" and "fullText".'
            else:
                final_prompt = f"System Context:\n{context}\n\n"
                for h in history: final_prompt += f"{h['role']}: {h['parts'][0]}\n"
                final_prompt += f"user: {prompt}\nassistant:"
            
            payload = {"model": model_name, "prompt": final_prompt, "stream": False}
            if is_brainstorm: payload['format'] = 'json'
            
            response = requests.post(url, json=payload)
            response.raise_for_status()
            return response.json()['response']

        elif api_mode == 'serverless':
            url = f"{base_url.rstrip('/')}/v1/chat/completions"
            
            history_for_api = [{"role": h['role'], "content": h['parts'][0]} for h in history]
            if is_brainstorm:
                 prompt_for_llm = f'Given context: "{context}", respond to: "{prompt}"\n\nFormat your entire output as a single, raw JSON object with keys "label" and "fullText".'
                 messages = [{"role": "user", "content": prompt_for_llm}]
            else:
                messages = [{"role": "system", "content": f"Use this as context:\n{context}"}] + history_for_api + [{"role": "user", "content": prompt}]

            payload = {"model": model_name, "messages": messages, "stream": False}
            response = requests.post(url, json=payload)
            response.raise_for_status()
            return response.json()['choices'][0]['message']['content']
        
        else:
             raise ValueError("Unknown API mode detected.")

    def _get_ollama_brainstorm(self, prompt: str, context: str = None) -> dict:
        ai_content_str = self._get_ollama_response(prompt, context or "", [], True)
        return json.loads(ai_content_str)

    def _get_ollama_chat(self, history: List, user_message: str, node_context: str) -> str:
        return self._get_ollama_response(user_message, node_context, history, False)



    # --- Full Gemini and public functions for safety ---
    def _get_gemini_brainstorm(self, prompt: str, context: str = None) -> dict:
        settings = queries.get_settings_db()
        api_key = settings.get('gemini_api_key') or config.GOOGLE_API_KEY
        if not api_key: raise ValueError("Gemini API key is not configured in settings or .env file.")
        
        # Configure the API key just before the call
        genai.configure(api_key=api_key)
        
        model = genai.GenerativeModel('gemini-2.0-flash')
        instruction = f'Directly respond to: "{prompt}"'
        if context: instruction = f'Given context: "{context}", respond to: "{prompt}"'
        structured_prompt = f'{instruction}\n\nFormat your output as a single JSON object with keys "label" and "fullText".'
        
        response = model.generate_content(structured_prompt)
        if not response.parts: 
            return {"label": "Response Blocked", "fullText": "AI response was blocked by Gemini's safety filters."}
        
        cleaned_response_text = response.text.strip().replace('```json', '').replace('```', '')
        return json.loads(cleaned_response_text)
    
    def _get_gemini_chat(self, history: List, user_message: str) -> str:
        settings = queries.get_settings_db()
        api_key = settings.get('gemini_api_key') or config.GOOGLE_API_KEY
        if not api_key: raise ValueError("Gemini API key is not configured in settings or .env file.")

        # Configure the API key just before the call
        genai.configure(api_key=api_key)
        
        model = genai.GenerativeModel('gemini-2.0-flash')
        chat = model.start_chat(history=history)
        response = chat.send_message(user_message)
        return response.text if response.parts else "I'm sorry, I could not generate a response for that prompt."

    def get_brainstorm_response(self, prompt: str, context: str = None) -> dict:
        settings = queries.get_settings_db()
        provider = settings.get('ai_provider', 'gemini')
        if provider == 'runpod':
            return self._get_ollama_brainstorm(prompt, context)
        return self._get_gemini_brainstorm(prompt, context)

    def get_chat_response(self, history: List, user_message: str, node_context: str) -> str:
        settings = queries.get_settings_db()
        provider = settings.get('ai_provider', 'gemini')
        if provider == 'runpod':
            return self._get_ollama_chat(history, user_message, node_context)
        return self._get_gemini_chat(history, user_message)
    
    
llm_service = LLMService()