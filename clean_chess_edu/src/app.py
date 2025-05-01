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
        "interactive_exercises": ["piece_movement", "board_setup"],
        "achievement": {
            "id": "chess_pieces",
            "title": "Chess Pieces Master",
            "description": "Completed the lesson on Chess Pieces & Board Setup"
        }
    },
    {
        "id": 2,
        "title": "Basic Opening Principles",
        "description": "Learn fundamental principles to start your chess games effectively.",
        "content": "Opening principles include controlling the center, developing your pieces, and castling for king safety.",
        "objectives": ["Control the center", "Develop your pieces", "Castle for king safety"],
        "interactive_exercises": ["center_control", "piece_development"],
        "achievement": {
            "id": "opening_principles", 
            "title": "Opening Expert",
            "description": "Mastered the Basic Opening Principles"
        }
    },
    {
        "id": 3,
        "title": "Simple Tactics: Forks & Pins",
        "description": "Learn about forks, pins, and how they can give you an advantage.",
        "content": "Tactics are short sequences of moves that result in a tangible gain. Forks attack two pieces simultaneously, while pins restrict piece movement.",
        "objectives": ["Identify and execute forks", "Recognize pin opportunities", "Defend against common tactics"],
        "interactive_exercises": ["fork_practice", "pin_practice"],
        "achievement": {
            "id": "tactics_master",
            "title": "Tactics Master",
            "description": "Learned about Forks & Pins tactics"
        }
    }
]

# Enhanced user progress tracking structure
USER_PROGRESS = {
    # Change from simple array to object structure to match frontend expectations
    "completedLessons": [],  # Will contain objects with lessonId, completed status
    "completed_lessons": [], # Keep the old format for backward compatibility
    "achievements": [],
    "completedObjectives": [], # Track completed objectives as "lessonId_objectiveIndex"
    "current_streak": 0
}

# Map of exercise IDs to their parent lesson IDs
EXERCISE_TO_LESSON = {
    "piece_movement": 1,
    "board_setup": 1,
    "center_control": 2,
    "piece_development": 2,
    "fork_practice": 3,
    "pin_practice": 3
}

# Map of exercise IDs to specific lesson objectives
EXERCISE_TO_OBJECTIVE = {
    "center_control": {"lesson_id": 2, "objective_index": 0},
    "piece_development": {"lesson_id": 2, "objective_index": 1},
    # For the third objective (Castle for king safety), we'll add a specific exercise later
}

