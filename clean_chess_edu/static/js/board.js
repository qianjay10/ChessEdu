// Board.js - Handles the interactive chessboard on the board.html page
// Integrates with animations.js for visual effects

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initBoard();
});

// Global variables
let board = null;
let game = null;
let selectedPiece = null;
let moveHistory = [];
let boardFlipped = false;

// Initialize the chess board
function initBoard() {
    // Initialize Chess.js instance
    game = new Chess();
    
    // Configuration for the chessboard
    const config = {
        position: 'start',
        draggable: true,
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        pieceTheme: '../static/images/pieces/{piece}.png'
    };
    
    // Initialize the board
    board = Chessboard('board', config);
    
    // Set up event listeners
    setupEventListeners();
    
    // Initial board update
    updateBoardInfo();
}

// Set up event listeners for board controls
function setupEventListeners() {
    // Start position button
    const startPositionBtn = document.getElementById('startPosition');
    if (startPositionBtn) {
        startPositionBtn.addEventListener('click', () => {
            game.reset();
            board.position('start');
            updateBoardInfo();
            clearHighlights();
            
            // Show notification using our animation functions
            chessAnimations.showNotification('Board reset to starting position', 'info');
        });
    }
    
    // Clear board button
    const clearBoardBtn = document.getElementById('clearBoard');
    if (clearBoardBtn) {
        clearBoardBtn.addEventListener('click', () => {
            game.clear();
            board.position('8/8/8/8/8/8/8/8');
            updateBoardInfo();
            clearHighlights();
            
            // Show notification
            chessAnimations.showNotification('Board cleared', 'info');
        });
    }
    
    // Flip board button
    const flipBoardBtn = document.getElementById('flipBoard');
    if (flipBoardBtn) {
        flipBoardBtn.addEventListener('click', () => {
            board.flip();
            boardFlipped = !boardFlipped;
            
            // Add flipped class to container for CSS reference
            const boardContainer = document.querySelector('.board-container');
            if (boardContainer) {
                boardContainer.classList.toggle('flipped');
            }
            
            // Show notification
            chessAnimations.showNotification(
                boardFlipped ? 'Board flipped: Black\'s perspective' : 'Board flipped: White\'s perspective', 
                'info'
            );
        });
    }
    
    // Show hint button
    const showHintBtn = document.getElementById('showHint');
    if (showHintBtn) {
        showHintBtn.addEventListener('click', () => {
            showHint();
        });
    }
    
    // Piece selection buttons
    const pieceBtns = document.querySelectorAll('.piece-btn');
    pieceBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectPiece(btn.getAttribute('data-piece'));
        });
    });
}

// Handle drag start
function onDragStart(source, piece) {
    // Don't allow dragging opponent's pieces during a game
    if (game.turn() === 'w' && piece.search(/^b/) !== -1) return false;
    if (game.turn() === 'b' && piece.search(/^w/) !== -1) return false;
    
    // Highlight the source square
    highlightSquare(source, 'selected');
}

// Handle piece drop
function onDrop(source, target) {
    // Remove highlights
    clearHighlights();
    
    // Check if the move is legal
    const moveObj = {
        from: source,
        to: target,
        promotion: 'q' // Always promote to queen for simplicity
    };
    
    const move = game.move(moveObj);
    
    // If illegal move, return piece to source square
    if (move === null) return 'snapback';
    
    // If move is legal, update the board info
    updateBoardInfo();
    
    // Highlight the move squares
    highlightSquare(source, 'last-move');
    highlightSquare(target, 'last-move');
    
    // Check if it's a capture move
    if (move.captured) {
        // Use the animation for piece capture
        const capturedPieceId = `${target}-piece`;
        // Note: The actual animation would happen in onSnapEnd,
        // here we're just preparing for it
    }
    
    // Check for check or checkmate
    if (game.in_check()) {
        const kingSquare = findKingSquare(game.turn());
        if (kingSquare) {
            highlightSquare(kingSquare, 'check');
            
            if (game.in_checkmate()) {
                // Show checkmate celebration
                const winner = game.turn() === 'w' ? 'Black' : 'White';
                setTimeout(() => {
                    chessAnimations.showCelebration(`${winner} wins by checkmate!`);
                }, 500);
            } else {
                // Show check notification
                chessAnimations.showNotification(
                    `${game.turn() === 'w' ? 'White' : 'Black'} is in check!`,
                    'info'
                );
            }
        }
    }
    
    return true;
}

// After the piece snap animation completes, update the board
function onSnapEnd() {
    board.position(game.fen());
}

// Find the square of the king for a given color
function findKingSquare(color) {
    const fen = game.fen().split(' ')[0];
    const rows = fen.split('/');
    const king = color === 'w' ? 'K' : 'k';
    
    for (let row = 0; row < 8; row++) {
        let col = 0;
        for (let i = 0; i < rows[row].length; i++) {
            const char = rows[row][i];
            if (!isNaN(char)) {
                col += parseInt(char);
            } else if (char === king) {
                const file = String.fromCharCode(97 + col); // 'a' through 'h'
                const rank = 8 - row;
                return file + rank;
            } else {
                col++;
            }
        }
    }
    
    return null;
}

// Update the board information display
function updateBoardInfo() {
    // Update turn indicator
    const turnIndicator = document.getElementById('turn-indicator');
    if (turnIndicator) {
        turnIndicator.textContent = `${game.turn() === 'w' ? 'White' : 'Black'} to move`;
    }
    
    // Update position notation
    const positionEl = document.getElementById('position');
    if (positionEl) {
        positionEl.textContent = game.fen();
    }
    
    // Update move history
    updateMoveHistory();
}

