// Achievements JavaScript for handling user achievements

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Load achievements if on the right page
    const achievementsContainer = document.getElementById('achievementsContainer');
    if (achievementsContainer) {
        loadAchievements();
    }
});

// All possible achievements
const achievementsList = [
    {
        id: 'first_lesson',
        title: 'First Step',
        description: 'Completed your first chess lesson!',
        icon: '🏆'
    },
    {
        id: 'piece_movement_mastery',
        title: 'Piece Movement Master',
        description: 'You learned how all the chess pieces move!',
        icon: '♘'
    },
    {
        id: 'board_setup',
        title: 'Ready to Play',
        description: 'You can now set up a chess board correctly!',
        icon: '♜'
    },
    {
        id: 'center_control',
        title: 'Center Commander',
        description: 'You understand the importance of controlling the center!',
        icon: '♙'
    },
    {
        id: 'three_day_streak',
        title: 'Consistent Learner',
        description: 'You\'ve maintained a 3-day learning streak!',
        icon: '🔥'
    },
    {
        id: 'opening_principles',
        title: 'Opening Expert',
        description: 'You\'ve mastered the basic opening principles!',
        icon: '♖'
    },
    {
        id: 'first_fork',
        title: 'Fork Master',
        description: 'You successfully executed your first fork!',
        icon: '🍴'
    },
    {
        id: 'first_pin',
        title: 'Pin Point',
        description: 'You successfully executed your first pin!',
        icon: '📌'
    },
    {
        id: 'all_lessons',
        title: 'Chess Fundamentals Graduate',
        description: 'You\'ve completed all the fundamental chess lessons!',
        icon: '🎓'
    }
];

// Load achievements from the server
function loadAchievements() {
    const achievementsContainer = document.getElementById('achievementsContainer');
    
    // Show loading state
    achievementsContainer.innerHTML = '<div class="loading">Loading achievements...</div>';
    
    // Fetch user progress from the server
    fetch('/progress')
        .then(response => response.json())
        .then(progress => {
            displayAchievements(progress.achievements);
        })
        .catch(error => {
            console.error('Error fetching achievements:', error);
            achievementsContainer.innerHTML = '<div class="error">Failed to load achievements. Please try again later.</div>';
        });
}

// Display achievements in the UI
function displayAchievements(userAchievements) {
    const achievementsContainer = document.getElementById('achievementsContainer');
    
    // Clear loading state
    achievementsContainer.innerHTML = '';
    
    // Check if there are any achievements
    if (!userAchievements || userAchievements.length === 0) {
        achievementsContainer.innerHTML = '<div class="no-achievements">Complete lessons to earn achievements!</div>';
        
        // Add a few locked achievements as previews
        const previewAchievements = achievementsList.slice(0, 3);
        previewAchievements.forEach(achievement => {
            const achievementCard = createAchievementCard(achievement, true);
            achievementsContainer.appendChild(achievementCard);
        });
        
        return;
    }
    
    // Get user achievements
    const earnedAchievements = userAchievements.map(a => a.id);
    
    // Sort: earned achievements first, then locked ones
    const sortedAchievements = [
        ...achievementsList.filter(a => earnedAchievements.includes(a.id)),
        ...achievementsList.filter(a => !earnedAchievements.includes(a.id))
    ];
    
    // Generate HTML for each achievement
    sortedAchievements.forEach(achievement => {
        const isLocked = !earnedAchievements.includes(achievement.id);
        const achievementCard = createAchievementCard(achievement, isLocked);
        achievementsContainer.appendChild(achievementCard);
        
        // Add animations with anime.js
        animateAchievementCard(achievementCard, isLocked);
    });
}

