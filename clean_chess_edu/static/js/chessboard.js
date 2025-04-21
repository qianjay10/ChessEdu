// Chessboard functionality for the interactive practice board

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the chessboard if it exists on the page
    const chessboardElement = document.getElementById('chessboard');
    if (chessboardElement) {
        initChessboard();
    }
});

// Global variables
let board = null;
let game = null;
let hintsVisible = false;
let highlightedSquares = [];

// Initialize the chessboard
function initChessboard() {
    // Initialize the Chess.js game
    game = new Chess();
    
    // Configuration for the chessboard
    const config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        onMouseoverSquare: onMouseoverSquare,
        onMouseoutSquare: onMouseoutSquare
    };
    
    // Create the chessboard
    board = Chessboard('chessboard', config);
    
    // Make it responsive
    window.addEventListener('resize', board.resize);
    
    // Set up event listeners
    setupBoardEventListeners();
}

// Set up event listeners for board controls
function setupBoardEventListeners() {
    // Reset board button
    const resetBoardBtn = document.getElementById('resetBoard');
    if (resetBoardBtn) {
        resetBoardBtn.addEventListener('click', resetChessboard);
    }
    
    // Show hints button
    const showHintsBtn = document.getElementById('showHints');
    if (showHintsBtn) {
        showHintsBtn.addEventListener('click', toggleHints);
    }
}

// Chess.js callback for when a piece drag is started
function onDragStart(source, piece, position, orientation) {
    // Don't allow moves if the game is over
    if (game.game_over()) return false;
    
    // Only allow the current player to move their pieces
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
    
    // Highlight the selected square
    highlightSquare(source);
}

// Chess.js callback for when a piece is dropped
function onDrop(source, target) {
    // Remove highlights
    removeHighlights();
    
    // Check if the move is legal
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // Always promote to queen for simplicity
    });
    
    // If the move is illegal, return the piece to its source square
    if (move === null) return 'snapback';
    
    // Update the board position after the piece snap
    updateStatus();
}

// Chess.js callback for after a piece snap animation completes
function onSnapEnd() {
    board.position(game.fen());
}

// Chess.js callback for when the mouse hovers over a square
function onMouseoverSquare(square, piece) {
    // Return if hints are not enabled
    if (!hintsVisible) return;
    
    // Get list of possible moves for this square
    const moves = game.moves({
        square: square,
        verbose: true
    });
    
    // Return if there are no moves available
    if (moves.length === 0) return;
    
    // Highlight the square being moused over
    highlightSquare(square);
    
    // Highlight the possible moves
    for (let i = 0; i < moves.length; i++) {
        highlightSquare(moves[i].to);
    }
}

// Chess.js callback for when the mouse leaves a square
function onMouseoutSquare(square, piece) {
    // Remove highlights if hints are not visible
    if (!hintsVisible) {
        removeHighlights();
    }
}

// Highlight a square
function highlightSquare(square) {
    // Add the highlight class to the square
    const squareElement = document.querySelector(`.square-${square}`);
    if (squareElement) {
        squareElement.classList.add('highlighted-square');
        highlightedSquares.push(square);
    }
}

// Remove all highlights
function removeHighlights() {
    // Remove the highlight class from all squares
    highlightedSquares.forEach(square => {
        const squareElement = document.querySelector(`.square-${square}`);
        if (squareElement) {
            squareElement.classList.remove('highlighted-square');
        }
    });
    
    // Clear the array
    highlightedSquares = [];
}

