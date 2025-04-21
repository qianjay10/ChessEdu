// Board Setup Exercise JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the exercise if the setup board exists
    const setupBoardElement = document.getElementById('setupBoard');
    if (setupBoardElement) {
        initBoardSetupExercise();
    }
});

// Global variables
let setupBoard = null;
let setupGame = null;
let currentStep = 0;
let completedSteps = [];
let correctSetup = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Standard chess starting position

// Step information
const setupSteps = {
    1: {
        title: 'Board Orientation',
        description: 'The chessboard should be set up with a white square in the bottom right corner. The coordinates run from a-h horizontally and 1-8 vertically.',
        tasks: [
            'Make sure the board is oriented correctly with a white square in the bottom right',
            'Notice how the coordinates run along the edges of the board'
        ],
        verification: function() {
            // Board orientation is automatically correct in the UI
            return true;
        }
    },
    2: {
        title: 'Place Pawns',
        description: 'Pawns form the front line of your army. White pawns start on the second rank (row 2), and black pawns start on the seventh rank (row 7).',
        tasks: [
            'Place white pawns on the second rank (a2-h2)',
            'Place black pawns on the seventh rank (a7-h7)'
        ],
        verification: function() {
            const position = setupBoard.position();
            
            // Check white pawns
            for (let file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
                if (position[file + '2'] !== 'wP') return false;
            }
            
            // Check black pawns
            for (let file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
                if (position[file + '7'] !== 'bP') return false;
            }
            
            return true;
        }
    },
    3: {
        title: 'Place Pieces',
        description: 'The major and minor pieces are arranged on the first and eighth ranks. The setup is symmetric for both sides. From left to right: Rook, Knight, Bishop, Queen, King, Bishop, Knight, Rook.',
        tasks: [
            'Place white pieces on the first rank (a1-h1)',
            'Place black pieces on the eighth rank (a8-h8)',
            'Remember: Rooks in the corners, then Knights, then Bishops',
            'Queen goes on her own color (white queen on d1, black queen on d8)',
            'King goes on the remaining center square'
        ],
        verification: function() {
            const position = setupBoard.position();
            
            // Check white pieces
            if (position['a1'] !== 'wR') return false;
            if (position['b1'] !== 'wN') return false;
            if (position['c1'] !== 'wB') return false;
            if (position['d1'] !== 'wQ') return false;
            if (position['e1'] !== 'wK') return false;
            if (position['f1'] !== 'wB') return false;
            if (position['g1'] !== 'wN') return false;
            if (position['h1'] !== 'wR') return false;
            
            // Check black pieces
            if (position['a8'] !== 'bR') return false;
            if (position['b8'] !== 'bN') return false;
            if (position['c8'] !== 'bB') return false;
            if (position['d8'] !== 'bQ') return false;
            if (position['e8'] !== 'bK') return false;
            if (position['f8'] !== 'bB') return false;
            if (position['g8'] !== 'bN') return false;
            if (position['h8'] !== 'bR') return false;
            
            return true;
        }
    },
    4: {
        title: 'Final Check',
        description: 'Review the complete setup. Remember these key points: white square in bottom right, queens on their own color (white queen on white square, black queen on black square), and the position is symmetric.',
        tasks: [
            'Verify that all pieces are in their correct starting positions',
            'White moves first in chess'
        ],
        verification: function() {
            const currentFen = setupBoard.fen();
            const standardFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
            
            // Just compare the piece positions (first part of FEN)
            return currentFen === standardFen;
        }
    }
};

