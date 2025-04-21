// Piece Movement Exercise JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the exercise if the exercise board exists
    const exerciseBoardElement = document.getElementById('exerciseBoard');
    if (exerciseBoardElement) {
        initPieceMovementExercise();
    }
});

// Global variables
let exerciseBoard = null;
let exerciseGame = null;
let currentPiece = null;
let completedPieces = [];
let legalMoveSquares = [];

// Piece information
const pieceInfo = {
    pawn: {
        title: 'Pawn',
        icon: '♙',
        description: 'The pawn is the most numerous piece and moves forward one square at a time. On its first move, a pawn can move two squares forward. It captures diagonally forward. If a pawn reaches the opposite end of the board, it can be promoted to any other piece except a king.',
        startPosition: {fen: '8/8/8/8/8/8/P7/8 w - - 0 1', square: 'a2'},
        tasks: [
            'Move the pawn forward one square',
            'Now try moving it forward two squares (special first move)',
            'Pawns capture diagonally - see the highlighted squares'
        ]
    },
    knight: {
        title: 'Knight',
        icon: '♘',
        description: 'The knight moves in an L-shape: two squares in one direction and then one square perpendicular to that direction. It\'s the only piece that can jump over other pieces. The knight is particularly effective in closed positions where other pieces have limited mobility.',
        startPosition: {fen: '8/8/8/8/8/8/8/N7 w - - 0 1', square: 'a1'},
        tasks: [
            'Move the knight in an L-shape (2 squares in one direction, then 1 square perpendicular)',
            'Try moving to all possible squares from the center'
        ]
    },
    bishop: {
        title: 'Bishop',
        icon: '♗',
        description: 'The bishop moves any number of squares diagonally. Each bishop is restricted to squares of a single color. Bishops are particularly powerful in open positions where they have greater mobility.',
        startPosition: {fen: '8/8/8/8/8/8/8/B7 w - - 0 1', square: 'a1'},
        tasks: [
            'Move the bishop diagonally any number of squares',
            'Notice how it can only access squares of one color'
        ]
    },
    rook: {
        title: 'Rook',
        icon: '♖',
        description: 'The rook moves any number of squares horizontally or vertically. Rooks are particularly powerful in open files and ranks. They are usually developed later in the game after pawns and minor pieces.',
        startPosition: {fen: '8/8/8/8/8/8/8/R7 w - - 0 1', square: 'a1'},
        tasks: [
            'Move the rook horizontally or vertically any number of squares',
            'Try controlling an open file or rank'
        ]
    },
    queen: {
        title: 'Queen',
        icon: '♕',
        description: 'The queen is the most powerful piece, combining the movement of a rook and bishop. It can move any number of squares horizontally, vertically, or diagonally. Despite its power, the queen should not be developed too early as it can become a target for the opponent.',
        startPosition: {fen: '8/8/8/8/8/8/8/Q7 w - - 0 1', square: 'a1'},
        tasks: [
            'Move the queen horizontally, vertically, or diagonally any number of squares',
            'Notice how it combines the powers of the rook and bishop'
        ]
    },
    king: {
        title: 'King',
        icon: '♔',
        description: 'The king moves one square in any direction. While not the most powerful piece in mobility, it\'s the most important as the game ends when the king is checkmated. The king can also perform a special move called castling with a rook.',
        startPosition: {fen: '8/8/8/8/8/8/8/K7 w - - 0 1', square: 'a1'},
        tasks: [
            'Move the king one square in any direction',
            'The king must always stay safe from check'
        ]
    }
};

// Initialize the piece movement exercise
function initPieceMovementExercise() {
    console.log("Initializing piece movement exercise...");
    
    // Initialize the Chess.js game
    exerciseGame = new Chess();
    exerciseGame.clear(); // Clear the board for our custom setup
    
    // Configuration for the exercise board
    const config = {
        draggable: true,
        position: 'empty',
        sparePieces: false,
        showNotation: true,
        pieceTheme: '/static/images/chesspieces/wikipedia/{piece}.png',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        onMouseoverSquare: onMouseoverSquare,
        onMouseoutSquare: onMouseoutSquare
    };
    
    console.log("Creating exercise board with config:", config);
    
    // Create the exercise board
    exerciseBoard = Chessboard('exerciseBoard', config);
    
    // Log the result
    console.log("Exercise board created:", exerciseBoard);
    
    // Make it responsive
    window.addEventListener('resize', exerciseBoard.resize);
    
    // Set up event listeners
    setupExerciseEventListeners();
    
    // Initialize UI
    updatePieceInfo(null);
    updateProgressBar();
}