// Update the game status
function updateStatus() {
    let status = '';
    let moveHistory = '';
    
    // Get status text based on game state
    if (game.in_checkmate()) {
        status = 'Game over, ' + (game.turn() === 'w' ? 'black' : 'white') + ' wins by checkmate!';
    } else if (game.in_draw()) {
        status = 'Game over, drawn position';
    } else {
        status = (game.turn() === 'w' ? 'White' : 'Black') + ' to move';
        
        // Check?
        if (game.in_check()) {
            status += ', ' + (game.turn() === 'w' ? 'white' : 'black') + ' is in check';
        }
    }
    
    // Update the status element
    const statusElement = document.getElementById('turn-indicator');
    if (statusElement) {
        statusElement.textContent = status;
    }
    
    // Update move history
    const history = game.history({ verbose: true });
    if (history.length > 0) {
        moveHistory = formatMoveHistory(history);
    } else {
        moveHistory = '<p class="empty-message">No moves yet</p>';
    }
    
    // Update the move history element
    const moveHistoryElement = document.getElementById('moveHistory');
    if (moveHistoryElement) {
        moveHistoryElement.innerHTML = moveHistory;
    }
    
    // Update FEN position display
    const positionElement = document.getElementById('position');
    if (positionElement) {
        positionElement.textContent = game.fen();
    }
}

// Format the move history for display
function formatMoveHistory(history) {
    let html = '<div class="move-list">';
    
    for (let i = 0; i < history.length; i += 2) {
        const moveNumber = Math.floor(i / 2) + 1;
        const whiteMove = history[i];
        const blackMove = history[i + 1];
        
        html += `<div class="move-pair">`;
        html += `<span class="move-number">${moveNumber}.</span>`;
        html += `<span class="move white-move">${formatMove(whiteMove)}</span>`;
        
        if (blackMove) {
            html += `<span class="move black-move">${formatMove(blackMove)}</span>`;
        }
        
        html += `</div>`;
    }
    
    html += '</div>';
    return html;
}

// Format a single move for display
function formatMove(move) {
    let moveText = '';
    
    // Add piece symbol
    const pieceSymbols = {
        'p': '',
        'n': 'N',
        'b': 'B',
        'r': 'R',
        'q': 'Q',
        'k': 'K'
    };
    
    // Format the move
    if (move.piece !== 'p') {
        moveText += pieceSymbols[move.piece];
    }
    
    // Add capture symbol
    if (move.captured) {
        if (move.piece === 'p') {
            moveText += move.from.charAt(0);
        }
        moveText += 'x';
    }
    
    // Add destination square
    moveText += move.to;
    
    // Add promotion piece
    if (move.promotion) {
        moveText += '=' + pieceSymbols[move.promotion].toUpperCase();
    }
    
    // Add check/checkmate symbol
    if (move.san.includes('+')) {
        moveText += '+';
    } else if (move.san.includes('#')) {
        moveText += '#';
    }
    
    return moveText;
}

// Reset the chessboard
function resetChessboard() {
    game = new Chess();
    board.position('start');
    removeHighlights();
    updateStatus();
}

// Toggle move hints
function toggleHints() {
    hintsVisible = !hintsVisible;
    
    const showHintsBtn = document.getElementById('showHints');
    if (showHintsBtn) {
        if (hintsVisible) {
            showHintsBtn.textContent = 'Hide Hints';
            showHintsBtn.classList.add('active');
        } else {
            showHintsBtn.textContent = 'Show Hints';
            showHintsBtn.classList.remove('active');
            removeHighlights();
        }
    }
}

// Get a hint for the current position
function getPositionHint() {
    // This is a simple implementation - in a real app, you'd use a chess engine
    const hints = {
        'start': 'Try controlling the center with a pawn move like e4 or d4.',
        'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1': 'Black often responds with e5 to fight for the center, or c5 (Sicilian Defense).',
        'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2': 'Developing the knight to f3 protects the e-pawn and prepares for castling.'
    };
    
    const fen = game.fen();
    const hint = hints[fen] || 'Focus on developing your pieces toward the center and castling for king safety.';
    
    const hintElement = document.getElementById('hint');
    if (hintElement) {
        hintElement.textContent = hint;
    }
}

// Export functions for use in other modules
window.resetChessboard = resetChessboard;
window.toggleHints = toggleHints; 