// Initialize the board setup exercise
function initBoardSetupExercise() {
    // Initialize the Chess.js game
    setupGame = new Chess();
    setupGame.clear(); // Clear the board for our custom setup
    
    // Configuration for the setup board
    const config = {
        draggable: true,
        dropOffBoard: 'trash',
        sparePieces: true,
        showNotation: true,
        position: 'start',
        pieceTheme: '/static/images/chesspieces/wikipedia/{piece}.png',
        onDrop: onPieceDrop
    };
    
    // Create the setup board
    setupBoard = Chessboard('setupBoard', config);
    
    // Make it responsive
    window.addEventListener('resize', setupBoard.resize);
    
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
            if (currentStep === 1) {
                // Empty board for orientation step
                setupBoard.position('8/8/8/8/8/8/8/8');
            } else if (currentStep === 2) {
                // Empty for pawns step
                setupBoard.position('8/8/8/8/8/8/8/8');
            } else {
                // Start with pawns in place for pieces step
                setupBoard.position('8/pppppppp/8/8/8/8/PPPPPPPP/8');
            }
            
            updateSetupMessage(`Board reset. ${setupSteps[currentStep].tasks[0]}`);
        });
    }
    
    // Verify setup button
    const verifySetupBtn = document.getElementById('verifySetup');
    if (verifySetupBtn) {
        verifySetupBtn.addEventListener('click', verifyCurrentSetup);
    }
    
    // Next step button
    const nextStepBtn = document.getElementById('nextStep');
    if (nextStepBtn) {
        nextStepBtn.addEventListener('click', goToNextStep);
    }
}