// Create an achievement card element
function createAchievementCard(achievement, isLocked) {
    // Create the achievement card element
    const achievementCard = document.createElement('div');
    achievementCard.className = `achievement-card ${isLocked ? 'achievement-locked' : ''}`;
    achievementCard.dataset.achievementId = achievement.id;
    
    // Create the card content
    achievementCard.innerHTML = `
        <div class="achievement-icon">
            ${achievement.icon}
        </div>
        <div class="achievement-content">
            <h3>${isLocked ? '???' : achievement.title}</h3>
            <p>${isLocked ? 'Keep practicing to unlock this achievement!' : achievement.description}</p>
        </div>
    `;
    
    return achievementCard;
}

// Animate an achievement card with anime.js
function animateAchievementCard(achievementCard, isLocked) {
    if (typeof anime === 'function') {
        // Different animations for locked vs unlocked achievements
        if (isLocked) {
            anime({
                targets: achievementCard,
                opacity: [0, 0.6],
                translateY: [20, 0],
                duration: 600,
                easing: 'easeOutCubic',
                delay: 300
            });
        } else {
            anime({
                targets: achievementCard,
                opacity: [0, 1],
                translateY: [20, 0],
                scale: [0.9, 1],
                duration: 800,
                easing: 'easeOutElastic(1, .5)',
                delay: 100
            });
        }
    }
}

// Add a new achievement
function addAchievement(achievement) {
    // Check if this is a valid achievement
    const validAchievement = achievementsList.find(a => a.id === achievement.id);
    if (!validAchievement) {
        console.error('Invalid achievement:', achievement);
        return;
    }
    
    // Use the achievement data from our list
    const achievementData = validAchievement;
    
    // Get current user progress
    fetch('/progress')
        .then(response => response.json())
        .then(progress => {
            // Check if achievement is already earned
            const alreadyEarned = progress.achievements.some(a => a.id === achievement.id);
            if (alreadyEarned) {
                console.log('Achievement already earned:', achievement.id);
                return;
            }
            
            // Add the achievement to user progress
            fetch('/progress/add-achievement', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ achievement_id: achievement.id })
            })
                .then(response => response.json())
                .then(updatedProgress => {
                    console.log('Achievement added:', achievement.id);
                    
                    // Show achievement celebration
                    showAchievementCelebration(achievementData);
                    
                    // Update achievements display if on the achievements page
                    const achievementsContainer = document.getElementById('achievementsContainer');
                    if (achievementsContainer) {
                        displayAchievements(updatedProgress.achievements);
                    }
                })
                .catch(error => {
                    console.error('Error adding achievement:', error);
                });
        })
        .catch(error => {
            console.error('Error fetching user progress:', error);
        });
}

// Show achievement celebration
function showAchievementCelebration(achievement) {
    // Create modal element
    const modal = document.createElement('div');
    modal.className = 'achievement-modal';
    modal.innerHTML = `
        <div class="achievement-modal-content">
            <div class="achievement-icon">${achievement.icon}</div>
            <h2>Achievement Unlocked!</h2>
            <h3>${achievement.title}</h3>
            <p>${achievement.description}</p>
            <button class="btn primary">Continue</button>
        </div>
    `;
    
    // Add to the DOM
    document.body.appendChild(modal);
    
    // Create confetti
    if (typeof createConfetti === 'function') {
        createConfetti();
    }
    
    // Add animation with anime.js
    if (typeof anime === 'function') {
        anime({
            targets: modal,
            scale: [0.9, 1],
            opacity: [0, 1],
            duration: 800,
            easing: 'easeOutElastic(1, .5)'
        });
    }
    
    // Add event listener for close button
    const closeBtn = modal.querySelector('.btn');
    closeBtn.addEventListener('click', () => {
        if (typeof anime === 'function') {
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
        } else {
            modal.remove();
        }
    });
    
    // Auto-close after 6 seconds
    setTimeout(() => {
        if (document.body.contains(modal)) {
            if (typeof anime === 'function') {
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
            } else {
                modal.remove();
            }
        }
    }, 6000);
}

// Export functions for use in other modules
window.addAchievement = addAchievement; 