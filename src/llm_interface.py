"""
LLM interface using litellm for model interactions.

Handles chat completions with function calling support.
"""

import litellm
from typing import List, Dict, Tuple, Optional


class LLMInterface:
    """
    Wrapper for LLM interactions via litellm.
    
    Supports function calling for clue revelation.
    """
    
    def __init__(self, model: str):
        """
        Initialize LLM interface.
        
        Args:
            model: Model name (e.g., 'gpt-4o', 'claude-3-5-sonnet')
        """
        self.model = model
    
    def chat(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict]] = None
    ) -> Tuple[str, List[Dict]]:
        """
        Send messages to LLM and get response.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            tools: Optional list of function definitions for tool calling
        
        Returns:
            Tuple of (assistant_message_content, tool_calls)
            - assistant_message_content: The text response from the assistant
            - tool_calls: List of dicts with 'name' and 'id' for each tool call
        """
        try:
            kwargs = {
                "model": self.model,
                "messages": messages
            }
            
            if tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = "auto"
                # Debug: print number of tools
                print(f"[DEBUG] Sending {len(tools)} tools to API")
            
            response = litellm.completion(**kwargs)
            
            message = response.choices[0].message
            content = message.content or ""
            
            # Extract tool calls if present
            tool_calls = []
            if hasattr(message, 'tool_calls') and message.tool_calls:
                print(f"[DEBUG] Model made {len(message.tool_calls)} tool call(s)")
                for tool_call in message.tool_calls:
                    print(f"[DEBUG] Tool call: {tool_call.function.name}")
                    tool_calls.append({
                        'id': tool_call.id,
                        'name': tool_call.function.name
                    })
            else:
                print("[DEBUG] No tool calls detected in response")
            
            return content, tool_calls
            
        except Exception as e:
            raise RuntimeError(f"LLM API error: {str(e)}")