// Go to a specific step
function goToStep(step) {
    currentStep = step;
    
    // Update UI for this step
    updateSetupInfo(setupSteps[step]);
    
    // Set up appropriate board position
    if (step === 1) {
        // Empty board for orientation
        setupBoard.position('8/8/8/8/8/8/8/8');
    } else if (step === 2) {
        // Empty board for pawns
        setupBoard.position('8/8/8/8/8/8/8/8');
    } else if (step === 3) {
        // Board with pawns for piece placement
        setupBoard.position('8/pppppppp/8/8/8/8/PPPPPPPP/8');
    } else if (step === 4) {
        // Board with current setup for verification
        // Keep current position
    }
    
    // Update message
    updateSetupMessage(`Step ${step}: ${setupSteps[step].title}. ${setupSteps[step].tasks[0]}`);
    
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
    
    if (nextStep <= Object.keys(setupSteps).length) {
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

// Update the setup information display
function updateSetupInfo(stepData) {
    const setupInfoElement = document.getElementById('setupInfo');
    if (!setupInfoElement) return;
    
    if (!stepData) {
        setupInfoElement.innerHTML = `
            <h3>Step Information</h3>
            <div class="setup-description">
                <p>Follow each step to learn the proper board setup.</p>
            </div>
        `;
        return;
    }
    
    // Check if step is completed
    const isCompleted = completedSteps.includes(currentStep);
    const completedClass = isCompleted ? 'step-complete' : '';
    
    setupInfoElement.innerHTML = `
        <h3 class="${completedClass}">${stepData.title} ${isCompleted ? '✓' : ''}</h3>
        <div class="setup-description">
            <p>${stepData.description}</p>
            <div class="setup-tasks">
                ${stepData.tasks.map(task => `<p class="task-item">• ${task}</p>`).join('')}
            </div>
        </div>
    `;
}

// Update the setup message
function updateSetupMessage(message) {
    const messageElement = document.getElementById('setupMessage');
    if (messageElement) {
        messageElement.textContent = message;
    }
}

// Update the progress bar
function updateProgressBar() {
    const progressFill = document.getElementById('progressFill');
    const currentStepElement = document.getElementById('currentStep');
    const totalStepsElement = document.getElementById('totalSteps');
    
    if (progressFill && currentStepElement && totalStepsElement) {
        const totalSteps = Object.keys(setupSteps).length;
        const progress = (completedSteps.length / totalSteps) * 100;
        
        progressFill.style.width = `${progress}%`;
        currentStepElement.textContent = completedSteps.length;
        totalStepsElement.textContent = totalSteps;
    }
}

// Handle piece drop
function onPieceDrop(source, target, piece, newPosition, oldPosition, orientation) {
    // Always allow dropping pieces when in setup mode
    setupBoard.position(newPosition);
    
    // Check if the current step is now complete
    const stepVerification = setupSteps[currentStep].verification;
    if (stepVerification && stepVerification()) {
        if (!completedSteps.includes(currentStep)) {
            completedSteps.push(currentStep);
            
            // Show success message
            updateSetupMessage(`Excellent! You've completed Step ${currentStep}: ${setupSteps[currentStep].title}.`);
            
            // Update UI
            updateSetupInfo(setupSteps[currentStep]);
            updateProgressBar();
            
            // Enable next button
            const nextButton = document.getElementById('nextStep');
            if (nextButton) {
                nextButton.disabled = false;
            }
            
            // Show completion animation
            showStepCompletionAnimation();
        }
    }
}

// Verify the current setup
function verifyCurrentSetup() {
    const stepVerification = setupSteps[currentStep].verification;
    
    if (stepVerification && stepVerification()) {
        // Step is complete
        if (!completedSteps.includes(currentStep)) {
            completedSteps.push(currentStep);
            
            // Show success message
            updateSetupMessage(`Correct! You've completed Step ${currentStep}: ${setupSteps[currentStep].title}.`);
            
            // Update UI
            updateSetupInfo(setupSteps[currentStep]);
            updateProgressBar();
            
            // Enable next button
            const nextButton = document.getElementById('nextStep');
            if (nextButton) {
                nextButton.disabled = false;
            }
            
            // Show completion animation
            showStepCompletionAnimation();
        } else {
            // Already completed, just show confirmation
            updateSetupMessage(`This step is already complete. You can proceed to the next one.`);
        }
    } else {
        // Step is incomplete
        updateSetupMessage(`Not quite right. Check the instructions and try again.`);
        
        // Use anime.js to shake the board gently
        anime({
            targets: '#setupBoard',
            translateX: [
                { value: -10, duration: 100, easing: 'easeInOutSine' },
                { value: 10, duration: 100, easing: 'easeInOutSine' },
                { value: -10, duration: 100, easing: 'easeInOutSine' },
                { value: 0, duration: 100, easing: 'easeInOutSine' }
            ]
        });
    }
}

// Show step completion animation
function showStepCompletionAnimation() {
    // Get the step button
    const stepButton = document.querySelector(`.step-btn[data-step="${currentStep}"]`);
    
    if (stepButton) {
        // Add completion marker
        stepButton.innerHTML += '<span class="step-complete-mark">✓</span>';
        
        // Animate it
        anime({
            targets: stepButton,
            scale: [1, 1.1, 1],
            backgroundColor: [
                { value: '#4caf50', duration: 300 },
                { value: '', duration: 500 }
            ],
            easing: 'easeInOutQuad',
            duration: 800
        });
    }
    
    // Use anime.js to create a flash effect on the board
    anime({
        targets: '#setupBoard',
        boxShadow: [
            { value: '0 0 10px rgba(76, 175, 80, 0.5)', duration: 300 },
            { value: '0 0 20px rgba(76, 175, 80, 0.7)', duration: 300 },
            { value: '0 0 10px rgba(76, 175, 80, 0.5)', duration: 300 },
            { value: '0 0 0px rgba(76, 175, 80, 0)', duration: 300 }
        ],
        easing: 'easeInOutSine'
    });
}

// Show final completion animation
function showCompletionAnimation() {
    // Show completion message
    updateSetupMessage('Congratulations! You have completed the board setup exercise!');
    
    // Disable controls
    const resetBoardBtn = document.getElementById('resetBoard');
    const verifySetupBtn = document.getElementById('verifySetup');
    const nextStepBtn = document.getElementById('nextStep');
    
    if (resetBoardBtn) resetBoardBtn.disabled = true;
    if (verifySetupBtn) verifySetupBtn.disabled = true;
    if (nextStepBtn) nextStepBtn.disabled = true;
    
    // Add achievement (if we have achievement functionality)
    if (typeof addAchievement === 'function') {
        addAchievement({
            id: 'board_setup_complete',
            title: 'Board Master',
            description: 'Completed the board setup exercise'
        });
    }
    
    // Show celebration with anime.js
    if (typeof chessAnimations !== 'undefined' && typeof chessAnimations.showCelebration === 'function') {
        chessAnimations.showCelebration('Board Setup Complete!');
    } else {
        // Fallback if the animation module isn't available
        anime({
            targets: '#setupBoard',
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
        const setupTask = document.getElementById('setupTask');
        if (setupTask) {
            setupTask.innerHTML = `
                <div class="next-lesson">
                    <p>Ready to continue your chess journey?</p>
                    <a href="/exercises/basic_tactics" class="btn primary">Next Lesson: Basic Tactics →</a>
                </div>
            `;
        }
    }, 3000);
} 