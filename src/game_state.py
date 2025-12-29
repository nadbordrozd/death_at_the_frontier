"""
Game state management for Death at the Frontier.

Tracks revealed clues, conversation history, and current interrogation state.
"""

from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


@dataclass
class Message:
    """A single message in a conversation."""
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class Clue:
    """A discovered clue."""
    id: str
    suspect_id: str
    clue_text: str
    timestamp: datetime = field(default_factory=datetime.now)


class GameState:
    """
    Manages the state of the murder mystery game.
    
    Tracks:
    - All suspects and their data
    - Which clues have been revealed
    - Conversation history with each suspect
    - Which suspect (if any) is currently being interrogated
    - Whether the game has been won
    """
    
    def __init__(self):
        """Initialize empty game state."""
        # Suspect data (loaded from YAMLs)
        self.suspects: dict[str, dict] = {}
        
        # All available clues (suspect_id -> list of clue definitions)
        self.available_clues: dict[str, list[dict]] = {}
        
        # Revealed clues (order matters for display)
        self.revealed_clues: list[Clue] = []
        
        # Conversation history (suspect_id -> list of messages)
        self.conversations: dict[str, list[Message]] = {}
        
        # Currently active suspect (None if at main menu)
        self.active_suspect_id: Optional[str] = None
        
        # Game won flag
        self.game_won: bool = False
        
        # Win condition (loaded from config)
        self.win_condition: Optional[dict] = None
    
    def add_suspect(self, suspect_id: str, suspect_data: dict) -> None:
        """
        Add a suspect to the game.
        
        Args:
            suspect_id: Suspect identifier (e.g., 'A', 'B', 'C')
            suspect_data: Full suspect data from YAML
        """
        self.suspects[suspect_id] = suspect_data
        self.available_clues[suspect_id] = suspect_data.get('clues', [])
        self.conversations[suspect_id] = []
    
    def start_interrogation(self, suspect_id: str) -> None:
        """
        Begin interrogating a specific suspect.
        
        Args:
            suspect_id: ID of suspect to interrogate
        
        Raises:
            ValueError: If suspect_id is not valid
        """
        if suspect_id not in self.suspects:
            raise ValueError(f"Unknown suspect: {suspect_id}")
        self.active_suspect_id = suspect_id
    
    def end_interrogation(self) -> None:
        """Return to main menu (no active suspect)."""
        self.active_suspect_id = None
    
    def add_message(self, suspect_id: str, role: str, content: str) -> None:
        """
        Add a message to a conversation.
        
        Args:
            suspect_id: ID of suspect in conversation
            role: 'user' or 'assistant'
            content: Message content
        """
        if suspect_id not in self.conversations:
            raise ValueError(f"Unknown suspect: {suspect_id}")
        
        message = Message(role=role, content=content)
        self.conversations[suspect_id].append(message)
    
    def reveal_clue(self, suspect_id: str, tool_id: str) -> Optional[Clue]:
        """
        Reveal a clue and add it to discovered clues.
        
        Args:
            suspect_id: ID of suspect revealing the clue
            tool_id: Tool/clue ID that was triggered
        
        Returns:
            Clue object if newly revealed, None if already revealed
        """
        # Check if already revealed
        if any(c.id == tool_id for c in self.revealed_clues):
            return None
        
        # Find the clue definition
        suspect_clues = self.available_clues.get(suspect_id, [])
        clue_def = next((c for c in suspect_clues if c['id'] == tool_id), None)
        
        if not clue_def:
            # Tool ID not found - might be invalid
            return None
        
        # Create and add clue
        clue = Clue(
            id=tool_id,
            suspect_id=suspect_id,
            clue_text=clue_def['clue_text']
        )
        self.revealed_clues.append(clue)
        
        # Check win condition
        if (self.win_condition and 
            suspect_id == self.win_condition.get('suspect_id') and
            tool_id == self.win_condition.get('tool_id')):
            self.game_won = True
        
        return clue
    
    def get_conversation(self, suspect_id: str) -> list[Message]:
        """
        Get conversation history with a suspect.
        
        Args:
            suspect_id: ID of suspect
        
        Returns:
            List of messages in chronological order
        """
        return self.conversations.get(suspect_id, [])
    
    def is_clue_revealed(self, clue_id: str) -> bool:
        """Check if a clue has been revealed."""
        return any(c.id == clue_id for c in self.revealed_clues)
    
    def get_revealed_clue_count(self, suspect_id: Optional[str] = None) -> int:
        """
        Get count of revealed clues.
        
        Args:
            suspect_id: If provided, count only clues from this suspect
        
        Returns:
            Number of revealed clues
        """
        if suspect_id is None:
            return len(self.revealed_clues)
        return sum(1 for c in self.revealed_clues if c.suspect_id == suspect_id)
    
    def get_total_clue_count(self, suspect_id: Optional[str] = None) -> int:
        """
        Get total number of available clues.
        
        Args:
            suspect_id: If provided, count only clues from this suspect
        
        Returns:
            Total number of clues
        """
        if suspect_id is None:
            return sum(len(clues) for clues in self.available_clues.values())
        return len(self.available_clues.get(suspect_id, []))

