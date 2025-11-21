# backend/services/llm_service.py (FINAL - WITH MEETING MINUTES)

import json
import httpx
import asyncio
import google.generativeai as genai
import base64
from pathlib import Path
from PIL import Image
import io
import os
from typing import List, Dict, Optional, AsyncGenerator, Tuple

from fastapi.concurrency import run_in_threadpool 
from .. import config
from .settings_service import SettingsService

class LLMService:
    def __init__(self, settings_service: SettingsService):
        self.settings_service = settings_service
        self.async_http_client = httpx.AsyncClient(timeout=120.0)

    # --- HELPER WRAPPER FOR TRUE STREAMING ---
    async def _run_and_tag_task(self, coro, model_name: str) -> Tuple[str, str]:
        """
        Runs a coroutine and returns its result along with the model_name tag.
        This is a robust way to associate results with their source.
        """
        try:
            result = await coro
            return model_name, result
        except Exception as e:
            # If the coroutine fails, tag the exception with the model name
            return model_name, f"An error occurred: {str(e)}"

    async def get_available_models(self) -> List[str]:
        """
        Safely retrieves models from the configured Ollama/RunPod instance.
        Returns an empty list if the URL is invalid or the connection fails.
        """
        try:
            base_url = await self.settings_service.get_setting('runpod_url')

            if not base_url or not base_url.strip().lower().startswith("http"):
                print("[LLMService] Skipping model fetch: No valid RunPod/Ollama URL configured.")
                return []

            url = f"{base_url.strip().rstrip('/')}/api/tags"
            
            # Use the class's shared http client with a short timeout for this check
            response = await self.async_http_client.get(url, timeout=5.0)
            response.raise_for_status()  # Raise an exception for 4xx or 5xx status codes
            
            data = response.json()
            
            model_names = [model['name'] for model in data.get('models', []) if 'name' in model]
            return model_names
            
        except httpx.RequestError as e:
            # Catches connection errors, timeouts, DNS errors etc.
            print(f"[LLMService] Warning: Could not connect to Ollama to fetch models. Error: {e}")
            return []
        except Exception as e:
            # Catches JSON errors, status code errors, etc.
            print(f"[LLMService] Warning: Failed to get or parse Ollama models. Error: {e}")
            return []
        
    def _prepare_image_for_ollama(self, attachment_path: str) -> Optional[str]:
        if not attachment_path: return None
        try:
            filename = os.path.basename(attachment_path)
            full_path = config.UPLOAD_DIR / filename
            with Image.open(full_path) as img:
                if img.mode != 'RGB': img = img.convert('RGB')
                buffer = io.BytesIO()
                img.save(buffer, format="PNG")
                img_bytes = buffer.getvalue()
                return base64.b64encode(img_bytes).decode('utf-8')
        except Exception as e:
            print(f"Error processing image for Ollama: {e}"); return None

    async def _get_ollama_response_safely(self, url: str, payload: dict) -> dict:
        response = await self.async_http_client.post(url, json=payload)
        content_type = response.headers.get('content-type', '')
        if 'application/x-ndjson' in content_type or 'application/json' in content_type:
            response.raise_for_status()
            lines = response.text.strip().split('\n')
            last_json_object = None
            for line in lines:
                if line.strip():
                    try:
                        last_json_object = json.loads(line)
                    except json.JSONDecodeError: continue
            if last_json_object: return last_json_object
            else: raise ValueError("Ollama server returned an empty or invalid JSON stream.")
        else:
            raw_body = response.text or "<no body>"
            raise ValueError(f"Ollama server responded with unexpected content type: {content_type}. Body: {raw_body[:500]}")

    async def _get_ollama_brainstorm(self, prompt: str, context: str = None, attachment_path: str = None) -> Tuple[Dict, str]:
        base_url = await self.settings_service.get_setting('runpod_url')
        if not base_url: raise ValueError("RunPod URL is not configured.")
        url = f"{base_url.rstrip('/')}/api/generate"
        model_name = await self.settings_service.get_setting('ollama_model_name', 'llava')
        instruction = f'Directly respond to: "{prompt}"'
        if context: instruction = f'Given context: "{context}", respond to: "{prompt}"'
        prompt_for_llm = f'{instruction}\n\nYour entire response MUST be a single, raw JSON object with keys "label" and "fullText".'
        payload = {"model": model_name, "prompt": prompt_for_llm, "stream": False, "format": "json"}
        if attachment_path:
            base64_image = self._prepare_image_for_ollama(attachment_path)
            if base64_image: payload['images'] = [base64_image]
        response_data = await self._get_ollama_response_safely(url, payload)
        ai_json_str = response_data.get('thinking') or response_data.get('response', '')
        try:
            if not ai_json_str or not isinstance(ai_json_str, str): raise json.JSONDecodeError("Content is not a valid string.", ai_json_str or "", 0)
            parsed_json = json.loads(ai_json_str)
            if 'label' in parsed_json and 'fullText' in parsed_json: return parsed_json, model_name
            else: raise ValueError("Parsed JSON is missing required keys.")
        except (json.JSONDecodeError, ValueError):
            plain_text_response = response_data.get('response', '') or str(response_data)
            return {"label": prompt if prompt else "Image Analysis", "fullText": plain_text_response}, model_name

    async def _get_ollama_chat(self, model_name: str, history: List, user_message: str, node_context: str, attachment_path: str = None) -> str:
        base_url = await self.settings_service.get_setting('runpod_url')
        if not base_url: raise ValueError("RunPod URL is not configured.")
        url = f"{base_url.rstrip('/')}/api/generate"
        final_prompt = f"System Context:\n{node_context}\n\n"
        for h in history: final_prompt += f"{h['role']}: {h['parts'][0]}\n"
        final_prompt += f"user: {user_message}\nassistant:"
        payload = {"model": model_name, "prompt": final_prompt, "stream": False}
        if attachment_path:
            base64_image = self._prepare_image_for_ollama(attachment_path)
            if base64_image: payload['images'] = [base64_image]
        response_data = await self._get_ollama_response_safely(url, payload)
        return response_data.get('response', "Error: Empty response from Ollama.")

    async def _get_gemini_brainstorm(self, prompt: str, context: str = None, attachment_path: str = None) -> Tuple[Dict, str]:
        api_key = await self.settings_service.get_gemini_key()
        if not api_key: raise ValueError("Gemini API key is not configured.")
        model_name = 'gemini-2.0-flash'
        def configure_and_get_model():
            genai.configure(api_key=api_key)
            return genai.GenerativeModel(model_name)
        model = await run_in_threadpool(configure_and_get_model)
        content = []
        if attachment_path:
            def open_image():
                try:
                    filename = os.path.basename(attachment_path)
                    full_path = config.UPLOAD_DIR / filename
                    return Image.open(full_path)
                except Exception as e: return e
            img_or_error = await run_in_threadpool(open_image)
            if isinstance(img_or_error, Exception): return {"label": "Image Error", "fullText": f"Could not open image: {img_or_error}"}, model_name
            content.append(img_or_error)
        user_prompt = prompt if prompt else "Describe image."
        if context: user_prompt = f'Given context: "{context}", respond to: "{prompt}"'
        structured_prompt = f'{user_prompt}\n\nFormat your output as a single JSON object with keys "label" and "fullText".'
        content.append(structured_prompt)
        try:
            response = await model.generate_content_async(content)
            if not response.parts: return {"label": "Response Blocked", "fullText": "AI response was blocked."}, model_name
            json_text = response.text.strip().replace('```json', '').replace('```', '')
            return json.loads(json_text), model_name
        except Exception as e: return {"label": "API Error", "fullText": f"An unexpected error occurred: {str(e)}"}, model_name

    async def _get_gemini_chat(self, history: List[Dict], user_message: str, node_context: str, attachment_path: str = None) -> str:
        api_key = await self.settings_service.get_gemini_key()
        if not api_key: raise ValueError("Gemini API key is not configured.")
        model_name = 'gemini-2.0-flash'
        def configure_and_get_model():
            genai.configure(api_key=api_key)
            return genai.GenerativeModel(model_name)
        model = await run_in_threadpool(configure_and_get_model)
        initial_user_turn_parts = [f"CONTEXT:\n{node_context}\n\nHow can I help?"]
        if attachment_path:
            try:
                filename = os.path.basename(attachment_path)
                full_path = config.UPLOAD_DIR / filename
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

    async def get_brainstorm_response(self, prompt: str, context: str = None, attachment_path: str = None) -> dict:
        provider = await self.settings_service.get_setting('ai_provider', 'gemini')
        if provider == 'runpod':
            response_data, model_name = await self._get_ollama_brainstorm(prompt, context, attachment_path)
        else:
            response_data, model_name = await self._get_gemini_brainstorm(prompt, context, attachment_path)
        return {"response": response_data, "model_name": model_name}

    async def get_chat_response(self, history: List, user_message: str, node_context: str, attachment_path: str = None) -> dict:
        provider = await self.settings_service.get_setting('ai_provider', 'gemini')
        
        # --- ADD FALLBACK LOGIC ---
        use_ollama = provider == 'runpod'
        if use_ollama:
            # Health check: Can we actually reach Ollama?
            available_models = await self.get_available_models()
            if not available_models:
                print("[LLMService] Fallback Warning: Ollama is configured but unreachable. Falling back to Gemini for this request.")
                use_ollama = False # Force fallback to Gemini
        # --- END FALLBACK LOGIC ---

        if use_ollama:
            model_name = await self.settings_service.get_setting('ollama_model_name', 'llava')
            response_text = await self._get_ollama_chat(model_name, history, user_message, node_context, attachment_path)
        else: # This block now runs for Gemini OR as a fallback
            model_name = 'gemini-2.0-flash'
            response_text = await self._get_gemini_chat(history, user_message, node_context, attachment_path)
        
        return {"response": response_text, "model_name": model_name}

    async def get_group_chat_responses(self, participants: List[str], history: List[Dict], user_message: str, node_context: str, attachment_path: str = None, target_model: str = None) -> AsyncGenerator[Dict, None]:
        
        participants_to_call = target_model if target_model and target_model in participants else participants

        # --- ADD FALLBACK LOGIC FOR OLLAMA MODELS ---
        ollama_models = [p for p in participants_to_call if 'gemini' not in p.lower()]
        gemini_models = [p for p in participants_to_call if 'gemini' in p.lower()]
        
        final_participants = gemini_models
        
        if ollama_models:
            # Health check: Can we actually reach Ollama?
            available_ollama_models = await self.get_available_models()
            if not available_ollama_models:
                print(f"[LLMService] Fallback Warning: Ollama is configured but unreachable. Skipping {len(ollama_models)} Ollama participants for this group chat.")
                # We simply don't add them to final_participants
            else:
                final_participants.extend(ollama_models)
        # --- END FALLBACK LOGIC ---

        tasks = []
        for model_name in final_participants:
            coro = None
            if 'gemini' in model_name.lower():
                coro = self._get_gemini_chat(history, user_message, node_context, attachment_path)
            else: 
                coro = self._get_ollama_chat(model_name, history, user_message, node_context, attachment_path)
            
            tasks.append(self._run_and_tag_task(coro, model_name))

        for completed_task in asyncio.as_completed(tasks):
            model_name, response_text = await completed_task
            
            if "An error occurred" in response_text:
                 print(f"Group Chat Error from {model_name}: {response_text}")
            else:
                 print(f"Group Chat Response received from {model_name}")

            yield {"model_name": model_name, "response": response_text}

    async def run_meeting_turn(self, topic: str, company_context: str, agent_name: str, persona_prompt: str, history: List[Dict] = []) -> str:
        system_prompt = f"""
        You are participating in a board meeting.
        Your Persona: {persona_prompt}
        
        Meeting Topic: {topic}
        Company Context: {company_context}
        
        Your Goal: Provide a concise, insightful contribution to the discussion based on your persona. 
        Do not repeat what others have said. Focus on your specific area of expertise.
        Keep your response under 100 words.
        """
        
        user_trigger = "It is your turn to speak. Please provide your input."
        
        if 'gemini' in agent_name.lower():
            return await self._get_gemini_chat(history, user_trigger, system_prompt)
        else:
            return await self._get_ollama_chat(agent_name, history, user_trigger, system_prompt)

    async def synthesize_meeting_minutes(self, topic: str, company_context: str, transcript: List[Dict]) -> str:
        """
        Generate formal meeting minutes from the transcript.
        transcript should be a list of dicts with 'agent' and 'statement' keys.
        """
        # Build the transcript text
        transcript_text = ""
        for entry in transcript:
            agent = entry.get('agent', 'Unknown')
            statement = entry.get('statement', '')
            transcript_text += f"**{agent}**: {statement}\n\n"
        
        system_prompt = f"""
        You are an AI Executive Secretary tasked with synthesizing meeting minutes.
        
        Meeting Topic: {topic}
        Company Context: {company_context}
        
        Your task is to create a professional, well-structured meeting summary in Markdown format.
        
        Include the following sections:
        1. **Executive Summary** - A brief overview of the meeting's purpose and key outcomes
        2. **Key Discussion Points** - Main topics discussed, organized by theme
        3. **Decisions & Recommendations** - Clear action items and strategic recommendations
        4. **Participant Perspectives** - Brief summary of each participant's main contribution
        5. **Next Steps** - Suggested follow-up actions
        
        Be concise but comprehensive. Use professional business language.
        Format your response in clean Markdown with proper headers, bullet points, and emphasis.
        """
        
        user_message = f"Please synthesize the following meeting transcript:\n\n{transcript_text}"
        
        # Use Gemini for high-quality synthesis
        try:
            minutes = await self._get_gemini_chat([], user_message, system_prompt)
            return minutes
        except Exception as e:
            return f"# Meeting Minutes\n\n**Error generating minutes**: {str(e)}\n\n## Raw Transcript\n\n{transcript_text}" 
 
    async def query_secretary(self, topic: str, company_context: str, minutes: str, query: str) -> str:
        \"\"\"
        Answer follow-up questions about the meeting minutes.
        \"\"\"
        system_prompt = f\"\"\"
        You are an AI Executive Secretary who has access to the meeting minutes.
        
        Meeting Topic: {topic}
        Company Context: {company_context}
        
        Meeting Minutes:
        {minutes}
        
        Your task is to answer questions about the meeting based on the minutes above.
        Provide clear, concise, and helpful responses. Reference specific sections of the minutes when relevant.
        If the question cannot be answered from the minutes, politely explain what information is missing.
        \"\"\"
        
        # Use Gemini for intelligent Q&A
        try:
            response = await self._get_gemini_chat([], query, system_prompt)
            return response
        except Exception as e:
            return f\"I apologize, but I encountered an error: {str(e)}\"