// Set up event listeners for exercise controls
function setupExerciseEventListeners() {
    // Piece selector buttons
    const pieceButtons = document.querySelectorAll('.piece-btn[data-piece]');
    pieceButtons.forEach(button => {
        button.addEventListener('click', function() {
            const piece = this.getAttribute('data-piece');
            selectPiece(piece);
            
            // Update active state
            pieceButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Show all moves button
    const showAllMovesBtn = document.getElementById('showAllMoves');
    if (showAllMovesBtn) {
        showAllMovesBtn.addEventListener('click', showAllLegalMoves);
    }
    
    // Hide moves button
    const hideAllMovesBtn = document.getElementById('hideAllMoves');
    if (hideAllMovesBtn) {
        hideAllMovesBtn.addEventListener('click', hideAllLegalMoves);
    }
    
    // Next piece button
    const nextPieceBtn = document.getElementById('nextPiece');
    if (nextPieceBtn) {
        nextPieceBtn.addEventListener('click', goToNextPiece);
    }
}

// Select a piece for the exercise
function selectPiece(piece) {
    currentPiece = piece;
    
    // Reset the board
    exerciseGame = new Chess();
    
    // Load the piece's starting position
    const pieceData = pieceInfo[piece];
    if (pieceData) {
        exerciseGame.load(pieceData.startPosition.fen);
        exerciseBoard.position(pieceData.startPosition.fen);
        
        // Update UI with piece info
        updatePieceInfo(pieceData);
        
        // Show the legal moves for the current piece
        showLegalMovesForSquare(pieceData.startPosition.square);
        
        // Update message
        updateExerciseMessage(`Selected ${pieceData.title}. ${pieceData.tasks[0]}`);
        
        // Enable next button if this piece is completed
        const nextButton = document.getElementById('nextPiece');
        if (nextButton) {
            nextButton.disabled = !completedPieces.includes(piece);
        }
    }
}

// Update the piece information display
function updatePieceInfo(pieceData) {
    const pieceInfoElement = document.getElementById('pieceInfo');
    if (!pieceInfoElement) return;
    
    if (!pieceData) {
        pieceInfoElement.innerHTML = `
            <h3>Piece Information</h3>
            <div class="piece-description">
                <p>Select a piece to see how it moves.</p>
            </div>
        `;
        return;
    }
    
    // Check if piece is completed
    const isCompleted = completedPieces.includes(currentPiece);
    const completedClass = isCompleted ? 'piece-complete' : '';
    
    pieceInfoElement.innerHTML = `
        <h3 class="${completedClass}">${pieceData.icon} ${pieceData.title} ${isCompleted ? '✓' : ''}</h3>
        <div class="piece-description">
            <p>${pieceData.description}</p>
        </div>
        <div class="piece-tasks">
            <h4>Practice Tasks:</h4>
            <ul>
                ${pieceData.tasks.map(task => `<li>${task}</li>`).join('')}
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

// Update the task display
function updateExerciseTask(task) {
    const taskElement = document.getElementById('exerciseTask');
    if (taskElement) {
        taskElement.textContent = task;
    }
}

// Update the progress bar
function updateProgressBar() {
    const progressFill = document.getElementById('progressFill');
    const currentStepElement = document.getElementById('currentStep');
    
    if (progressFill && currentStepElement) {
        const progress = (completedPieces.length / 6) * 100;
        progressFill.style.width = `${progress}%`;
        currentStepElement.textContent = completedPieces.length;
    }
}

// Show all legal moves for a piece at a specific square
function showLegalMovesForSquare(square) {
    // Clear any existing highlights
    hideAllLegalMoves();
    
    // Get legal moves for the piece at this square
    const moves = exerciseGame.moves({
        square: square,
        verbose: true
    });
    
    // Mark the source square
    const sourceSquare = document.querySelector(`.square-${square}`);
    if (sourceSquare) {
        sourceSquare.classList.add('highlighted-square');
    }
    
    // Mark all legal move squares
    moves.forEach(move => {
        const targetSquare = document.querySelector(`.square-${move.to}`);
        if (targetSquare) {
            targetSquare.classList.add('legal-move-square');
            
            // Mark capture squares differently
            if (move.captured) {
                targetSquare.classList.add('capture-square');
            }
            
            legalMoveSquares.push(move.to);
        }
    });
}

// Show all legal moves for the current piece
function showAllLegalMoves() {
    if (!currentPiece) return;
    
    const pieceData = pieceInfo[currentPiece];
    if (pieceData) {
        showLegalMovesForSquare(pieceData.startPosition.square);
    }
}

// Hide all legal move highlights
function hideAllLegalMoves() {
    // Remove highlighting from all squares
    document.querySelectorAll('.highlighted-square, .legal-move-square, .capture-square').forEach(square => {
        square.classList.remove('highlighted-square', 'legal-move-square', 'capture-square');
    });
    
    // Clear the array
    legalMoveSquares = [];
}

// Handle moving to the next piece
function goToNextPiece() {
    // Get all piece keys
    const pieceKeys = Object.keys(pieceInfo);
    
    // Find the index of the current piece
    const currentIndex = pieceKeys.indexOf(currentPiece);
    
    // Calculate the next index (or loop back to the beginning)
    const nextIndex = (currentIndex + 1) % pieceKeys.length;
    
    // Select the next piece
    selectPiece(pieceKeys[nextIndex]);
    
    // Update active class on piece buttons
    const pieceButtons = document.querySelectorAll('.piece-btn[data-piece]');
    pieceButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-piece') === pieceKeys[nextIndex]) {
            btn.classList.add('active');
        }
    });
}

// Complete a piece exercise
function completePieceExercise() {
    if (!currentPiece || completedPieces.includes(currentPiece)) return;
    
    // Add to completed pieces
    completedPieces.push(currentPiece);
    
    // Update UI
    updatePieceInfo(pieceInfo[currentPiece]);
    updateProgressBar();
    
    // Enable next button
    const nextButton = document.getElementById('nextPiece');
    if (nextButton) {
        nextButton.disabled = false;
    }
    
    // Show completion message
    const pieceData = pieceInfo[currentPiece];
    updateExerciseMessage(`Great job! You've learned how the ${pieceData.title} moves.`);
    
    // Add completion animation
    showCompletionAnimation();
    
    // Show notification
    if (typeof showNotification === 'function') {
        showNotification(`You've mastered the ${pieceData.title}!`, 'success');
    }
    
    // If all pieces completed, show final message
    if (completedPieces.length === 6) {
        showFinalCompletion();
    }
}

// Show completion animation with anime.js
function showCompletionAnimation() {
    // Animate the piece button
    const pieceButton = document.querySelector(`.piece-btn[data-piece="${currentPiece}"]`);
    if (pieceButton && typeof anime === 'function') {
        anime({
            targets: pieceButton,
            scale: [1, 1.2, 1],
            backgroundColor: [
                {value: '#4169e1', duration: 400},
                {value: '#f8f9fa', duration: 800}
            ],
            duration: 1200,
            easing: 'easeInOutQuad'
        });
        
        // Add a checkmark or visual indicator
        const pieceIcon = pieceButton.querySelector('.piece-icon');
        if (pieceIcon) {
            pieceIcon.classList.add('piece-complete');
        }
    }
}

// Show final completion message
function showFinalCompletion() {
    // Create a completion message element
    const completionMessage = document.createElement('div');
    completionMessage.className = 'completion-message';
    completionMessage.innerHTML = `
        <h3>Congratulations!</h3>
        <p>You've learned how all the chess pieces move. Now you're ready to play chess!</p>
        <button class="btn primary" id="continueButton">Continue to Next Lesson</button>
    `;
    
    // Add to the page
    const exerciseContainer = document.querySelector('.exercise-container');
    if (exerciseContainer) {
        exerciseContainer.appendChild(completionMessage);
    }
    
    // Add event listener for continue button
    const continueButton = document.getElementById('continueButton');
    if (continueButton) {
        continueButton.addEventListener('click', function() {
            window.location.href = '/exercises/board_setup';
        });
    }
    
    // If addAchievement function exists, call it
    if (typeof addAchievement === 'function') {
        addAchievement({
            id: 'piece_movement_mastery',
            title: 'Piece Movement Master',
            description: 'You learned how all the chess pieces move!'
        });
    }
    
    // Create confetti celebration if function exists
    if (typeof createConfetti === 'function') {
        createConfetti();
    }
}

// Callbacks for the chessboard

// Piece drag started
function onDragStart(source, piece, position, orientation) {
    // Only allow dragging the current piece
    if (!currentPiece) return false;
    
    // Highlight all legal moves
    showLegalMovesForSquare(source);
}

// Piece dropped
function onDrop(source, target) {
    // Check if the move is legal
    const move = exerciseGame.move({
        from: source,
        to: target,
        promotion: 'q' // Always promote to queen for simplicity
    });
    
    // If the move is illegal, return the piece to its source square
    if (move === null) return 'snapback';
    
    // Update the exercise task
    updateExerciseTask(`You moved from ${source} to ${target}`);
    
    // Mark the piece as completed if not already
    if (!completedPieces.includes(currentPiece)) {
        completePieceExercise();
    }
}

// After piece snap animation completes
function onSnapEnd() {
    exerciseBoard.position(exerciseGame.fen());
}

// Mouse hover over square
function onMouseoverSquare(square, piece) {
    // Show legal moves for this square if it contains a piece
    if (piece) {
        showLegalMovesForSquare(square);
    }
}

// Mouse leaves square
function onMouseoutSquare(square, piece) {
    // Don't remove highlighting during exercise
} 