from flask import Flask, render_template, jsonify, request, session
import os
import json

app = Flask(__name__, 
            static_folder="../static",
            template_folder="../templates")
app.secret_key = 'chess_education_app_secret_key'

# Lesson data structure
LESSONS = [
    {
        "id": 1,
        "title": "Chess Pieces & Board Setup",
        "description": "Learn about each chess piece, how it moves, and how to set up the board correctly.",
        "content": "In this lesson, you will learn about all six chess pieces: Pawn, Knight, Bishop, Rook, Queen, and King. You'll also learn how to properly set up a chess board.",
        "objectives": ["Identify all chess pieces", "Understand how each piece moves", "Set up a chess board correctly"],
        "interactive_exercises": ["piece_movement", "board_setup"]
    },
    {
        "id": 2,
        "title": "Basic Opening Principles",
        "description": "Learn fundamental principles to start your chess games effectively.",
        "content": "Opening principles include controlling the center, developing your pieces, and castling for king safety.",
        "objectives": ["Control the center", "Develop your pieces", "Castle for king safety"],
        "interactive_exercises": ["center_control", "piece_development"]
    },
    {
        "id": 3,
        "title": "Simple Tactics: Forks & Pins",
        "description": "Learn about forks, pins, and how they can give you an advantage.",
        "content": "Tactics are short sequences of moves that result in a tangible gain. Forks attack two pieces simultaneously, while pins restrict piece movement.",
        "objectives": ["Identify and execute forks", "Recognize pin opportunities", "Defend against common tactics"],
        "interactive_exercises": ["fork_practice", "pin_practice"]
    }
]

# User progress tracking
USER_PROGRESS = {
    "completed_lessons": [],
    "achievements": [],
    "current_streak": 0
}

@app.route('/')
def index():
    """Render the main page of the application"""
    return render_template('index.html')

@app.route('/lessons')
def get_lessons():
    """Return all available lessons"""
    return jsonify(LESSONS)

@app.route('/lesson/<int:lesson_id>')
def get_lesson(lesson_id):
    """Return a specific lesson by ID"""
    lesson = next((l for l in LESSONS if l["id"] == lesson_id), None)
    if lesson:
        return jsonify(lesson)
    return jsonify({"error": "Lesson not found"}), 404

@app.route('/progress', methods=['GET'])
def get_progress():
    """Get the user's current progress"""
    return jsonify(USER_PROGRESS)

@app.route('/progress/complete-lesson', methods=['POST'])
def complete_lesson():
    """Mark a lesson as completed"""
    data = request.json
    lesson_id = data.get('lesson_id')
    
    if lesson_id not in USER_PROGRESS["completed_lessons"]:
        USER_PROGRESS["completed_lessons"].append(lesson_id)
        USER_PROGRESS["current_streak"] += 1
        
        # Award achievement for first lesson
        if len(USER_PROGRESS["completed_lessons"]) == 1:
            USER_PROGRESS["achievements"].append({
                "id": "first_lesson",
                "title": "First Step",
                "description": "Completed your first chess lesson!"
            })
            
    return jsonify(USER_PROGRESS)

@app.route('/board')
def chess_board():
    """Render the interactive chess board page"""
    return render_template('board.html')

@app.route('/exercises/<exercise_name>')
def exercise(exercise_name):
    """Render specific interactive exercises"""
    return render_template(f'exercises/{exercise_name}.html')

if __name__ == '__main__':
    app.run(debug=True, port=5001) 