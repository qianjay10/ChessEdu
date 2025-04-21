// ChessEdu animations.js
// Handles all chess piece animations and visual effects using anime.js

class ChessAnimations {
    constructor() {
        // Store any running animations for potential cancellation
        this.currentAnimations = {};
    }

    /**
     * Animate a chess piece moving from one square to another
     * @param {string} pieceId - The ID of the HTML element representing the chess piece
     * @param {Object} fromSquare - Starting square coordinates {file: 'a'-'h', rank: 1-8}
     * @param {Object} toSquare - Target square coordinates {file: 'a'-'h', rank: 1-8}
     * @param {number} duration - Animation duration in milliseconds
     * @param {function} onComplete - Callback function to execute when animation completes
     */
    movePiece(pieceId, fromSquare, toSquare, duration = 600, onComplete = null) {
        const piece = document.getElementById(pieceId);
        if (!piece) return;

        // Cancel any existing animation on this piece
        if (this.currentAnimations[pieceId]) {
            this.currentAnimations[pieceId].pause();
        }

        // Calculate target position based on board orientation
        // This assumes chessboard.js convention where a8 is in the top-left when not flipped
        const boardElement = document.querySelector('.board-container');
        const isFlipped = boardElement && boardElement.classList.contains('flipped');
        
        // Create animation
        this.currentAnimations[pieceId] = anime({
            targets: piece,
            translateX: this.calculateSquarePosition(toSquare.file, fromSquare.file, isFlipped),
            translateY: this.calculateSquarePosition(toSquare.rank, fromSquare.rank, isFlipped),
            easing: 'easeOutQuad',
            duration: duration,
            complete: function() {
                // Reset transform after animation as the piece will be moved in the DOM
                piece.style.transform = '';
                if (onComplete) onComplete();
            }
        });
    }

    /**
     * Calculate the pixel translation needed to move between squares
     * @param {string|number} targetPos - Target position (file letter or rank number)
     * @param {string|number} startPos - Starting position (file letter or rank number)
     * @param {boolean} isFlipped - Whether the board is flipped
     * @returns {string} CSS translation value
     */
    calculateSquarePosition(targetPos, startPos, isFlipped) {
        let diff;
        
        // Handle file (letter) calculations
        if (typeof targetPos === 'string' && typeof startPos === 'string') {
            diff = targetPos.charCodeAt(0) - startPos.charCodeAt(0);
            if (isFlipped) diff = -diff;
            return `${diff * 12.5}%`; // Each square is 12.5% of board width
        }
        
        // Handle rank (number) calculations
        else if (typeof targetPos === 'number' && typeof startPos === 'number') {
            diff = targetPos - startPos;
            if (!isFlipped) diff = -diff;
            return `${diff * 12.5}%`; // Each square is 12.5% of board height
        }
        
        return '0';
    }

    /**
     * Highlight a square on the board
     * @param {string} squareId - The ID of the square element
     * @param {string} highlightType - Type of highlight ('selected', 'possible-move', 'check', etc.)
     */
    highlightSquare(squareId, highlightType = 'selected') {
        const square = document.querySelector(`[data-square="${squareId}"]`);
        if (!square) return;

        // Add highlight class
        square.classList.add(highlightType);
        
        // Add subtle animation
        anime({
            targets: square,
            backgroundColor: [
                { value: this.getHighlightColor(highlightType, 0.7), duration: 200 },
                { value: this.getHighlightColor(highlightType, 0.5), duration: 400 }
            ],
            easing: 'easeInOutQuad',
            loop: 1
        });
    }

    /**
     * Get highlight color based on type
     * @param {string} type - The highlight type
     * @param {number} opacity - Opacity level (0-1)
     * @returns {string} - RGBA color string
     */
    getHighlightColor(type, opacity = 0.5) {
        const colors = {
            'selected': `rgba(0, 128, 255, ${opacity})`,
            'possible-move': `rgba(100, 255, 100, ${opacity})`,
            'check': `rgba(255, 50, 50, ${opacity})`,
            'last-move': `rgba(255, 215, 0, ${opacity})`
        };
        return colors[type] || colors['selected'];
    }

