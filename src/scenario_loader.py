"""
Load and prepare game scenario from configuration files.

Handles loading YAML configs, rendering Jinja2 templates, and creating
LLM function definitions for clue revelation.
"""

import yaml
from pathlib import Path
from jinja2 import Template
from typing import Dict, List, Any


def load_scenario(config_path: str) -> tuple[Dict, Dict[str, Dict], Dict[str, str], Dict[str, List[Dict]]]:
    """
    Load complete game scenario from configuration.
    
    Args:
        config_path: Path to game_config.yaml
    
    Returns:
        Tuple of (config, suspects_data, system_prompts, tools_by_suspect)
        - config: Full game configuration
        - suspects_data: Dict mapping suspect_id -> suspect data from YAML
        - system_prompts: Dict mapping suspect_id -> rendered system prompt
        - tools_by_suspect: Dict mapping suspect_id -> list of function definitions
    """
    config_path = Path(config_path)
    
    # Load main config
    with open(config_path) as f:
        config = yaml.safe_load(f)
    
    # Load shared resources
    resources = config['prompt_resources']
    base_dir = config_path.parent
    
    with open(base_dir / resources['general_information'], encoding='utf-8') as f:
        general_info = f.read()
    
    with open(base_dir / resources['template'], encoding='utf-8') as f:
        template_text = f.read()
    
    # Load each suspect
    suspects_data = {}
    system_prompts = {}
    tools_by_suspect = {}
    
    for suspect in config['suspects']:
        suspect_id = suspect['id']
        
        # Load suspect YAML
        with open(base_dir / suspect['file'], encoding='utf-8') as f:
            suspect_data = yaml.safe_load(f)
        
        suspects_data[suspect_id] = suspect_data
        
        # Render system prompt
        system_prompts[suspect_id] = render_suspect_prompt(
            template_text,
            general_info,
            suspect_data
        )
        
        # Create function definitions for tools
        tools_by_suspect[suspect_id] = create_clue_functions(
            suspect_id,
            suspect_data.get('clues', [])
        )
    
    return config, suspects_data, system_prompts, tools_by_suspect


def render_suspect_prompt(template_text: str, general_info: str, suspect_data: Dict) -> str:
    """
    Render a suspect's system prompt using Jinja2.
    
    Args:
        template_text: Template content from suspect_prompt_template.md
        general_info: Content from general_information.md
        suspect_data: Suspect's data from YAML
    
    Returns:
        Fully rendered system prompt
    """
    template = Template(template_text)
    
    # Format clue instructions
    clue_instructions = format_clue_instructions(suspect_data.get('clues', []))
    
    return template.render(
        CHARACTER_NAME=suspect_data['character_name'],
        GENERAL_INFORMATION=general_info,
        CHARACTER_INFORMATION=suspect_data['character_information'],
        CLUE_INSTRUCTIONS=clue_instructions
    )


def format_clue_instructions(clues: List[Dict]) -> str:
    """
    Format clue information for injection into prompt.
    
    Args:
        clues: List of clue definitions from suspect YAML
    
    Returns:
        Formatted text describing all clues and when to use them
    """
    if not clues:
        return "You have no specific clues to reveal."
    
    lines = []
    lines.append("You have access to the following tools to reveal clues:\n")
    
    for clue in clues:
        lines.append(f"### Tool: `{clue['tool_name']}`")
        lines.append(f"**Clue ID**: {clue['id']}")
        lines.append(f"**Difficulty**: {clue['difficulty']}")
        lines.append(f"**Description**: {clue['description']}")
        lines.append(f"\n**When to reveal**:\n{clue['trigger_guidance']}")
        lines.append(f"\n**What will be added to detective's notes**:\n{clue['clue_text']}\n")
        lines.append("---\n")
    
    return "\n".join(lines)


def create_clue_functions(suspect_id: str, clues: List[Dict]) -> List[Dict]:
    """
    Create OpenAI-style function definitions for clue revelation.
    
    Args:
        suspect_id: ID of suspect (for context)
        clues: List of clue definitions from suspect YAML
    
    Returns:
        List of function definition dicts for OpenAI API
    """
    functions = []
    
    for clue in clues:
        function_def = {
            "type": "function",
            "function": {
                "name": clue['tool_name'],
                "description": f"{clue['description']} (Difficulty: {clue['difficulty']})",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        }
        functions.append(function_def)
    
    return functions

