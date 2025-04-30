/**
 * Piece Development Exercise
 * This exercise teaches students how to properly develop their pieces in the opening phase of a chess game.
 */

// Initialize variables
let board = null;
let game = new Chess();
let currentStep = 1;
let totalSteps = 5;
let userMoves = [];
let stepCompleted = false;

// Step data contains title, description, tasks, starting position, and correct moves for each step
const stepData = [
    {
        id: 1,
        title: "Knights First",
        description: "Knights are typically the first pieces to develop in the opening. They can jump over other pieces and control important center squares.",
        startingPosition: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        instructions: "Develop one of your knights to a good square. Knights should generally be developed towards the center of the board.",
        tasks: [
            "Move one of your knights to either f3 or c3"
        ],
        correctMoves: ["Nf3", "Nc3"],
        hint: "Knights on f3 or c3 control important center squares and prepare for castling."
    },
    {
        id: 2,
        title: "Develop Center Pawns",
        description: "Controlling the center with pawns gives your pieces more mobility and restricts your opponent's options.",
        startingPosition: "rnbqkb1r/pppppppp/5n2/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 2 2",
        instructions: "Move one of your center pawns (d or e) forward to control the center.",
        tasks: [
            "Move your e-pawn or d-pawn forward by one or two squares"
        ],
        correctMoves: ["e4", "d4", "e5", "d5"],
        hint: "The e4 and d4 pawns control important center squares and open lines for your bishop and queen."
    },
    {
        id: 3, 
        title: "Develop Bishops",
        description: "After developing knights and center pawns, bishops should be developed to active squares where they control diagonals.",
        startingPosition: "rnbqk2r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1",
        instructions: "Develop one of your bishops to an active square.",
        tasks: [
            "Move your light-squared bishop to an active square (like c4 or b5)"
        ],
        correctMoves: ["Bc4", "Bb5"],
        hint: "The bishop on c4 controls the important d5 square and puts pressure on the f7 pawn."
    },
    {
        id: 4,
        title: "Castle Early",
        description: "Castling is a crucial move that improves your king's safety and connects your rooks.",
        startingPosition: "rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
        instructions: "Castle to bring your king to safety and connect your rooks.",
        tasks: [
            "Castle kingside (O-O)"
        ],
        correctMoves: ["O-O"],
        hint: "Castling kingside moves your king to g1 and your rook to f1, improving king safety and connecting your rooks."
    },
    {
        id: 5,
        title: "Complete Development",
        description: "Complete your development by bringing out your remaining pieces before starting an attack.",
        startingPosition: "rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4",
        instructions: "Complete your development by castling and connecting your rooks.",
        tasks: [
            "Castle kingside (O-O)",
            "Notice how both sides have completed basic development"
        ],
        correctMoves: ["O-O"],
        hint: "After castling, both sides have completed the basic opening principles: developed knights and bishops, controlled the center, and castled for king safety."
    }
];

// Initialize the board when the page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeBoard();
    setupStepUI(currentStep);
    updateProgressIndicator();

    // Add event listeners for buttons
    document.getElementById('resetBtn').addEventListener('click', resetBoard);
    document.getElementById('hintBtn').addEventListener('click', showHint);
    document.getElementById('nextBtn').addEventListener('click', goToNextStep);
    
    // Add event listener for the complete button if it exists
    const completeBtn = document.getElementById('completeBtn');
    if (completeBtn) {
        completeBtn.addEventListener('click', completeExercise);
    }

    // Enable the complete button only after all steps are finished
    updateNavigationButtons();
});

function initializeBoard() {
    const config = {
        draggable: true,
        position: stepData[currentStep - 1].startingPosition,
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        pieceTheme: '/static/images/chesspieces/wikipedia/{piece}.png'
    };
    
    board = Chessboard('developmentBoard', config);
    game.load(stepData[currentStep - 1].startingPosition);
}

function resetBoard() {
    board.position(stepData[currentStep - 1].startingPosition);
    game.load(stepData[currentStep - 1].startingPosition);
    userMoves = [];
    stepCompleted = false;
    updateNavigationButtons();
    showFeedback('Board Reset', 'The board has been reset to the starting position.', 'info');
}

function onDragStart(source, piece) {
    // Do not allow pieces to be dragged if step is completed
    if (stepCompleted) return false;
    
    // Only allow the current player to move pieces
    if (game.turn() === 'w' && piece.search(/^b/) !== -1) return false;
    if (game.turn() === 'b' && piece.search(/^w/) !== -1) return false;
    
    // Do not allow pieces to be dragged if the game is over
    if (game.game_over()) return false;
}

function onDrop(source, target) {
    // See if the move is legal
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // Always promote to a queen for simplicity
    });
    
    // Illegal move
    if (move === null) return 'snapback';
    
    // Track user moves
    userMoves.push(move);
    
    // Check if the move is correct for the current step
    checkMove(move);
}

function onSnapEnd() {
    // Update the board position after the piece snap
    board.position(game.fen());
}

function checkMove(move) {
    const currentStepData = stepData[currentStep - 1];
    
    // Check if the move is one of the correct moves for this step
    if (currentStepData.correctMoves.includes(move.san)) {
        stepCompleted = true;
        showFeedback('Correct Move!', 'That\'s the right move. You\'ve completed this step.', 'success');
        document.getElementById('nextBtn').disabled = false;
        
        // Update the progress indicator
        updateProgressIndicator();
        
        // If it's the last step, enable the complete button
        if (currentStep === totalSteps) {
            // Add the complete button to the exercise controls if it doesn't exist
            const completeBtn = document.getElementById('completeBtn');
            if (!completeBtn) {
                const exerciseControls = document.querySelector('.exercise-controls');
                if (exerciseControls) {
                    const completeButton = document.createElement('button');
                    completeButton.id = 'completeBtn';
                    completeButton.className = 'btn success';
                    completeButton.textContent = 'Complete Exercise';
                    completeButton.addEventListener('click', completeExercise);
                    exerciseControls.appendChild(completeButton);
                }
            } else {
                completeBtn.classList.remove('hidden');
            }
        }
    } else {
        showFeedback('Try Again', 'That move doesn\'t accomplish the task for this step. Try again or check the hint.', 'warning');
    }
    
    updateNavigationButtons();
}