# Additional objective achievements to award
OBJECTIVE_ACHIEVEMENTS = {
    "2_0": {  # Center control
        "id": "center_control",
        "title": "Center Commander",
        "description": "Learned how to control the center of the board"
    },
    "2_1": {  # Piece development
        "id": "piece_development",
        "title": "Development Director",
        "description": "Mastered the skill of developing your pieces efficiently"
    },
    "2_2": {  # Castling
        "id": "king_safety",
        "title": "Castle Keeper",
        "description": "Learned the importance of castling for king safety"
    }
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
    
    # Update both progress formats for backward compatibility
    if lesson_id not in USER_PROGRESS["completed_lessons"]:
        USER_PROGRESS["completed_lessons"].append(lesson_id)
        
    # Add to the new format if not already present
    lesson_completion = next((completion for completion in USER_PROGRESS["completedLessons"] 
                              if completion.get("lessonId") == lesson_id), None)
    
    if not lesson_completion:
        USER_PROGRESS["completedLessons"].append({
            "lessonId": lesson_id,
            "completed": True,
            "timestamp": data.get('timestamp', "")
        })
    else:
        lesson_completion["completed"] = True
    
    USER_PROGRESS["current_streak"] += 1
    
    # Add achievement for the completed lesson
    lesson = next((l for l in LESSONS if l["id"] == lesson_id), None)
    if lesson and "achievement" in lesson:
        # Check if achievement already exists
        achievement_exists = any(a.get("id") == lesson["achievement"]["id"] for a in USER_PROGRESS["achievements"])
        
        if not achievement_exists:
            USER_PROGRESS["achievements"].append({
                "id": lesson["achievement"]["id"],
                "title": lesson["achievement"]["title"],
                "description": lesson["achievement"]["description"]
            })
    
    # For lesson 2, mark all objectives as completed since the entire lesson is done
    if lesson_id == 2:
        for obj_index, objective in enumerate(lesson.get("objectives", [])):
            obj_key = f"{lesson_id}_{obj_index}"
            if obj_key not in USER_PROGRESS["completedObjectives"]:
                USER_PROGRESS["completedObjectives"].append(obj_key)
                
                # Add achievement for each objective
                if obj_key in OBJECTIVE_ACHIEVEMENTS:
                    achievement = OBJECTIVE_ACHIEVEMENTS[obj_key]
                    achievement_exists = any(a.get("id") == achievement["id"] for a in USER_PROGRESS["achievements"])
                    
                    if not achievement_exists:
                        USER_PROGRESS["achievements"].append({
                            "id": achievement["id"],
                            "title": achievement["title"],
                            "description": achievement["description"]
                        })
    
    # Award achievement for first lesson
    if len(USER_PROGRESS["completed_lessons"]) == 1:
        first_lesson_achievement = next((a for a in USER_PROGRESS["achievements"] if a.get("id") == "first_lesson"), None)
        if not first_lesson_achievement:
            USER_PROGRESS["achievements"].append({
                "id": "first_lesson",
                "title": "First Step",
                "description": "Completed your first chess lesson!"
            })
    
    # Award achievement for completing all lessons
    if len(USER_PROGRESS["completed_lessons"]) == len(LESSONS):
        all_lessons_achievement = next((a for a in USER_PROGRESS["achievements"] if a.get("id") == "all_lessons"), None)
        if not all_lessons_achievement:
            USER_PROGRESS["achievements"].append({
                "id": "all_lessons",
                "title": "Chess Fundamentals Graduate",
                "description": "Completed all basic chess lessons!"
            })
            
    return jsonify(USER_PROGRESS)

@app.route('/api/complete-exercise', methods=['POST'])
def complete_exercise():
    """Mark an exercise as completed and update associated lesson progress"""
    data = request.json
    exercise_id = data.get('exerciseId')
    
    if not exercise_id:
        return jsonify({"error": "Exercise ID is required"}), 400
    
    # Find which lesson this exercise belongs to
    lesson_id = EXERCISE_TO_LESSON.get(exercise_id)
    if not lesson_id:
        return jsonify({"error": f"Exercise '{exercise_id}' not found"}), 404
    
    # Track objective completion if this exercise maps to a specific objective
    if exercise_id in EXERCISE_TO_OBJECTIVE:
        objective_info = EXERCISE_TO_OBJECTIVE[exercise_id]
        obj_key = f"{objective_info['lesson_id']}_{objective_info['objective_index']}"
        
        if obj_key not in USER_PROGRESS["completedObjectives"]:
            USER_PROGRESS["completedObjectives"].append(obj_key)
            
            # Add achievement for this specific objective
            if obj_key in OBJECTIVE_ACHIEVEMENTS:
                achievement = OBJECTIVE_ACHIEVEMENTS[obj_key]
                achievement_exists = any(a.get("id") == achievement["id"] for a in USER_PROGRESS["achievements"])
                
                if not achievement_exists:
                    USER_PROGRESS["achievements"].append({
                        "id": achievement["id"],
                        "title": achievement["title"],
                        "description": achievement["description"]
                    })
    
    # Find the lesson in our progress
    lesson_completion = next((completion for completion in USER_PROGRESS["completedLessons"] 
                              if completion.get("lessonId") == lesson_id), None)
    
    # If lesson doesn't exist in our progress, create it
    if not lesson_completion:
        lesson_completion = {
            "lessonId": lesson_id,
            "completed": False,
            "exercises": [],
            "timestamp": ""
        }
        USER_PROGRESS["completedLessons"].append(lesson_completion)
    
    # If exercises array doesn't exist, create it
    if "exercises" not in lesson_completion:
        lesson_completion["exercises"] = []
    
    # Check if exercise is already completed
    exercise_completion = next((ex for ex in lesson_completion["exercises"] 
                               if ex.get("id") == exercise_id), None)
    
    if not exercise_completion:
        lesson_completion["exercises"].append({
            "id": exercise_id,
            "completed": True,
            "timestamp": ""
        })
    else:
        exercise_completion["completed"] = True
    
    # Check if all exercises for this lesson are completed
    lesson = next((l for l in LESSONS if l["id"] == lesson_id), None)
    if lesson:
        all_exercises = lesson.get("interactive_exercises", [])
        completed_exercises = [ex.get("id") for ex in lesson_completion["exercises"] 
                              if ex.get("completed")]
        
        all_completed = all(ex in completed_exercises for ex in all_exercises)
        
        # If all exercises are completed, mark lesson as completed
        if all_completed:
            lesson_completion["completed"] = True
            
            # Also update the simple array format
            if lesson_id not in USER_PROGRESS["completed_lessons"]:
                USER_PROGRESS["completed_lessons"].append(lesson_id)
                USER_PROGRESS["current_streak"] += 1
                
                # Add achievement for the completed lesson
                if "achievement" in lesson:
                    # Check if achievement already exists
                    achievement_exists = any(a.get("id") == lesson["achievement"]["id"] for a in USER_PROGRESS["achievements"])
                    
                    if not achievement_exists:
                        USER_PROGRESS["achievements"].append({
                            "id": lesson["achievement"]["id"],
                            "title": lesson["achievement"]["title"],
                            "description": lesson["achievement"]["description"]
                        })
                
                # If lesson 2 is completed, mark all its objectives as completed
                if lesson_id == 2:
                    for obj_index, objective in enumerate(lesson.get("objectives", [])):
                        obj_key = f"{lesson_id}_{obj_index}"
                        if obj_key not in USER_PROGRESS["completedObjectives"]:
                            USER_PROGRESS["completedObjectives"].append(obj_key)
                            
                            # Add achievement for each objective
                            if obj_key in OBJECTIVE_ACHIEVEMENTS:
                                achievement = OBJECTIVE_ACHIEVEMENTS[obj_key]
                                achievement_exists = any(a.get("id") == achievement["id"] for a in USER_PROGRESS["achievements"])
                                
                                if not achievement_exists:
                                    USER_PROGRESS["achievements"].append({
                                        "id": achievement["id"],
                                        "title": achievement["title"],
                                        "description": achievement["description"]
                                    })
                
                # Award achievement for first lesson
                if len(USER_PROGRESS["completed_lessons"]) == 1:
                    first_lesson_achievement = next((a for a in USER_PROGRESS["achievements"] if a.get("id") == "first_lesson"), None)
                    if not first_lesson_achievement:
                        USER_PROGRESS["achievements"].append({
                            "id": "first_lesson",
                            "title": "First Step",
                            "description": "Completed your first chess lesson!"
                        })
                
                # Award achievement for completing all lessons
                if len(USER_PROGRESS["completed_lessons"]) == len(LESSONS):
                    all_lessons_achievement = next((a for a in USER_PROGRESS["achievements"] if a.get("id") == "all_lessons"), None)
                    if not all_lessons_achievement:
                        USER_PROGRESS["achievements"].append({
                            "id": "all_lessons",
                            "title": "Chess Fundamentals Graduate",
                            "description": "Completed all basic chess lessons!"
                        })
    
    # Return the updated progress
    return jsonify(USER_PROGRESS)

@app.route('/board')
def chess_board():
    """Render the interactive chess board page"""
    return render_template('board.html')

@app.route('/exercises/<exercise_name>')
def exercise(exercise_name):
    """Render specific interactive exercises"""
    return render_template(f'exercises/{exercise_name}.html')

@app.route('/api/complete-objective', methods=['POST'])
def complete_objective():
    """Mark a specific objective as completed"""
    data = request.json
    lesson_id = data.get('lessonId')
    objective_index = data.get('objectiveIndex')
    
    if not lesson_id or objective_index is None:
        return jsonify({"error": "Lesson ID and objective index are required"}), 400
    
    # Create the objective key
    obj_key = f"{lesson_id}_{objective_index}"
    
    # Add to completed objectives if not already there
    if obj_key not in USER_PROGRESS["completedObjectives"]:
        USER_PROGRESS["completedObjectives"].append(obj_key)
        
        # Add achievement for this specific objective
        if obj_key in OBJECTIVE_ACHIEVEMENTS:
            achievement = OBJECTIVE_ACHIEVEMENTS[obj_key]
            achievement_exists = any(a.get("id") == achievement["id"] for a in USER_PROGRESS["achievements"])
            
            if not achievement_exists:
                USER_PROGRESS["achievements"].append({
                    "id": achievement["id"],
                    "title": achievement["title"],
                    "description": achievement["description"]
                })
    
    # Check if all objectives for this lesson are completed
    lesson = next((l for l in LESSONS if l["id"] == lesson_id), None)
    if lesson:
        all_objectives_completed = True
        for i, _ in enumerate(lesson.get("objectives", [])):
            if f"{lesson_id}_{i}" not in USER_PROGRESS["completedObjectives"]:
                all_objectives_completed = False
                break
        
        # If all objectives are completed, mark the lesson as completed
        if all_objectives_completed and lesson_id not in USER_PROGRESS["completed_lessons"]:
            USER_PROGRESS["completed_lessons"].append(lesson_id)
            
            # Update the completedLessons array too
            lesson_completion = next((completion for completion in USER_PROGRESS["completedLessons"] 
                                  if completion.get("lessonId") == lesson_id), None)
            
            if not lesson_completion:
                USER_PROGRESS["completedLessons"].append({
                    "lessonId": lesson_id,
                    "completed": True,
                    "timestamp": ""
                })
            else:
                lesson_completion["completed"] = True
            
            # Add achievement for the completed lesson
            if "achievement" in lesson:
                # Check if achievement already exists
                achievement_exists = any(a.get("id") == lesson["achievement"]["id"] for a in USER_PROGRESS["achievements"])
                
                if not achievement_exists:
                    USER_PROGRESS["achievements"].append({
                        "id": lesson["achievement"]["id"],
                        "title": lesson["achievement"]["title"],
                        "description": lesson["achievement"]["description"]
                    })
    
    return jsonify(USER_PROGRESS)

@app.route('/save-progress', methods=['POST'])
def save_progress():
    """Save user progress data from the client"""
    data = request.json
    if data:
        # Update our progress with the client data
        USER_PROGRESS.update(data)
        return jsonify({"success": True})
    return jsonify({"error": "No data provided"}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5001) 