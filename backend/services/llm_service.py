# backend/services/llm_service.py

import json
import httpx
import asyncio
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
import base64
from pathlib import Path
from PIL import Image
import io
from typing import List, Dict, Optional
from .. import config
from ..database import queries

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

class LLMService:
    def __init__(self):
        if not config.GOOGLE_API_KEY:
            print("Warning: GOOGLE_API_KEY not found.")
        self.async_http_client = httpx.AsyncClient(timeout=120.0)

    async def _get_named_chat_response(self, model_name: str, history: List[Dict], user_message: str, node_context: str, attachment_path: str = None) -> dict:
        """
        A wrapper that calls the correct AI service and returns the result
        bundled with the model name.
        """
        response_text = ""
        try:
            if 'gemini' in model_name.lower():
                response_text = await self._get_gemini_chat(history, user_message, node_context, attachment_path)
            else: # Assume Ollama
                # This logic to temporarily set settings is complex but necessary for now
                original_settings = queries.get_settings_db()
                queries.update_settings_db({'ollama_model_name': model_name})
                response_text = await self._get_ollama_chat(history, user_message, node_context, attachment_path)
                queries.update_settings_db(original_settings) # Restore
            
            return {"model_name": model_name, "response": response_text}
        
        except Exception as e:
            print(f"Group Chat: EXCEPTION from model {model_name}: {e}")
            return {"model_name": model_name, "response": f"An error occurred: {str(e)}"}
        
    # --- PRIVATE ASYNC HELPERS ---
    def _prepare_image_for_ollama(self, attachment_path: str) -> Optional[str]:
        if not attachment_path: return None
        try:
            full_path = PROJECT_ROOT / "frontend" / attachment_path
            with Image.open(full_path) as img:
                if img.mode != 'RGB': img = img.convert('RGB')
                buffer = io.BytesIO()
                img.save(buffer, format="PNG")
                img_bytes = buffer.getvalue()
                return base64.b64encode(img_bytes).decode('utf-8')
        except Exception as e:
            print(f"Error processing image for Ollama: {e}"); return None

    # MODIFY this function in backend/services/llm_service.py

    async def _get_ollama_response_safely(self, url: str, payload: dict) -> dict:
        response = await self.async_http_client.post(url, json=payload)
        content_type = response.headers.get('content-type', '')
        
        # --- THE FIX: Handle the "ndjson" stream format ---
        # The 'application/x-ndjson' type means "newline-delimited JSON"
        if 'application/x-ndjson' in content_type or 'application/json' in content_type:
            response.raise_for_status()
            
            # Split the response text by newlines to handle multiple JSON objects
            lines = response.text.strip().split('\n')
            last_json_object = None
            
            for line in lines:
                if line.strip():
                    try:
                        last_json_object = json.loads(line)
                    except json.JSONDecodeError:
                        print(f"Warning: Skipping invalid JSON line in stream: {line}")
                        continue
            
            if last_json_object:
                # Return the VERY LAST valid JSON object from the stream
                return last_json_object
            else:
                raise ValueError("Ollama server returned an empty or invalid JSON stream.")
                
        else: # Fallback for completely unexpected content types
            raw_body = response.text or "<no body>"
            raise ValueError(f"Ollama server responded with unexpected content type: {content_type}. Body: {raw_body[:500]}")

    # --- ASYNC PRIVATE METHODS FOR EACH PROVIDER ---
    # MODIFY this function in backend/services/llm_service.py

    # MODIFY this function in backend/services/llm_service.py

    async def _get_ollama_brainstorm(self, prompt: str, context: str = None, attachment_path: str = None) -> dict:
        settings = queries.get_settings_db(); base_url = settings.get('runpod_url')
        if not base_url: raise ValueError("RunPod URL is not configured.")
        
        url = f"{base_url.rstrip('/')}/api/generate"
        model_name = settings.get('ollama_model_name', 'llava')
        
        instruction = f'Directly respond to: "{prompt}"'
        if context: instruction = f'Given context: "{context}", respond to: "{prompt}"'
        prompt_for_llm = f'{instruction}\n\nYour entire response MUST be a single, raw JSON object with keys "label" and "fullText".'
        
        payload = {"model": model_name, "prompt": prompt_for_llm, "stream": False, "format": "json"}
        if attachment_path:
            base64_image = self._prepare_image_for_ollama(attachment_path)
            if base64_image: payload['images'] = [base64_image]

        response_data = await self._get_ollama_response_safely(url, payload)
        
        # --- THE DEFINITIVE FIX ---
        # Check for the JSON string in the non-standard 'thinking' key first,
        # then fall back to the standard 'response' key.
        ai_json_str = response_data.get('thinking') or response_data.get('response', '')
        
        print(f"--- Extracted content for parsing: '{ai_json_str}' ---")

        try:
            # If the string is empty or invalid, this will raise an error
            if not ai_json_str or not isinstance(ai_json_str, str):
                raise json.JSONDecodeError("Content is not a valid string.", ai_json_str or "", 0)
            
            parsed_json = json.loads(ai_json_str)
            if 'label' in parsed_json and 'fullText' in parsed_json:
                print("Successfully parsed structured JSON from Ollama.")
                return parsed_json
            else:
                raise ValueError("Parsed JSON is missing required keys.")
        except (json.JSONDecodeError, ValueError):
            print(f"Warning: Could not parse structured JSON from model '{model_name}'. Falling back to plain text.")
            # If the model put plain text in the 'response' key, use that.
            plain_text_response = response_data.get('response', '') or str(response_data)
            return {
                "label": prompt if prompt else "Image Analysis",
                "fullText": plain_text_response
            }

    async def _get_ollama_chat(self, history: List, user_message: str, node_context: str, attachment_path: str = None) -> str:
        settings = queries.get_settings_db(); base_url = settings.get('runpod_url')
        if not base_url: raise ValueError("RunPod URL not configured.")
        url = f"{base_url.rstrip('/')}/api/generate"
        model_name = settings.get('ollama_model_name', 'llava')
        final_prompt = f"System Context:\n{node_context}\n\n"
        for h in history: final_prompt += f"{h['role']}: {h['parts'][0]}\n"
        final_prompt += f"user: {user_message}\nassistant:"
        payload = {"model": model_name, "prompt": final_prompt, "stream": False}
        if attachment_path:
            base64_image = self._prepare_image_for_ollama(attachment_path)
            if base64_image: payload['images'] = [base64_image]
        response_data = await self._get_ollama_response_safely(url, payload)
        return response_data.get('response', "Error: Empty response from Ollama.")

    async def _get_gemini_brainstorm(self, prompt: str, context: str = None, attachment_path: str = None) -> dict:
        settings = queries.get_settings_db(); api_key = settings.get('gemini_api_key') or config.GOOGLE_API_KEY
        if not api_key: raise ValueError("Gemini API key is not configured.")
        genai.configure(api_key=api_key); model = genai.GenerativeModel('gemini-2.0-flash')
        content = []
        if attachment_path:
            try:
                full_path = PROJECT_ROOT / "frontend" / attachment_path
                img = Image.open(full_path)
                content.append(img)
            except Exception as e: return {"label": "Image Error", "fullText": f"Could not open image: {e}"}
        user_prompt = prompt if prompt else "Describe image."
        if context: user_prompt = f'Given context: "{context}", respond to: "{prompt}"'
        structured_prompt = f'{user_prompt}\n\nFormat your output as a single JSON object with keys "label" and "fullText".'
        content.append(structured_prompt)
        try:
            response = await model.generate_content_async(content)
            if not response.parts: return {"label": "Response Blocked", "fullText": "AI response was blocked."}
            return json.loads(response.text.strip().replace('```json', '').replace('```', ''))
        except Exception as e:
            return {"label": "API Error", "fullText": f"An unexpected error occurred: {str(e)}"}

    async def _get_gemini_chat(self, history: List[Dict], user_message: str, node_context: str, attachment_path: str = None) -> str:
        settings = queries.get_settings_db(); api_key = settings.get('gemini_api_key') or config.GOOGLE_API_KEY
        if not api_key: raise ValueError("Gemini API key is not configured.")
        genai.configure(api_key=api_key); model = genai.GenerativeModel('gemini-2.0-flash')
        initial_user_turn_parts = [f"CONTEXT:\n{node_context}\n\nHow can I help?"]
        if attachment_path:
            try:
                full_path = PROJECT_ROOT / "frontend" / attachment_path
                img = Image.open(full_path)
                initial_user_turn_parts.append(img)
            except Exception as e: print(f"Error adding image to Gemini chat: {e}")
        full_history = [{'role': 'user', 'parts': initial_user_turn_parts}, {'role': 'model', 'parts': ["Understood."]}] + history
        try:
            chat = model.start_chat(history=full_history)
            response = await chat.send_message_async(user_message)
            return response.text if response.parts else "I'm sorry, I could not generate a response."
        except Exception as e:
            print(f"Gemini chat error: {e}"); return f"Gemini error: {str(e)}"

    # --- THIS IS THE PUBLIC API FOR THE SERVICE ---

    async def get_brainstorm_response(self, prompt: str, context: str = None, attachment_path: str = None) -> dict:
        settings = queries.get_settings_db(); provider = settings.get('ai_provider', 'gemini')
        model_name_used = provider
        if provider == 'runpod':
            model_name_used = settings.get('ollama_model_name', 'llava')
            response_data = await self._get_ollama_brainstorm(prompt, context, attachment_path)
            return {"response": response_data, "model_name": model_name_used}
        model_name_used = 'gemini-2.0-flash'
        response_data = await self._get_gemini_brainstorm(prompt, context, attachment_path)
        return {"response": response_data, "model_name": model_name_used}

    async def get_chat_response(self, history: List, user_message: str, node_context: str, attachment_path: str = None) -> dict:
        settings = queries.get_settings_db(); provider = settings.get('ai_provider', 'gemini')
        model_name_used = provider
        if provider == 'runpod':
            model_name_used = settings.get('ollama_model_name', 'llava')
            response_text = await self._get_ollama_chat(history, user_message, node_context, attachment_path)
            return {"response": response_text, "model_name": model_name_used}
        model_name_used = 'gemini-2.0-flash'
        response_text = await self._get_gemini_chat(history, user_message, node_context, attachment_path)
        return {"response": response_text, "model_name": model_name_used}

    # MODIFY this function in backend/services/llm_service.py

    async def get_group_chat_responses(self, participants: List[str], history: List[Dict], user_message: str, node_context: str, attachment_path: str = None, target_model: str = None):
        
        # --- THE DEFINITIVE FIX ---
        participants_to_call = []
        if target_model and target_model in participants:
            # If a specific, valid model is targeted, only call that one.
            participants_to_call = [target_model]
            print(f"Directed Message: Targeting only {target_model}")
        else:
            # Otherwise, broadcast to all participants.
            participants_to_call = participants
            print(f"Group Chat: Broadcasting to all participants: {participants_to_call}")
        # --- END OF FIX ---

        tasks_with_names = []
        for model_name in participants_to_call: # This now uses the correct, filtered list
            task = None
            if 'gemini' in model_name.lower():
                task = self._get_gemini_chat(history, user_message, node_context, attachment_path)
                tasks_with_names.append((model_name, task))
            else: # Assume Ollama
                original_settings = queries.get_settings_db()
                queries.update_settings_db({'ollama_model_name': model_name})
                
                task = self._get_ollama_chat(history, user_message, node_context, attachment_path)
                tasks_with_names.append((model_name, task))
                
                queries.update_settings_db(original_settings)

        all_tasks = [t[1] for t in tasks_with_names]
        results = await asyncio.gather(*all_tasks, return_exceptions=True)

        for i, result in enumerate(results):
            model_name = tasks_with_names[i][0]
            if isinstance(result, Exception):
                response_text = f"An error occurred: {str(result)}"
                print(f"Group Chat Error from {model_name}: {result}")
            else:
                response_text = result
                print(f"Group Chat Response from {model_name}")
            
            yield {"model_name": model_name, "response": response_text}


llm_service = LLMService()