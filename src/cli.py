"""
Command-line interface for the murder mystery game.

Provides terminal-based UI for player interaction.
"""

import os
from typing import Optional
from .game_engine import GameEngine


class CLI:
    """
    Terminal-based user interface for the game.
    
    Handles display, input, and command processing.
    """
    
    def __init__(self, config_path: str, model: str):
        """
        Initialize CLI.
        
        Args:
            config_path: Path to game configuration
            model: LLM model name
        """
        self.engine = GameEngine(config_path, model)
        self.running = False
    
    def run(self) -> None:
        """Main game loop."""
        self.running = True
        
        # Show intro
        self.clear_screen()
        print(self.engine.get_intro())
        print("\n" + "=" * 60)
        input("\nPress Enter to begin investigation...")
        
        # Main loop
        while self.running:
            if self.engine.is_game_won():
                self.show_victory()
                break
            
            active_suspect = self.engine.get_active_suspect()
            
            if active_suspect:
                # Interrogation mode
                self.interrogation_loop(active_suspect)
            else:
                # Suspect selection mode
                self.suspect_selection()
    
    def suspect_selection(self) -> None:
        """Show suspect selection menu and handle choice."""
        self.clear_screen()
        
        suspects = self.engine.get_suspects()
        
        print("=" * 60)
        print("INTERROGATION ROOMS")
        print("=" * 60)
        print("\nAvailable suspects:\n")
        
        for suspect in suspects:
            print(f"  [{suspect['id']}] {suspect['name']}")
            print(f"      {suspect['role']}")
            print()
        
        revealed, total = self.engine.get_clue_stats()
        print(f"\nClues discovered: {revealed}/{total}")
        
        print("\nCommands:")
        print("  1-5  : Select suspect to interrogate")
        print("  c    : View all discovered clues")
        print("  quit : Exit game")
        
        choice = input("\n> ").strip().lower()
        
        if choice == 'quit':
            self.running = False
        elif choice == 'c':
            self.show_all_clues()
        elif choice in ['1', '2', '3', '4', '5']:
            # Map number to suspect ID (A, B, C, D, E)
            suspect_id = chr(ord('A') + int(choice) - 1)
            self.engine.start_interrogation(suspect_id)
        else:
            print("\nInvalid command.")
            input("Press Enter to continue...")
    
    def interrogation_loop(self, suspect_id: str) -> None:
        """
        Handle interrogation of a specific suspect.
        
        Args:
            suspect_id: ID of suspect being interrogated
        """
        self.clear_screen()
        
        # Show suspect info
        suspect_info = self.engine.get_suspect_info(suspect_id)
        print("=" * 60)
        print(f"INTERROGATING: {suspect_info['name']}")
        print(f"Role: {suspect_info['role']}")
        print("=" * 60)
        print()
        
        # Show conversation history
        history = self.engine.get_conversation_history(suspect_id)
        if history:
            print("--- Conversation History ---\n")
            for msg in history:
                if msg.role == 'user':
                    print(f"YOU: {msg.content}\n")
                else:
                    print(f"{suspect_info['name'].upper()}: {msg.content}\n")
            print("=" * 60)
        
        # Show commands
        print("\nType your question, or use commands:")
        print("  c    : View discovered clues")
        print("  1-5  : Switch to different suspect")
        print("  back : Return to suspect selection")
        print("  quit : Exit game")
        
        user_input = input("\n> ").strip()
        
        if not user_input:
            # Empty input, just continue
            return
        
        choice = user_input.lower()
        
        if choice == 'quit':
            self.running = False
        elif choice == 'back':
            self.engine.end_interrogation()
        elif choice == 'c':
            self.show_all_clues()
        elif choice in ['1', '2', '3', '4', '5']:
            # Switch suspect
            new_suspect_id = chr(ord('A') + int(choice) - 1)
            self.engine.end_interrogation()
            self.engine.start_interrogation(new_suspect_id)
        else:
            # Treat as a question
            print("\n" + "=" * 60)
            print("Thinking...\n")
            
            try:
                response = self.engine.ask_question(user_input)
                print(f"{suspect_info['name'].upper()}: {response}")
            except Exception as e:
                print(f"\nError: {str(e)}")
            
            print("\n" + "=" * 60)
            input("\nPress Enter to continue...")
    
    def show_all_clues(self) -> None:
        """Display all discovered clues."""
        self.clear_screen()
        
        clues = self.engine.get_revealed_clues()
        
        print("=" * 60)
        print("DISCOVERED CLUES")
        print("=" * 60)
        print()
        
        if not clues:
            print("No clues discovered yet. Keep interrogating suspects!\n")
        else:
            for i, clue in enumerate(clues, 1):
                suspect_info = self.engine.get_suspect_info(clue.suspect_id)
                print(f"[{i}] From {suspect_info['name']}:")
                print(f"    {clue.clue_text}")
                print()
        
        revealed, total = self.engine.get_clue_stats()
        print(f"\nTotal: {revealed}/{total} clues discovered")
        print("=" * 60)
        
        input("\nPress Enter to continue...")
    
    def show_victory(self) -> None:
        """Display victory screen."""
        self.clear_screen()
        
        print("\n" + "=" * 60)
        print("🎉 CASE SOLVED! 🎉")
        print("=" * 60)
        print()
        print("You've uncovered the truth and gotten a confession!")
        print("The murderer has been brought to justice.")
        print()
        
        revealed, total = self.engine.get_clue_stats()
        print(f"Final statistics:")
        print(f"  Clues discovered: {revealed}/{total}")
        print()
        print("=" * 60)
        print("\nThank you for playing Death at the Frontier!")
        print()
    
    def clear_screen(self) -> None:
        """Clear the terminal screen."""
        os.system('cls' if os.name == 'nt' else 'clear')

