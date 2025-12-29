"""
Flask web application for Death at the Frontier
"""
from flask import Flask, render_template, request, jsonify, session
from src.game_engine import GameEngine
import os
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)

# Store game instances per session
games = {}

# Default model
DEFAULT_MODEL = os.getenv('LLM_MODEL', 'gpt-4')

def get_game():
    """Get or create game instance for this session"""
    session_id = session.get('session_id')
    if not session_id:
        session_id = secrets.token_hex(16)
        session['session_id'] = session_id
    
    if session_id not in games:
        # Create new game engine
        games[session_id] = GameEngine(
            config_path='scenario/game_config.yaml',
            model=DEFAULT_MODEL
        )
    
    return games[session_id]


@app.route('/')
def index():
    """Render the main game page"""
    return render_template('index.html')


@app.route('/api/start', methods=['POST'])
def start_game():
    """Start a new game"""
    session_id = session.get('session_id')
    if session_id and session_id in games:
        del games[session_id]
    
    game = get_game()
    
    # Get game intro
    intro = game.get_intro()
    
    # Get suspects list
    suspects = []
    for suspect in game.get_suspects():
        suspects.append({
            'id': suspect['id'],
            'name': suspect['name'],
            'image': f'/static/images/portraits/{suspect["id"]}.png'
        })
    
    return jsonify({
        'success': True,
        'intro': intro,
        'suspects': suspects
    })


@app.route('/api/chat', methods=['POST'])
def chat():
    """Send a message to a suspect"""
    data = request.json
    suspect_id = data.get('suspect_id')
    message = data.get('message')
    
    if not suspect_id or not message:
        return jsonify({'error': 'Missing suspect_id or message'}), 400
    
    game = get_game()
    
    # Start interrogation if not already active, or switch suspects
    if game.get_active_suspect() != suspect_id:
        if game.get_active_suspect():
            game.end_interrogation()
        game.start_interrogation(suspect_id)
    
    # Ask question
    response = game.ask_question(message)
    
    # Get updated clues - extract just the clue_text
    clues = [clue.clue_text for clue in game.get_revealed_clues()]
    
    # Check if game is over
    game_over = game.is_game_won()
    
    return jsonify({
        'success': True,
        'response': response,
        'clues': clues,
        'game_over': game_over
    })


@app.route('/api/clues', methods=['GET'])
def get_clues():
    """Get all revealed clues"""
    game = get_game()
    clues = [clue.clue_text for clue in game.get_revealed_clues()]
    
    return jsonify({
        'success': True,
        'clues': clues
    })


@app.route('/api/suspects', methods=['GET'])
def get_suspects():
    """Get list of all suspects"""
    game = get_game()
    
    suspects = []
    for suspect in game.get_suspects():
        suspects.append({
            'id': suspect['id'],
            'name': suspect['name'],
            'image': f'/static/images/portraits/{suspect["id"]}.png'
        })
    
    return jsonify({
        'success': True,
        'suspects': suspects
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)

