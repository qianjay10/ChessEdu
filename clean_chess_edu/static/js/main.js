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
    current_streak: 0
};

// Try to load progress from localStorage
try {
    const savedProgress = localStorage.getItem('chessEduProgress');
    if (savedProgress) {
        userProgress = JSON.parse(savedProgress);
    } else {
        // Fetch progress from server if available
        fetch('/progress')
            .then(response => response.json())
            .then(data => {
                userProgress = data;
                // Also save to localStorage
                localStorage.setItem('chessEduProgress', JSON.stringify(userProgress));
            })
            .catch(error => {
                console.error('Error fetching progress:', error);
            });
    }
} catch (e) {
    console.error('Error loading progress:', e);
}

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
        streakElement.textContent = userProgress.current_streak;
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
    
    // Create a chess king piece
    const kingGroup = new THREE.Group();
    scene.add(kingGroup);
    
    // Material with slight roughness to mimic chess piece texture
    const blackMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x222222, 
        roughness: 0.7,
        metalness: 0.2
    });
    
    // Create the wide base of the king
    const baseGeometry = new THREE.CylinderGeometry(0.7, 0.85, 0.2, 32);
    const base = new THREE.Mesh(baseGeometry, blackMaterial);
    base.position.y = -0.9;
    kingGroup.add(base);
    
    // Create the bottom rim
    const bottomRimGeometry = new THREE.CylinderGeometry(0.75, 0.75, 0.08, 32);
    const bottomRim = new THREE.Mesh(bottomRimGeometry, blackMaterial);
    bottomRim.position.y = -0.76;
    kingGroup.add(bottomRim);
    
    // Create the stem between base and main body
    const stemGeometry = new THREE.CylinderGeometry(0.45, 0.7, 0.25, 32);
    const stem = new THREE.Mesh(stemGeometry, blackMaterial);
    stem.position.y = -0.6;
    kingGroup.add(stem);
    
    // Create the main body of the king (tapered cylinder)
    const mainBodyGeometry = new THREE.CylinderGeometry(0.48, 0.45, 0.9, 32);
    const mainBody = new THREE.Mesh(mainBodyGeometry, blackMaterial);
    mainBody.position.y = 0.0;
    kingGroup.add(mainBody);
    
    // Add a bulge in the middle (separate mesh)
    const bulgeGeometry = new THREE.SphereGeometry(0.62, 32, 32);
    const bulge = new THREE.Mesh(bulgeGeometry, blackMaterial);
    // Position to create the bulging middle section
    bulge.position.y = 0.0; 
    bulge.scale.set(1, 0.55, 1); // Flatten the sphere to create bulge
    kingGroup.add(bulge);
    
    // Create the neck collar
    const collarGeometry = new THREE.CylinderGeometry(0.54, 0.48, 0.15, 32);
    const collar = new THREE.Mesh(collarGeometry, blackMaterial);
    collar.position.y = 0.52;
    kingGroup.add(collar);
    
    // Create the crown base
    const crownBaseGeometry = new THREE.CylinderGeometry(0.45, 0.54, 0.18, 32);
    const crownBase = new THREE.Mesh(crownBaseGeometry, blackMaterial);
    crownBase.position.y = 0.68;
    kingGroup.add(crownBase);
    
    // Create the cross base (rounded top)
    const crossBaseGeometry = new THREE.SphereGeometry(0.25, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    const crossBase = new THREE.Mesh(crossBaseGeometry, blackMaterial);
    crossBase.position.y = 0.8;
    kingGroup.add(crossBase);
    
    // Create the cross on top (thicker)
    const crossVerticalGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 16);
    const crossVertical = new THREE.Mesh(crossVerticalGeometry, blackMaterial);
    crossVertical.position.y = 1.05;
    kingGroup.add(crossVertical);
    
    const crossHorizontalGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.28, 16);
    const crossHorizontal = new THREE.Mesh(crossHorizontalGeometry, blackMaterial);
    crossHorizontal.rotation.z = Math.PI / 2;
    crossHorizontal.position.y = 1.05;
    kingGroup.add(crossHorizontal);
    
    // Add a sphere at the cross intersection for better appearance
    const sphereGeometry = new THREE.SphereGeometry(0.14, 24, 24);
    const sphere = new THREE.Mesh(sphereGeometry, blackMaterial);
    sphere.position.y = 1.05;
    kingGroup.add(sphere);
    
    // Position the king at the center of the board and scale appropriately
    kingGroup.position.y = 0.2;
    kingGroup.scale.set(1, 1, 1);
    
    // Add subtle rotation for a more natural pose
    kingGroup.rotation.x = 0.05;
    
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 2, 1);
    scene.add(directionalLight);
    
    // Add a secondary light from a different angle
    const secondaryLight = new THREE.DirectionalLight(0xffffff, 0.3);
    secondaryLight.position.set(-1, 1, -2);
    scene.add(secondaryLight);
    
    // Add subtle rim light to outline the king
    const rimLight = new THREE.DirectionalLight(0x9090ff, 0.2);
    rimLight.position.set(0, 0, -2);
    scene.add(rimLight);
    
    // Animation
    function animate() {
        requestAnimationFrame(animate);
        
        kingGroup.rotation.y += 0.01;
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