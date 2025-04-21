// Main JavaScript file for ChessEdu app

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the application
    initApp();
});

// Global variables
let streakCount = 0;
let userProgress = {
    completedLessons: [],
    achievements: [],
    currentStreak: 0
};

// Initialize application
function initApp() {
    // Load user progress from server
    fetchUserProgress();
    
    // Initialize hero animation
    initHeroAnimation();
    
    // Set up event listeners
    setupEventListeners();
}

// Fetch user progress from server
function fetchUserProgress() {
    fetch('/progress')
        .then(response => response.json())
        .then(data => {
            userProgress = data;
            updateUI();
        })
        .catch(error => {
            console.error('Error fetching user progress:', error);
        });
}

// Update UI based on user progress
function updateUI() {
    // Update streak count
    const streakElement = document.getElementById('streakCount');
    if (streakElement) {
        streakElement.textContent = userProgress.currentStreak;
    }
    
    // Update other UI elements as needed
}

// Set up event listeners
function setupEventListeners() {
    // Add any global event listeners here
    const resetBoardBtn = document.getElementById('resetBoard');
    if (resetBoardBtn) {
        resetBoardBtn.addEventListener('click', function() {
            // Reset the board (handled in chessboard.js)
            if (typeof resetChessboard === 'function') {
                resetChessboard();
            }
        });
    }
    
    const showHintsBtn = document.getElementById('showHints');
    if (showHintsBtn) {
        showHintsBtn.addEventListener('click', function() {
            // Show hints (handled in chessboard.js)
            if (typeof toggleHints === 'function') {
                toggleHints();
            }
        });
    }
}

// Initialize hero animation with Three.js
function initHeroAnimation() {
    const heroAnimation = document.getElementById('hero-animation');
    
    if (!heroAnimation) return;
    
    // Create a scene
    const scene = new THREE.Scene();
    
    // Create a camera
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 5;
    
    // Create a renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(400, 400);
    heroAnimation.appendChild(renderer.domElement);
    
    // Create a chess piece
    const geometry = new THREE.BoxGeometry(1, 2, 1);
    const material = new THREE.MeshNormalMaterial();
    const piece = new THREE.Mesh(geometry, material);
    scene.add(piece);
    
    // Create chess board
    const boardGroup = new THREE.Group();
    scene.add(boardGroup);
    
    // Create chess board squares
    const squareSize = 0.5;
    const boardSize = 8;
    
    for (let x = 0; x < boardSize; x++) {
        for (let z = 0; z < boardSize; z++) {
            const color = (x + z) % 2 === 0 ? 0xCCCCCC : 0x666666;
            const squareGeometry = new THREE.BoxGeometry(squareSize, 0.1, squareSize);
            const squareMaterial = new THREE.MeshBasicMaterial({ color: color });
            const square = new THREE.Mesh(squareGeometry, squareMaterial);
            
            square.position.x = (x - boardSize / 2 + 0.5) * squareSize;
            square.position.z = (z - boardSize / 2 + 0.5) * squareSize;
            square.position.y = -1.1;
            
            boardGroup.add(square);
        }
    }
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);
    
    // Animation
    function animate() {
        requestAnimationFrame(animate);
        
        piece.rotation.y += 0.01;
        boardGroup.rotation.y += 0.002;
        
        renderer.render(scene, camera);
    }
    
    // Start animation
    animate();
    
    // Make it responsive
    window.addEventListener('resize', updateHeroSize);
    
    function updateHeroSize() {
        const heroImage = document.querySelector('.hero-image');
        if (heroImage) {
            const width = heroImage.clientWidth;
            const height = heroImage.clientHeight;
            
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        }
    }
    
    // Initial size update
    setTimeout(updateHeroSize, 100);
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <p>${message}</p>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    // Add to the DOM
    document.body.appendChild(notification);
    
    // Add animation with anime.js
    anime({
        targets: notification,
        translateX: [-300, 0],
        opacity: [0, 1],
        duration: 500,
        easing: 'easeOutExpo'
    });
    
    // Auto-close after 5 seconds
    setTimeout(() => {
        closeNotification(notification);
    }, 5000);
    
    // Add event listener for close button
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        closeNotification(notification);
    });
}

// Close notification with animation
function closeNotification(notification) {
    anime({
        targets: notification,
        translateX: [0, -300],
        opacity: [1, 0],
        duration: 500,
        easing: 'easeInExpo',
        complete: function() {
            notification.remove();
        }
    });
}

// Add achievement and show celebration
function addAchievement(achievement) {
    // Add achievement to user progress
    userProgress.achievements.push(achievement);
    
    // Update UI
    updateUI();
    
    // Show celebration
    showAchievementCelebration(achievement);
}

// Show achievement celebration
function showAchievementCelebration(achievement) {
    // Create modal element
    const modal = document.createElement('div');
    modal.className = 'achievement-modal';
    modal.innerHTML = `
        <div class="achievement-modal-content">
            <div class="achievement-icon">🏆</div>
            <h2>Achievement Unlocked!</h2>
            <h3>${achievement.title}</h3>
            <p>${achievement.description}</p>
            <button class="btn primary">Continue</button>
        </div>
    `;
    
    // Add to the DOM
    document.body.appendChild(modal);
    
    // Create confetti
    createConfetti();
    
    // Add animation with anime.js
    anime({
        targets: modal,
        scale: [0.9, 1],
        opacity: [0, 1],
        duration: 800,
        easing: 'easeOutElastic(1, .5)'
    });
    
    // Add event listener for close button
    const closeBtn = modal.querySelector('.btn');
    closeBtn.addEventListener('click', () => {
        anime({
            targets: modal,
            scale: [1, 0.9],
            opacity: [1, 0],
            duration: 300,
            easing: 'easeInOutQuad',
            complete: function() {
                modal.remove();
            }
        });
    });
}

// Create confetti celebration
function createConfetti() {
    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'confetti-container';
    document.body.appendChild(confettiContainer);
    
    // Create confetti pieces
    const colors = ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590'];
    
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
        confetti.style.opacity = Math.random();
        confetti.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
        
        confettiContainer.appendChild(confetti);
    }
    
    // Remove confetti after animation
    setTimeout(() => {
        confettiContainer.remove();
    }, 5000);
}

// Export functions for use in other modules
window.showNotification = showNotification;
window.addAchievement = addAchievement; 