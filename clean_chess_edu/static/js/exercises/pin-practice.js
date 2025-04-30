/**
 * Pin Practice Exercise
 * This exercise teaches students how to identify and execute pin tactics.
 */

// Global variables
let pinBoard = null;
let pinGame = null;
let currentStep = 1;
let completedSteps = [];

// Step information
const pinSteps = {
    1: {
        title: 'Absolute Pins',
        description: 'An absolute pin is when a piece cannot move at all because it would expose the king to check. This is a powerful tactical motif in chess.',
        tasks: [
            'Observe how the bishop pins the knight to the king',
            'Understand why the pinned piece cannot move'
        ],
        position: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        highlightSquares: [],
        verification: function() {
            // This step is informational for now
            return true;
        }
    },
    2: {
        title: 'Relative Pins',
        description: 'A relative pin occurs when a piece can technically move, but doing so would result in the loss of a more valuable piece behind it.',
        tasks: [
            'Observe how the bishop pins the knight to the queen',
            'Understand the risk of moving a relatively pinned piece'
        ],
        position: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        highlightSquares: [],
        verification: function() {
            // This step is informational for now
            return true;
        }
    },
    3: {
        title: 'Creating Pins',
        description: 'Long-range pieces like bishops, rooks, and queens are effective at creating pins. Learning to create pins can give you a tactical advantage.',
        tasks: [
            'Move your bishop to create a pin',
            'Notice how the pinned piece is restricted'
        ],
        position: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        highlightSquares: [],
        verification: function() {
            // This step is informational for now
            return true;
        }
    },
    4: {
        title: 'Practice Positions',
        description: 'Test your understanding of pin tactics by analyzing different positions and identifying or creating pin opportunities.',
        tasks: [
            'Identify the pin opportunity in this position',
            'Execute the move that creates a pin'
        ],
        position: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        highlightSquares: [],
        verification: function() {
            // This step is informational for now
            return true;
        }
    }
};

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the exercise if the board exists
    const pinBoardElement = document.getElementById('pinBoard');
    if (pinBoardElement) {
        initPinExercise();
    }
});

// Initialize the exercise
function initPinExercise() {
    // Initialize the Chess.js game
    pinGame = new Chess();
    
    // Configuration for the pin board
    const config = {
        draggable: true,
        position: 'start',
        showNotation: true,
        pieceTheme: '/static/images/chesspieces/wikipedia/{piece}.png',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        onMouseoverSquare: onMouseoverSquare,
        onMouseoutSquare: onMouseoutSquare
    };
    
    // Create the pin board
    pinBoard = Chessboard('pinBoard', config);
    
    // Make it responsive
    window.addEventListener('resize', pinBoard.resize);
    
    // Set up event listeners
    setupExerciseEventListeners();
    
    // Start with the first step
    goToStep(1);
    
    // Show development message
    showFeedback('Exercise Under Development', 'The Pin Practice exercise is currently under development. Please check back later.', 'info');
}

// Set up event listeners for exercise controls
function setupExerciseEventListeners() {
    // Step buttons
    const stepButtons = document.querySelectorAll('.step-btn[data-step]');
    stepButtons.forEach(button => {
        button.addEventListener('click', function() {
            const step = parseInt(this.getAttribute('data-step'));
            goToStep(step);
            
            // Update active state
            stepButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Reset board button
    const resetBoardBtn = document.getElementById('resetBtn');
    if (resetBoardBtn) {
        resetBoardBtn.addEventListener('click', function() {
            // Reset to the current step's starting position
            if (currentStep > 0 && pinSteps[currentStep]) {
                loadPosition(pinSteps[currentStep].position);
                updateExerciseMessage(`Step ${currentStep}: ${pinSteps[currentStep].title}. ${pinSteps[currentStep].tasks[0]}`);
            }
        });
    }
    
    // Verify position button
    const verifyPositionBtn = document.getElementById('verifyPosition');
    if (verifyPositionBtn) {
        verifyPositionBtn.addEventListener('click', verifyCurrentPosition);
    }
    
    // Next step button
    const nextStepBtn = document.getElementById('nextStep');
    if (nextStepBtn) {
        nextStepBtn.addEventListener('click', goToNextStep);
    }
}

// Load a position on the board
function loadPosition(fen) {
    pinGame.load(fen);
    pinBoard.position(fen);
}

// Go to a specific step
function goToStep(step) {
    currentStep = step;
    
    // Update UI for this step
    updateStepInfo(pinSteps[step]);
    
    // Load the step's position
    loadPosition(pinSteps[step].position);
    
    // Update message
    updateExerciseMessage(`Step ${step}: ${pinSteps[step].title}. ${pinSteps[step].tasks[0]}`);
    
    // Update progress bar
    updateProgressBar();
    
    // Enable/disable next button
    const nextButton = document.getElementById('nextStep');
    if (nextButton) {
        nextButton.disabled = !completedSteps.includes(step);
    }
}

// Go to the next step
function goToNextStep() {
    const nextStep = currentStep + 1;
    
    if (nextStep <= Object.keys(pinSteps).length) {
        goToStep(nextStep);
        
        // Update active state of step buttons
        const stepButtons = document.querySelectorAll('.step-btn[data-step]');
        stepButtons.forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.getAttribute('data-step')) === nextStep) {
                btn.classList.add('active');
            }
        });
    } else {
        // Exercise completed - placeholder for now
        showFeedback('Exercise Completed', 'You have completed all steps of the Pin Practice exercise. This exercise is still under development.', 'success');
    }
}

