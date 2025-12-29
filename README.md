# Death at the Frontier - Project Overview

Death at the Frontier is a text-based murder mystery video game with a victim and five suspects, all employees of "Frontier AI" — a fictional frontier lab developing a cutting-edge LLM. The player must investigate the murder of a brilliant researcher and identify the killer among the five suspects, each with their own potential motives.

The five suspects are all simulated by LLMs with different system prompts.

The gameplay consists of interrogating the five suspects. The player can switch from a conversation with one suspect to the next at any point. The game ends when the real murderer confesses.

Throughout the investigation, whenever a suspect reveals one of the predefined clues, that clue is added to the investigator's notes — visible to the player. This reduces the mental load of remembering all the important details and keeps the plot on the predefined set of tracks.

## Interface

The game is browser-based. At the beginning of the game, there is a welcome screen providing the exposition. The main game screen has three vertical panels, side by side. From left to right: a panel with portraits of the five suspects, the chat window, and a panel where the detective's notes are displayed.

## Gameplay

To start a conversation with any of the suspects, the player clicks on their portrait. The player can then chat in the chat window. Every time the player enters a message, the suspect (simulated by an LLM) responds. The player can switch between suspects at any time and continue the conversation where it left off.

The LLM has a number of tools available, corresponding to predefined clues. When the suspect character reveals something in dialogue that matches one of the clues, the LLM is instructed to use the tool. This triggers the corresponding detective's note to be displayed in the third pane. For example, the detective might ask "Did you notice anything unusual at the party?" and the suspect might say "I noticed that John was acting nervous" — triggering the tool named `reveal_john_acting_nervous_at_party`, which causes the note "Alice says John was acting nervous at the party" to be displayed.

One of these clue tools is marked as the final one. When it is triggered, the murderer has confessed and the game ends. A congratulations message is displayed.

## Project Structure

The `script_development/` directory is for iterating on the plot of the game — the screenplay. It contains the plot outline, instructions for the LLM iterating on plot details, all iterations of the plot as markdown files, and descriptions of the characters. None of this is directly used in the game; it's scaffolding for building the game.

The `scenario/` directory has the final version of the plot and the prompts for the LLMs playing the characters, all the clues, etc. — but no code.

`src/` has all the actual code of the game but is completely agnostic regarding the plot.

You could change the contents of the `scenario/` directory and end up with a completely different murder mystery.

`static/` and `templates/` have the usual HTML files, including images for portraits of suspects.

`app.py` is the entry point — it starts the game locally.
