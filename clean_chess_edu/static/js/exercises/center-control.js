// Center Control Exercise JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the exercise if the center board exists
    const centerBoardElement = document.getElementById('centerBoard');
    if (centerBoardElement) {
        initCenterControlExercise();
    }
});

// Global variables
let centerBoard = null;
let centerGame = null;
let currentStep = 0;
let completedSteps = [];

// Step information
const centerSteps = {
    1: {
        title: 'Center Squares',
        description: 'The center of the chessboard consists of the four central squares: d4, e4, d5, and e5. Controlling these squares gives your pieces more mobility and influence over the board.',
        tasks: [
            'Observe the highlighted center squares',
            'These four squares are the most valuable territory on the board'
        ],
        position: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        highlightSquares: ['d4', 'e4', 'd5', 'e5'],
        verification: function() {
            // This step is just informational, so always return true
            return true;
        }
    },
    2: {
        title: 'Center Pawns',
        description: 'One of the most common ways to control the center is by advancing your central pawns (d and e pawns). This stakes a claim to the center and prepares for piece development.',
        tasks: [
            'Move the d2 pawn to d4',
            'Move the e2 pawn to e4',
            'Notice how these pawns control key central squares'
        ],
        position: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        targetPosition: 'rnbqkbnr/pppppppp/8/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 1',
        highlightSquares: ['d2', 'e2', 'd4', 'e4'],
        verification: function() {
            const position = centerGame.fen().split(' ')[0];
            
            // Check for partially completed tasks (either d4 or e4 pawn moved)
            const dPawnMoved = position.includes('3P') && position.charAt(position.indexOf('3P') + 2) === '3';
            const ePawnMoved = position.includes('4P') || position.includes('P3');
            
            // For step completion, both pawns must be moved
            return position === 'rnbqkbnr/pppppppp/8/8/3PP3/8/PPP2PPP/RNBQKBNR';
        },
        // Add a function to check partial progress
        checkProgress: function() {
            const position = centerGame.fen().split(' ')[0];
            
            // Check if at least d4 or e4 pawn is moved but not both yet
            const dPawnMoved = position.includes('/8/8/3P') || position.includes('/8/8/4P');
            const ePawnMoved = position.includes('/8/8/P3') || position.includes('/8/8/2P1');
            
            return (dPawnMoved || ePawnMoved) && position !== 'rnbqkbnr/pppppppp/8/8/3PP3/8/PPP2PPP/RNBQKBNR';
        }
    },
    3: {
        title: 'Develop Pieces',
        description: 'After establishing pawns in the center, you should develop your pieces to support and strengthen your center control. Knights and bishops are particularly effective for this purpose.',
        tasks: [
            'Develop your knights to f3 and c3',
            'Develop your light-squared bishop to d3',
            'These pieces now support your center pawns and control central squares'
        ],
        position: 'rnbqkbnr/pppppppp/8/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 1',
        targetPosition: 'rnbqkbnr/pppppppp/8/8/3PP3/2NB1N2/PPP2PPP/R1BQK2R w KQkq - 0 1',
        highlightSquares: ['c3', 'f3', 'd3', 'g1', 'b1', 'f1'],
        verification: function() {
            const position = centerGame.fen().split(' ')[0];
            return position === 'rnbqkbnr/pppppppp/8/8/3PP3/2NB1N2/PPP2PPP/R1BQK2R';
        },
        // Add a function to check partial progress
        checkProgress: function() {
            const position = centerGame.fen().split(' ')[0];
            
            // Check if at least one piece is developed but not all yet
            const knightF3Moved = position.includes('3/8/5N2') || position.includes('3/8/5N');
            const knightC3Moved = position.includes('3/8/2N') || position.includes('3/8/1N1');
            const bishopD3Moved = position.includes('3/8/3B') || position.includes('3/8/2B1');
            
            const pieceMoved = knightF3Moved || knightC3Moved || bishopD3Moved;
            
            return pieceMoved && position !== 'rnbqkbnr/pppppppp/8/8/3PP3/2NB1N2/PPP2PPP/R1BQK2R';
        }
    },
    4: {
        title: 'Control Center',
        description: 'Notice how your pawns and pieces work together to control the central squares. This central control gives you more options for attack and defense, while restricting your opponent\'s movement.',
        tasks: [
            'Observe how your pieces and pawns influence the central squares',
            'The central control provides better mobility for your pieces',
            'This is a strong foundation for the middlegame'
        ],
        position: 'rnbqkbnr/pppppppp/8/8/3PP3/2NB1N2/PPP2PPP/R1BQK2R w KQkq - 0 1',
        controlledSquares: ['c5', 'd4', 'e4', 'f5', 'c4', 'd5', 'e5', 'f4'],
        verification: function() {
            // This step is more about observation and understanding, so return true
            return true;
        }
    }
};

