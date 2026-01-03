# Death at the Frontier - Scenario Files

This folder contains all content and configuration for the murder mystery game scenario. The system uses a modular approach where shared context, character-specific information, and clue mechanics are combined to generate complete system prompts for each suspect.

## File Structure

### Game Configuration

- **`game_config.yaml`** - **Main configuration file** that defines game structure, suspect metadata, win conditions, and game settings. This is the entry point for the Python game engine.

### Core Template Files

- **`suspect_prompt_template.md`** - The master template structure for all suspect prompts. Contains placeholders for character-specific content and general instructions for how suspects should behave during interrogation.

- **`general_information.md`** - Shared context injected into all suspect prompts. Includes the interrogation setting, crime details, company background, victim information, and public knowledge about all suspects.

### Character Data Files (YAML)

Each suspect has a YAML file containing their complete character information and clue structure:

- **`suspect_A.yaml`** - Nadia Volkov, 32 (Senior Research Lead - Alignment & Safety, leaked to journalist)
- **`suspect_B.yaml`** - Marcus Liu, 29 (Infrastructure Engineer, witnessed Chris's lies)
- **`suspect_C.yaml`** - Chris Morrison, 38 (VP of Product, deliberately manipulated Vikram's jealousy)
- **`suspect_D.yaml`** - Dr. Emily Zhang, 28 (Research Scientist, sabotaged Rachel's code, lied to Vikram)
- **`suspect_E.yaml`** - Vikram Patel, 40 (VP of Engineering, the actual murderer)

Each YAML file contains:
- `character_name`: The suspect's full name
- `character_information`: Complete background, personality, AI views, relationships, secrets, and night-of-crime details
- `clues`: Array of clues (varying number per suspect) with:
  - `id`: Unique identifier
  - `difficulty`: easy, medium, hard, or very_hard
  - `tool_name`: Function name for LLM to call when revealing
  - `description`: Brief description of the clue
  - `trigger_guidance`: Instructions for when to reveal
  - `clue_text`: Short summary for detective's notes
  - `long_clue_text`: Detailed attributed description

### Game Introduction

- **`game_intro.md`** - The introductory message shown to the player when starting the game. Sets the scene, explains the crime, and introduces the five suspects.

## How It Works

### Game Initialization

The Python game engine starts by loading the game configuration:

```python
import yaml

# Load game configuration
with open('scenario/game_config.yaml') as f:
    config = yaml.safe_load(f)

# Access game metadata
title = config['game_metadata']['title']
suspects = config['suspects']
win_condition = config['win_condition']

# Load suspects dynamically
for suspect in suspects:
    with open(suspect['file']) as f:
        suspect_data = yaml.safe_load(f)
    # Generate prompts and register tools...
```

### Generating Final Prompts

The system uses Python with Jinja2 templating:

```python
from jinja2 import Template
import yaml

# Load shared context
with open(config['prompt_resources']['general_information']) as f:
    general_info = f.read()

# Load suspect data
with open('scenario/suspect_A.yaml') as f:
    suspect_data = yaml.safe_load(f)

# Load template
with open(config['prompt_resources']['template']) as f:
    template = Template(f.read())

# Generate final prompt
final_prompt = template.render(
    CHARACTER_NAME=suspect_data['character_name'],
    GENERAL_INFORMATION=general_info,
    CHARACTER_INFORMATION=suspect_data['character_information'],
    CLUE_INSTRUCTIONS=format_clues(suspect_data['clues'])  # Helper function
)
```

### Detecting Game Win

The game engine checks for the win condition on every tool call:

```python
# When a suspect reveals a clue via tool call
def on_tool_call(suspect_id, tool_id, clue_text):
    # Add clue to player's notes
    add_clue_to_notes(clue_text)
    
    # Check win condition
    if (suspect_id == config['win_condition']['suspect_id'] and 
        tool_id == config['win_condition']['tool_id']):
        end_game(victory=True)
        display_confession_message()
```

### Template Placeholders

The template uses the following placeholders:
- `{{CHARACTER_NAME}}` - Suspect's full name
- `{{GENERAL_INFORMATION}}` - Shared context (from general_information.md)
- `{{CHARACTER_INFORMATION}}` - Character-specific details (from YAML)
- `{{CLUE_INSTRUCTIONS}}` - Formatted clue information with tools (from YAML)

### Clue System

Each suspect has multiple clues with difficulty ratings:
- **EASY** - Revealed readily when topic comes up naturally
- **MEDIUM** - Requires some pressing, specific questions, or related evidence
- **HARD** - Only revealed under sustained pressure, confronted with evidence, or when cornered
- **VERY_HARD** - Deepest secrets; require multiple pieces of evidence, sustained pressure, or specific prerequisites

Clues are revealed through LLM tool calls. When revealing a clue, the LLM must:
1. **Speak the information naturally as dialogue** (what the player sees)
2. **Call the corresponding function** (invisible logging for game state)

This dual approach ensures natural dialogue while tracking game progress.

## Modular Design Benefits

1. **Generic Game Engine** - Python code never references specific plot details, only config structure
2. **Shared Context** - Update crime details or setting once in `general_information.md`
3. **Reusable Template** - Consistent interrogation behavior across all suspects
4. **Flexible Characters** - Easy to modify or swap out individual suspects via YAML
5. **Clear Separation** - Plot/character details separate from behavioral instructions and game mechanics
6. **Version Control** - Track changes to individual suspects independently
7. **Plot Swapping** - Create entirely new murder mystery by creating new YAMLs and updating `game_config.yaml`

## Architecture Layers

The system has clean separation between three layers:

1. **Game Engine (Python)** - Generic code that reads config, manages game state, handles LLM interactions
   - Never hardcodes suspect names, tool IDs, or plot details
   - Driven entirely by `game_config.yaml`

2. **Game Mechanics (Config)** - `game_config.yaml` defines structure
   - Which suspects exist and where their data lives
   - What constitutes winning the game
   - Game settings and features

3. **Content (Markdown/YAML)** - Plot, characters, clues
   - Template for suspect behavior
   - Shared context about the crime
   - Individual suspect details and secrets

## File Dependencies

```
game_config.yaml (entry point - defines game structure)
    ↓
    ├─ game_intro.md (standalone - shown to player)
    │
    ├─ For each suspect:
    │   Final Suspect Prompt = 
    │       suspect_prompt_template.md
    │       + general_information.md
    │       + suspect_[A-E].yaml
    │
    └─ Win Condition:
        Check if tool_id == config['win_condition']['tool_id']
```

Each final prompt is self-contained with all necessary context for the LLM to roleplay that suspect during interrogation.

## Creating a New Mystery

To create an entirely different murder mystery game:

1. Write new suspect YAML files with different characters, clues, and plot
2. Create new `general_information.md` with your crime details
3. Update `game_config.yaml` to point to the new files and set the new win condition
4. Optionally customize `suspect_prompt_template.md` for different game mechanics

The Python game engine requires no code changes - it's completely generic and driven by configuration.