// Update the step information display
function updateStepInfo(stepData) {
    const stepInfoElement = document.getElementById('stepInfo');
    if (!stepInfoElement) return;
    
    if (!stepData) {
        stepInfoElement.innerHTML = `
            <h3>Step Information</h3>
            <div class="step-description">
                <p>Follow each step to learn about pin tactics.</p>
            </div>
        `;
        return;
    }
    
    // Check if step is completed
    const isCompleted = completedSteps.includes(currentStep);
    const completedClass = isCompleted ? 'step-complete' : '';
    
    stepInfoElement.innerHTML = `
        <h3 class="${completedClass}">${stepData.title} ${isCompleted ? '✓' : ''}</h3>
        <div class="step-description">
            <p>${stepData.description}</p>
        </div>
        <div class="step-tasks">
            <h4>Tasks:</h4>
            <ul>
                ${stepData.tasks.map(task => `<li>${task}</li>`).join('')}
            </ul>
        </div>
    `;
}

// Update the exercise message
function updateExerciseMessage(message) {
    const messageElement = document.getElementById('exerciseMessage');
    if (messageElement) {
        messageElement.textContent = message;
    }
}

// Update the progress bar
function updateProgressBar() {
    const progressFill = document.getElementById('progressFill');
    const currentStepElement = document.getElementById('currentStep');
    
    if (progressFill && currentStepElement) {
        const totalSteps = Object.keys(pinSteps).length;
        const progress = (completedSteps.length / totalSteps) * 100;
        progressFill.style.width = `${progress}%`;
        currentStepElement.textContent = completedSteps.length;
    }
}

// Verify the current position
function verifyCurrentPosition() {
    if (currentStep > 0 && pinSteps[currentStep] && pinSteps[currentStep].verification) {
        const isCorrect = pinSteps[currentStep].verification();
        
        if (isCorrect) {
            // Mark step as completed
            if (!completedSteps.includes(currentStep)) {
                completedSteps.push(currentStep);
                updateStepInfo(pinSteps[currentStep]);
                updateProgressBar();
                
                // Enable next button
                const nextButton = document.getElementById('nextStep');
                if (nextButton) {
                    nextButton.disabled = false;
                }
                
                // Show success message
                updateExerciseMessage(`Great job! You've completed step ${currentStep}. You can now move to the next step.`);
            }
        } else {
            // Show error message
            updateExerciseMessage(`That's not quite right. Review the tasks for step ${currentStep} and try again.`);
        }
    }
}

// Utility function to show feedback messages
function showFeedback(title, message, type) {
    const messageElement = document.getElementById('exerciseMessage');
    const taskElement = document.getElementById('exerciseTask');
    
    if (messageElement) {
        messageElement.textContent = title;
    }
    
    if (taskElement) {
        taskElement.textContent = message;
        
        // Apply appropriate styling based on type
        taskElement.className = 'exercise-task';
        if (type === 'success') {
            taskElement.style.color = 'var(--success-color)';
        } else if (type === 'warning') {
            taskElement.style.color = 'var(--warning-color)';
        } else if (type === 'info') {
            taskElement.style.color = 'var(--info-color)';
        }
    }
}

// Placeholder chess board callbacks
function onDragStart(source, piece, position, orientation) {
    return false; // Disable dragging for now as this is a placeholder
}

function onDrop(source, target, piece, newPos, oldPos, orientation) {
    return 'snapback'; // Always return pieces as this is a placeholder
}

function onSnapEnd() {
    pinBoard.position(pinGame.fen());
}

function onMouseoverSquare(square, piece) {
    // Placeholder
}

function onMouseoutSquare(square, piece) {
    // Placeholder
} 