    /**
     * Remove highlight from a square
     * @param {string} squareId - The ID of the square element
     * @param {string} highlightType - Type of highlight to remove (or 'all' for all highlights)
     */
    removeHighlight(squareId, highlightType = 'all') {
        const square = document.querySelector(`[data-square="${squareId}"]`);
        if (!square) return;

        if (highlightType === 'all') {
            // Remove all highlight classes
            square.classList.remove('selected', 'possible-move', 'check', 'last-move');
            anime({
                targets: square,
                backgroundColor: '',
                duration: 300,
                easing: 'easeOutQuad'
            });
        } else {
            // Remove specific highlight class
            square.classList.remove(highlightType);
        }
    }

    /**
     * Animate capture of a piece
     * @param {string} pieceId - The ID of the captured piece
     * @param {function} onComplete - Callback function
     */
    capturePiece(pieceId, onComplete = null) {
        const piece = document.getElementById(pieceId);
        if (!piece) return;

        anime({
            targets: piece,
            scale: [1, 0.5],
            opacity: [1, 0],
            rotate: {
                value: '+=45deg',
                easing: 'easeInOutSine'
            },
            duration: 400,
            easing: 'easeOutQuad',
            complete: function() {
                if (onComplete) onComplete();
            }
        });
    }

    /**
     * Create a notification that animates into view
     * @param {string} message - The notification message
     * @param {string} type - Notification type (success, error, info)
     * @param {number} duration - How long to show notification (ms)
     */
    showNotification(message, type = 'info', duration = 3000) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `chess-notification ${type}`;
        notification.innerHTML = `<p>${message}</p>`;
        
        // Add to DOM
        document.body.appendChild(notification);
        
        // Animate in
        anime({
            targets: notification,
            translateY: [50, 0],
            opacity: [0, 1],
            duration: 500,
            easing: 'easeOutExpo',
            complete: () => {
                // Automatically dismiss after duration
                setTimeout(() => {
                    anime({
                        targets: notification,
                        translateY: [0, -50],
                        opacity: [1, 0],
                        duration: 500,
                        easing: 'easeInExpo',
                        complete: () => {
                            notification.remove();
                        }
                    });
                }, duration);
            }
        });
    }
    
    /**
     * Create celebration animation for achievements or winning
     * @param {string} message - Celebration message
     */
    showCelebration(message) {
        // Create confetti elements
        const confettiCount = 100;
        const confettiContainer = document.createElement('div');
        confettiContainer.className = 'confetti-container';
        document.body.appendChild(confettiContainer);
        
        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = 'celebration-message';
        messageElement.textContent = message;
        document.body.appendChild(messageElement);
        
        // Generate confetti pieces
        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.backgroundColor = this.getRandomColor();
            confettiContainer.appendChild(confetti);
            
            anime({
                targets: confetti,
                left: anime.random(0, 100) + 'vw',
                top: anime.random(-20, -5) + 'vh',
                translateY: [
                    { value: anime.random(100, 120) + 'vh', duration: anime.random(1000, 3000) }
                ],
                rotate: anime.random(0, 360) + 'deg',
                delay: anime.random(0, 1000),
                loop: false,
                easing: 'easeInOutQuad'
            });
        }
        
        // Animate message
        anime({
            targets: messageElement,
            scale: [0.5, 1],
            opacity: [0, 1],
            duration: 800,
            easing: 'easeOutElastic(1, .5)'
        });
        
        // Clean up after animation
        setTimeout(() => {
            anime({
                targets: messageElement,
                scale: [1, 1.1],
                opacity: [1, 0],
                duration: 800,
                easing: 'easeInExpo',
                complete: () => {
                    confettiContainer.remove();
                    messageElement.remove();
                }
            });
        }, 5000);
    }
    
    /**
     * Generate a random color for confetti
     * @returns {string} Random color in hex format
     */
    getRandomColor() {
        const colors = [
            '#ffd700', // Gold
            '#ff4500', // Orange-Red
            '#7fffd4', // Aquamarine
            '#ff69b4', // Hot Pink
            '#1e90ff', // Dodger Blue
            '#00ff7f', // Spring Green
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}

// Export the ChessAnimations class for use in other files
// Use as a singleton for consistent animation control
const chessAnimations = new ChessAnimations(); 