function showHint() {
    const currentHint = stepData[currentStep - 1].hint;
    showFeedback('Hint', currentHint, 'info');
}

function setupStepUI(stepNumber) {
    const step = stepData[stepNumber - 1];
    
    // Update step title and description
    const stepTitle = document.querySelector('.step-btn[data-step="' + stepNumber + '"]');
    if (stepTitle) {
        stepTitle.classList.add('active');
    }
    
    const stepDescriptionEl = document.getElementById('stepDescription');
    if (stepDescriptionEl) {
        stepDescriptionEl.textContent = step.description;
    }
    
    // Update task list
    const tasksList = document.getElementById('tasksList');
    if (tasksList) {
        tasksList.innerHTML = '';
        
        step.tasks.forEach(task => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="task-checkbox">□</span> ${task}`;
            tasksList.appendChild(li);
        });
    }
    
    // Set step instructions
    const stepInstructions = document.getElementById('stepInstructions');
    if (stepInstructions) {
        stepInstructions.innerHTML = `
            <h4>Instructions:</h4>
            <p>${step.instructions}</p>
        `;
    }
    
    // Update exercise message
    const exerciseMessage = document.getElementById('exerciseMessage');
    if (exerciseMessage) {
        exerciseMessage.textContent = step.tasks[0];
    }
    
    // Reset step completion status
    stepCompleted = false;
    
    // Reset the board for this step
    board.position(step.startingPosition);
    game.load(step.startingPosition);
}

function updateProgressIndicator() {
    // Update the progress steps
    for (let i = 1; i <= totalSteps; i++) {
        const stepElement = document.querySelector(`.step-btn[data-step="${i}"]`);
        
        if (stepElement) {
            if (i < currentStep) {
                stepElement.classList.add('completed');
                stepElement.classList.remove('active');
            } else if (i === currentStep) {
                stepElement.classList.add('active');
                stepElement.classList.remove('completed');
            } else {
                stepElement.classList.remove('active', 'completed');
            }
        }
    }
    
    // Update progress bar
    const progressFill = document.getElementById('progressFill');
    const currentStepEl = document.getElementById('currentStep');
    if (progressFill && currentStepEl) {
        const completedSteps = Math.max(currentStep - 1 + (stepCompleted ? 1 : 0), 0);
        const progressPercentage = (completedSteps / totalSteps) * 100;
        progressFill.style.width = `${progressPercentage}%`;
        currentStepEl.textContent = completedSteps;
    }
}

function goToNextStep() {
    if (currentStep < totalSteps) {
        // Mark the current step as completed in the UI
        const currentStepBtn = document.querySelector(`.step-btn[data-step="${currentStep}"]`);
        if (currentStepBtn) {
            currentStepBtn.classList.add('completed');
        }
        
        // Move to the next step
        currentStep++;
        
        // Update the UI for the new step
        setupStepUI(currentStep);
        updateProgressIndicator();
        updateNavigationButtons();
        
        // Update the active step button
        const stepButtons = document.querySelectorAll('.step-btn');
        stepButtons.forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.getAttribute('data-step')) === currentStep) {
                btn.classList.add('active');
            }
        });
    }
}

function goToPreviousStep() {
    if (currentStep > 1) {
        currentStep--;
        setupStepUI(currentStep);
        updateProgressIndicator();
        updateNavigationButtons();
    }
}

function updateNavigationButtons() {
    // Update next button
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.disabled = !stepCompleted;
    }
    
    // Show/hide complete button
    const completeBtn = document.getElementById('completeBtn');
    if (completeBtn) {
        if (currentStep === totalSteps && stepCompleted) {
            completeBtn.classList.remove('hidden');
        } else {
            completeBtn.classList.add('hidden');
        }
    }
}

// Complete exercise function
function completeExercise() {
    // Send completion to server
    fetch('/api/complete-exercise', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            exerciseId: 'piece_development',
            completed: true
        })
    })
    .then(response => response.json())
    .then(data => {
        showFeedback('Congratulations!', 'You have completed the Piece Development exercise! You can now move on to the next lesson.', 'success');
        
        // Show completion dialog
        setTimeout(() => {
            const exerciseContainer = document.querySelector('.exercise-container');
            if (exerciseContainer) {
                exerciseContainer.innerHTML = `
                    <div class="completion-message">
                        <h2>Exercise Completed!</h2>
                        <p>You've learned the key principles of piece development in the opening:</p>
                        <ul>
                            <li>Develop knights early to control center squares</li>
                            <li>Control the center with pawns</li>
                            <li>Develop bishops to active squares</li>
                            <li>Castle early for king safety</li>
                            <li>Complete development before launching an attack</li>
                        </ul>
                        <div class="completion-actions">
                            <a href="/" class="btn primary">Back to Home</a>
                            <a href="/exercises/fork_practice" class="btn success">Next Lesson: Basic Tactics →</a>
                        </div>
                    </div>
                `;
            }
        }, 2000);
        
        // Update local progress if possible
        if (window.userProgress) {
            window.userProgress = data;
            localStorage.setItem('chessEduProgress', JSON.stringify(data));
        }
    })
    .catch(error => {
        console.error('Error completing exercise:', error);
        showFeedback('Error', 'There was an error saving your progress. Please try again.', 'error');
    });
} 