// Update the move history display
function updateMoveHistory() {
    const historyEl = document.getElementById('moveHistory');
    if (!historyEl) return;
    
    const moves = game.history({ verbose: true });
    
    if (moves.length === 0) {
        historyEl.innerHTML = '<p class="empty-message">No moves yet</p>';
        return;
    }
    
    let html = '';
    for (let i = 0; i < moves.length; i++) {
        const moveNumber = Math.floor(i / 2) + 1;
        
        // Add move number at the start of white's move
        if (i % 2 === 0) {
            html += `<div class="move-pair">`;
            html += `<span class="move-number">${moveNumber}.</span>`;
        }
        
        // Format the move in algebraic notation
        let moveText = formatMove(moves[i]);
        
        // Add appropriate class based on whose move it is
        const moveClass = i % 2 === 0 ? 'white-move' : 'black-move';
        html += `<span class="move ${moveClass}">${moveText}</span>`;
        
        // Close the div after black's move
        if (i % 2 === 1 || i === moves.length - 1) {
            html += `</div>`;
        }
    }
    
    historyEl.innerHTML = html;
    
    // Scroll to the bottom of the move history
    historyEl.scrollTop = historyEl.scrollHeight;
}

// Format a move for display
function formatMove(move) {
    let text = '';
    
    // Add piece letter (except for pawns)
    if (move.piece !== 'p') {
        text += move.piece.toUpperCase();
    }
    
    // For captures
    if (move.captured) {
        // For pawns, show the file they moved from
        if (move.piece === 'p') {
            text += move.from.charAt(0);
        }
        text += 'x';
    }
    
    // Add the destination square
    text += move.to;
    
    // Add additional symbols
    if (move.flags.includes('k') || move.flags.includes('q')) {
        text += '0-0'; // Kingside castling
        if (move.flags.includes('q')) text += '-0'; // Queenside castling
    } else if (move.flags.includes('e')) {
        text += ' e.p.'; // En passant
    } else if (move.flags.includes('p')) {
        text += '=' + move.promotion.toUpperCase(); // Promotion
    }
    
    // Check or checkmate
    if (move.san.includes('+')) text += '+';
    if (move.san.includes('#')) text += '#';
    
    return text;
}

// Select a piece for placement
function selectPiece(pieceCode) {
    selectedPiece = pieceCode;
    
    // Highlight the selected piece button
    const buttons = document.querySelectorAll('.piece-btn');
    buttons.forEach(btn => {
        btn.classList.remove('selected');
        if (btn.getAttribute('data-piece') === pieceCode) {
            btn.classList.add('selected');
        }
    });
    
    // Add click handlers to the board squares for piece placement
    const squares = document.querySelectorAll('.square-55d63');
    squares.forEach(square => {
        // Remove existing click handlers
        square.removeEventListener('click', handleSquareClick);
        
        // Add new click handler
        square.addEventListener('click', handleSquareClick);
    });
    
    // Show notification
    const pieceNames = {
        'wP': 'White Pawn',
        'wR': 'White Rook',
        'wN': 'White Knight',
        'wB': 'White Bishop',
        'wQ': 'White Queen',
        'wK': 'White King',
        'bP': 'Black Pawn',
        'bR': 'Black Rook',
        'bN': 'Black Knight',
        'bB': 'Black Bishop',
        'bQ': 'Black Queen',
        'bK': 'Black King'
    };
    
    chessAnimations.showNotification(`Selected: ${pieceNames[pieceCode]}`, 'info');
}

// Handle square click for piece placement
function handleSquareClick(event) {
    if (!selectedPiece) return;
    
    // Get the square from the class
    const square = event.target.closest('.square-55d63');
    if (!square) return;
    
    const squareId = square.getAttribute('data-square');
    if (!squareId) return;
    
    // Get current position
    const position = board.position();
    
    // Place the piece
    position[squareId] = selectedPiece;
    
    // Update the board
    board.position(position, false);
    
    // Update the game state
    updateGameFromBoard();
    
    // Update board info
    updateBoardInfo();
}

// Update the game state from the current board position
function updateGameFromBoard() {
    // Get the current position in FEN
    const fen = board.fen();
    
    // Load the position into the game
    game.load(fen + ' w - - 0 1'); // Add default values for the missing FEN components
}

// Highlight a square on the board
function highlightSquare(square, type = 'selected') {
    // Use our animation library to highlight squares
    chessAnimations.highlightSquare(square, type);
}

// Clear all highlights
function clearHighlights() {
    // Get all squares
    const squares = document.querySelectorAll('.square-55d63');
    
    // Remove all highlights
    squares.forEach(square => {
        const squareId = square.getAttribute('data-square');
        if (squareId) {
            chessAnimations.removeHighlight(squareId);
        }
    });
}

// Show a hint based on the current position
function showHint() {
    const hintElement = document.getElementById('hint');
    if (!hintElement) return;
    
    let hintText = '';
    
    // If it's a starting position
    if (game.fen() === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
        hintText = 'Opening tip: Try controlling the center with e4 or d4.';
    } 
    // If the board is empty
    else if (game.fen().split(' ')[0] === '8/8/8/8/8/8/8/8') {
        hintText = 'Try setting up a specific position to practice.';
    }
    // If it's white's turn
    else if (game.turn() === 'w') {
        // Check if white has any pieces in danger
        hintText = 'Look for any pieces under attack and consider developing your pieces.';
    }
    // If it's black's turn
    else {
        hintText = 'Respond to White\'s move and watch for attacking opportunities.';
    }
    
    // Display the hint with animation
    hintElement.textContent = hintText;
    
    // Animate the hint
    anime({
        targets: hintElement,
        opacity: [0, 1],
        translateY: [10, 0],
        easing: 'easeOutQuad',
        duration: 500
    });
} 