"""
Main entry point for Death at the Frontier murder mystery game.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from .cli import CLI


def main():
    """Run the game."""
    # Load environment variables
    load_dotenv()
    
    # Get model from environment
    model = os.getenv('LLM_MODEL', 'gpt-4o')
    
    # Check for API key
    if not os.getenv('OPENAI_API_KEY'):
        print("Error: OPENAI_API_KEY not found in environment.")
        print("Please create a .env file with your API key.")
        print("\nExample .env file:")
        print("OPENAI_API_KEY=your_key_here")
        print("LLM_MODEL=gpt-4o")
        sys.exit(1)
    
    # Determine config path
    config_path = Path(__file__).parent.parent / "scenario" / "game_config.yaml"
    
    if not config_path.exists():
        print(f"Error: Could not find game configuration at {config_path}")
        sys.exit(1)
    
    # Start game
    try:
        cli = CLI(str(config_path), model)
        cli.run()
    except KeyboardInterrupt:
        print("\n\nGame interrupted. Goodbye!")
    except Exception as e:
        print(f"\n\nError: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

