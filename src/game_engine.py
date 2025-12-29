"""
Core game engine for the murder mystery.

Coordinates GameState, LLM interactions, and game logic.
"""

from pathlib import Path
from typing import Optional, List
from .game_state import GameState
from .llm_interface import LLMInterface
from .scenario_loader import load_scenario


class GameEngine:
    """
    Main game engine that manages the murder mystery game.
    
    Handles:
    - Loading scenario configuration
    - Managing game state
    - Coordinating LLM interactions
    - Processing clue revelations
    - Checking win conditions
    """
    
    def __init__(self, config_path: str, model: str):
        """
        Initialize game engine.
        
        Args:
            config_path: Path to game_config.yaml
            model: LLM model name
        """
        self.config_path = config_path
        self.llm = LLMInterface(model)
        
        # Load scenario
        self.config, self.suspects_data, self.system_prompts, self.tools = load_scenario(config_path)
        
        # Initialize game state
        self.state = GameState()
        self.state.win_condition = self.config['win_condition']
        
        # Add suspects to state
        for suspect in self.config['suspects']:
            suspect_id = suspect['id']
            self.state.add_suspect(suspect_id, self.suspects_data[suspect_id])
        
        # Load game intro
        intro_path = Path(config_path).parent / self.config['prompt_resources']['game_intro']
        with open(intro_path, encoding='utf-8') as f:
            self.game_intro = f.read()
    
    def get_intro(self) -> str:
        """Get the game introduction text."""
        return self.game_intro
    
    def get_suspects(self) -> List[dict]:
        """Get list of all suspects with their metadata."""
        return self.config['suspects']
    
    def start_interrogation(self, suspect_id: str) -> None:
        """
        Begin interrogating a suspect.
        
        Args:
            suspect_id: ID of suspect to interrogate
        """
        self.state.start_interrogation(suspect_id)
    
    def end_interrogation(self) -> None:
        """End current interrogation and return to menu."""
        self.state.end_interrogation()
    
    def get_active_suspect(self) -> Optional[str]:
        """Get ID of currently active suspect, or None."""
        return self.state.active_suspect_id
    
    def get_suspect_info(self, suspect_id: str) -> dict:
        """Get metadata for a specific suspect."""
        for suspect in self.config['suspects']:
            if suspect['id'] == suspect_id:
                return suspect
        raise ValueError(f"Unknown suspect: {suspect_id}")
    
    def get_conversation_history(self, suspect_id: str) -> List:
        """Get conversation history with a suspect."""
        return self.state.get_conversation(suspect_id)
    
    def ask_question(self, question: str) -> str:
        """
        Ask the current suspect a question.
        
        Args:
            question: User's question
        
        Returns:
            Suspect's response
        
        Raises:
            RuntimeError: If no suspect is currently active
        """
        if not self.state.active_suspect_id:
            raise RuntimeError("No active suspect")
        
        suspect_id = self.state.active_suspect_id
        
        # Add user message to history
        self.state.add_message(suspect_id, 'user', question)
        
        # Build message list for LLM
        messages = self._build_messages(suspect_id)
        
        # Get tools for this suspect
        tools = self.tools[suspect_id]
        
        # Call LLM
        response, tool_calls = self.llm.chat(messages, tools)
        
        # Add assistant message to history
        self.state.add_message(suspect_id, 'assistant', response)
        
        # Process any tool calls (clue revelations)
        newly_revealed = []
        for tool_call in tool_calls:
            tool_name = tool_call['name']
            # Extract clue ID from tool name
            clue_id = self._extract_clue_id(suspect_id, tool_name)
            if clue_id:
                clue = self.state.reveal_clue(suspect_id, clue_id)
                if clue:
                    newly_revealed.append(clue)
        
        # Build response with clue notifications
        full_response = response
        if newly_revealed:
            full_response += "\n\n" + "=" * 60
            full_response += "\n🔍 NEW CLUE(S) DISCOVERED! 🔍\n"
            full_response += "=" * 60 + "\n"
            for clue in newly_revealed:
                full_response += f"\n{clue.clue_text}\n"
        
        return full_response
    
    def _build_messages(self, suspect_id: str) -> List[dict]:
        """
        Build message list for LLM API call.
        
        Args:
            suspect_id: ID of suspect
        
        Returns:
            List of message dicts
        """
        messages = [
            {"role": "system", "content": self.system_prompts[suspect_id]}
        ]
        
        # Add conversation history
        for msg in self.state.get_conversation(suspect_id):
            messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        return messages
    
    def _extract_clue_id(self, suspect_id: str, tool_name: str) -> Optional[str]:
        """
        Find clue ID from tool name.
        
        Args:
            suspect_id: ID of suspect
            tool_name: Name of tool that was called
        
        Returns:
            Clue ID or None if not found
        """
        suspect_clues = self.suspects_data[suspect_id].get('clues', [])
        for clue in suspect_clues:
            if clue['tool_name'] == tool_name:
                return clue['id']
        return None
    
    def get_revealed_clues(self) -> List:
        """Get all revealed clues."""
        return self.state.revealed_clues
    
    def is_game_won(self) -> bool:
        """Check if game has been won."""
        return self.state.game_won
    
    def get_clue_stats(self) -> tuple[int, int]:
        """
        Get clue discovery statistics.
        
        Returns:
            Tuple of (revealed_count, total_count)
        """
        revealed = self.state.get_revealed_clue_count()
        total = self.state.get_total_clue_count()
        return revealed, total