// Initialize the center control exercise
function initCenterControlExercise() {
    // Initialize the Chess.js game
    centerGame = new Chess();
    
    // Configuration for the center board
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
    
    // Create the center board
    centerBoard = Chessboard('centerBoard', config);
    
    // Make it responsive
    window.addEventListener('resize', centerBoard.resize);
    
    // Set up event listeners
    setupExerciseEventListeners();
    
    // Start with the first step
    goToStep(1);
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
    const resetBoardBtn = document.getElementById('resetBoard');
    if (resetBoardBtn) {
        resetBoardBtn.addEventListener('click', function() {
            // Reset to the current step's starting position
            if (currentStep > 0 && centerSteps[currentStep]) {
                loadPosition(centerSteps[currentStep].position);
                updateExerciseMessage(`Step ${currentStep}: ${centerSteps[currentStep].title}. ${centerSteps[currentStep].tasks[0]}`);
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
    centerGame.load(fen);
    centerBoard.position(fen);
}

// Go to a specific step
function goToStep(step) {
    currentStep = step;
    
    // Update UI for this step
    updateStepInfo(centerSteps[step]);
    
    // Load the step's position
    loadPosition(centerSteps[step].position);
    
    // Highlight squares if needed
    clearHighlights();
    if (centerSteps[step].highlightSquares) {
        centerSteps[step].highlightSquares.forEach(square => {
            highlightSquare(square, 'center-square');
        });
    }
    
    if (centerSteps[step].controlledSquares) {
        centerSteps[step].controlledSquares.forEach(square => {
            highlightSquare(square, 'controlled-square');
        });
    }
    
    // Update message
    updateExerciseMessage(`Step ${step}: ${centerSteps[step].title}. ${centerSteps[step].tasks[0]}`);
    
    // Update progress bar
    updateProgressBar();
    
    // Enable/disable next button
    const nextButton = document.getElementById('nextStep');
    if (nextButton) {
        nextButton.disabled = !completedSteps.includes(step);
    }
    
    // Ensure the board is properly updated
    centerBoard.position(centerGame.fen());
}

// Go to the next step
function goToNextStep() {
    const nextStep = currentStep + 1;
    
    if (nextStep <= Object.keys(centerSteps).length) {
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
        // Exercise completed
        showCompletionAnimation();
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
                <p>Follow each step to learn about controlling the center.</p>
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
        const totalSteps = Object.keys(centerSteps).length;
        const progress = (completedSteps.length / totalSteps) * 100;
        progressFill.style.width = `${progress}%`;
        currentStepElement.textContent = completedSteps.length;
    }
}

// Highlight a square on the board
function highlightSquare(square, className) {
    const squareElement = document.querySelector(`.square-${square}`);
    if (squareElement) {
        squareElement.classList.add(className);
    }
}

// Clear all highlights from the board
function clearHighlights() {
    document.querySelectorAll('.center-square, .controlled-square, .legal-move-square').forEach(square => {
        square.classList.remove('center-square', 'controlled-square', 'legal-move-square');
    });
}

// Verify the current position
function verifyCurrentPosition() {
    if (currentStep > 0 && centerSteps[currentStep] && centerSteps[currentStep].verification) {
        const isCorrect = centerSteps[currentStep].verification();
        
        if (isCorrect) {
            // Mark step as completed
            if (!completedSteps.includes(currentStep)) {
                completedSteps.push(currentStep);
                updateStepInfo(centerSteps[currentStep]);
                updateProgressBar();
                
                // Enable next button
                const nextButton = document.getElementById('nextStep');
                if (nextButton) {
                    nextButton.disabled = false;
                }
                
                // Show success message
                updateExerciseMessage(`Great job! You've completed step ${currentStep}. You can now move to the next step.`);
                
                // Show step completion animation
                showStepCompletionAnimation();
            }
        } else {
            // Show error message
            updateExerciseMessage(`That's not quite right. Review the tasks for step ${currentStep} and try again.`);
        }
    }
}

// Show animation when a step is completed
function showStepCompletionAnimation() {
    const boardElement = document.getElementById('centerBoard');
    
    if (boardElement && typeof anime === 'function') {
        anime({
            targets: boardElement,
            scale: [1, 1.03, 1],
            boxShadow: [
                { value: '0 0 20px rgba(76, 175, 80, 0.8)', duration: 1000 },
                { value: '0 0 0px rgba(76, 175, 80, 0)', duration: 1000 }
            ],
            duration: 2000,
            easing: 'easeInOutQuad'
        });
    }
}

// Show completion animation
function showCompletionAnimation() {
    // Show completion message
    updateExerciseMessage('Congratulations! You have completed the center control exercise!');
    
    // Disable controls
    const resetBoardBtn = document.getElementById('resetBoard');
    const verifyPositionBtn = document.getElementById('verifyPosition');
    const nextStepBtn = document.getElementById('nextStep');
    
    if (resetBoardBtn) resetBoardBtn.disabled = true;
    if (verifyPositionBtn) verifyPositionBtn.disabled = true;
    if (nextStepBtn) nextStepBtn.disabled = true;
    
    // Mark lesson 2 as completed
    if (typeof completeLesson === 'function') {
        completeLesson(2);
    }
    
    // Add achievement (if we have achievement functionality)
    if (typeof addAchievement === 'function') {
        addAchievement({
            id: 'center_control_complete',
            title: 'Center Commander',
            description: 'Completed the center control exercise'
        });
    }
    
    // Show celebration with anime.js
    if (typeof anime === 'function') {
        anime({
            targets: '#centerBoard',
            scale: [1, 1.05, 1],
            boxShadow: [
                { value: '0 0 20px rgba(76, 175, 80, 0.8)', duration: 1000 },
                { value: '0 0 0px rgba(76, 175, 80, 0)', duration: 1000 }
            ],
            duration: 2000,
            easing: 'easeInOutQuad'
        });
    }
    
    // After a delay, provide option to continue to next lesson
    setTimeout(() => {
        const exerciseTask = document.getElementById('exerciseTask');
        if (exerciseTask) {
            exerciseTask.innerHTML = `
                <div class="next-lesson">
                    <p>Ready to continue your chess journey?</p>
                    <a href="/exercises/piece_development" class="btn primary">Next Exercise: Piece Development →</a>
                </div>
            `;
        }
    }, 3000);
}

// Callbacks for the chessboard

// Piece drag started
function onDragStart(source, piece, position, orientation) {
    // Allow dragging pieces in steps 2 and 3, but also after completion
    // Only restrict dragging in steps 1 and 4 which are just observational
    if (currentStep === 1 || currentStep === 4) return false;
    
    // Only allow white pieces to be moved (for simplicity)
    if (piece.search(/^b/) !== -1) return false;
    
    // Check if the move is legal
    const moves = centerGame.moves({
        square: source,
        verbose: true
    });
    
    if (moves.length === 0) return false;
    
    // Clear previous highlights before adding new ones
    clearHighlights();
    
    // Highlight legal moves
    for (let i = 0; i < moves.length; i++) {
        highlightSquare(moves[i].to, 'legal-move-square');
    }
    
    // Also highlight the source square
    highlightSquare(source, 'center-square');
    
    return true; // Explicitly return true to allow the drag
}

// Piece dropped
function onDrop(source, target, piece, newPos, oldPos, orientation) {
    // Clear highlights
    clearHighlights();
    
    // See if the move is legal
    const move = centerGame.move({
        from: source,
        to: target,
        promotion: 'q' // Always promote to a queen for simplicity
    });
    
    // If illegal move, snap back
    if (move === null) return 'snapback';
    
    // Check if the position is correct for the current step
    if (currentStep === 2 || currentStep === 3) {
        // Check for final completion (all pieces moved)
        const isCorrect = centerSteps[currentStep].verification();
        
        // If this is the final position, mark step as completed
        if (isCorrect && !completedSteps.includes(currentStep)) {
            completedSteps.push(currentStep);
            updateStepInfo(centerSteps[currentStep]);
            updateProgressBar();
            
            // Enable next button
            const nextButton = document.getElementById('nextStep');
            if (nextButton) {
                nextButton.disabled = false;
            }
            
            // Show success message
            updateExerciseMessage(`Great job! You've completed step ${currentStep}. You can now move to the next step.`);
            
            // Show step completion animation
            showStepCompletionAnimation();
        } 
        // Check for partial progress
        else if (centerSteps[currentStep].checkProgress && centerSteps[currentStep].checkProgress()) {
            // Update message to encourage completion
            const remainingTasks = centerSteps[currentStep].tasks.slice(1).join(', ');
            updateExerciseMessage(`Good start! Now complete the remaining tasks: ${remainingTasks}`);
        }
    }
    
    // Ensure the board is updated properly
    centerBoard.position(centerGame.fen());
}

// After piece snap animation completes
function onSnapEnd() {
    centerBoard.position(centerGame.fen());
}

// Mouse hover over square
function onMouseoverSquare(square, piece) {
    // Only show legal moves for steps 2 and 3
    if (currentStep !== 2 && currentStep !== 3) return;
    
    // Get all legal moves for this square
    const moves = centerGame.moves({
        square: square,
        verbose: true
    });
    
    // If no moves available, return
    if (moves.length === 0) return;
    
    // Highlight the square being hovered
    highlightSquare(square, 'center-square');
    
    // Highlight all legal moves
    for (let i = 0; i < moves.length; i++) {
        highlightSquare(moves[i].to, 'legal-move-square');
    }
}

// Mouse leaves square
function onMouseoutSquare(square, piece) {
    // Re-highlight center squares if in step 1 or 4
    clearHighlights();
    
    if (currentStep === 1 && centerSteps[1].highlightSquares) {
        centerSteps[1].highlightSquares.forEach(square => {
            highlightSquare(square, 'center-square');
        });
    } else if (currentStep === 2 && centerSteps[2].highlightSquares) {
        // Re-highlight squares for step 2 if any
        centerSteps[2].highlightSquares && centerSteps[2].highlightSquares.forEach(square => {
            highlightSquare(square, 'center-square');
        });
    } else if (currentStep === 3 && centerSteps[3].highlightSquares) {
        // Re-highlight squares for step 3 if any
        centerSteps[3].highlightSquares && centerSteps[3].highlightSquares.forEach(square => {
            highlightSquare(square, 'center-square');
        });
    } else if (currentStep === 4 && centerSteps[4].controlledSquares) {
        centerSteps[4].controlledSquares.forEach(square => {
            highlightSquare(square, 'controlled-square');
        });
    }
} 