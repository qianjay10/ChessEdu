// Achievements JavaScript for handling user achievements

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Load achievements if on the right page
    const achievementsContainer = document.getElementById('achievementsContainer');
    if (achievementsContainer) {
        loadAchievements();
    }
});

// Map lessons to achievements - each lesson completion unlocks a specific achievement
const lessonAchievements = [
    {
        lessonId: 1,
        id: 'chess_pieces',
        title: 'Chess Pieces Master',
        description: 'Completed the lesson on Chess Pieces & Board Setup',
        icon: '♟️'
    },
    {
        lessonId: 2,
        id: 'opening_principles',
        title: 'Opening Expert',
        description: 'Mastered the Basic Opening Principles',
        icon: '♘'
    },
    {
        lessonId: 3,
        id: 'tactics_master',
        title: 'Tactics Master',
        description: 'Learned about Forks & Pins tactics',
        icon: '♖'
    }
];

// Individual objective achievements for specific lessons
const objectiveAchievements = [
    // Basic Opening Principles objectives
    {
        lessonId: 2,
        objectiveIndex: 0,
        id: 'center_control',
        title: 'Center Commander',
        description: 'Learned how to control the center of the board',
        icon: '♙'
    },
    {
        lessonId: 2,
        objectiveIndex: 1,
        id: 'piece_development',
        title: 'Development Director',
        description: 'Mastered the skill of developing your pieces efficiently',
        icon: '♗'
    },
    {
        lessonId: 2,
        objectiveIndex: 2,
        id: 'king_safety',
        title: 'Castle Keeper',
        description: 'Learned the importance of castling for king safety',
        icon: '♚'
    }
];

// Additional achievements that aren't directly tied to lessons
const additionalAchievements = [
    {
        id: 'first_lesson',
        title: 'First Step',
        description: 'Completed your first chess lesson!',
        icon: '🏆',
        requirement: (progress) => progress.completed_lessons.length >= 1
    },
    {
        id: 'all_lessons',
        title: 'Chess Fundamentals Graduate',
        description: 'Completed all basic chess lessons!',
        icon: '🎓',
        requirement: (progress) => progress.completed_lessons.length >= 3
    },
    {
        id: 'three_day_streak',
        title: 'Consistent Learner',
        description: 'You\'ve maintained a 3-day learning streak!',
        icon: '🔥',
        requirement: (progress) => progress.current_streak >= 3
    }
];

// Combine all lists for a complete achievements list
const achievementsList = [
    ...lessonAchievements, 
    ...objectiveAchievements, 
    ...additionalAchievements
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
            // Generate achievements based on completed lessons
            const unlockedAchievements = generateAchievementsFromProgress(progress);
            displayAchievements(unlockedAchievements, progress);
        })
        .catch(error => {
            console.error('Error fetching achievements:', error);
            achievementsContainer.innerHTML = '<div class="error">Failed to load achievements. Please try again later.</div>';
        });
}

// Generate achievements based on user progress
function generateAchievementsFromProgress(progress) {
    const unlockedAchievements = [];
    
    // Check completed lessons and add relevant achievements
    if (progress.completed_lessons && progress.completed_lessons.length > 0) {
        // Add lesson-specific achievements
        lessonAchievements.forEach(achievement => {
            if (progress.completed_lessons.includes(achievement.lessonId)) {
                unlockedAchievements.push({
                    id: achievement.id,
                    title: achievement.title,
                    description: achievement.description,
                    icon: achievement.icon
                });
            }
        });
        
        // Check for completed objectives
        if (progress.completedObjectives) {
            objectiveAchievements.forEach(achievement => {
                const key = `${achievement.lessonId}_${achievement.objectiveIndex}`;
                if (progress.completedObjectives.includes(key)) {
                    unlockedAchievements.push({
                        id: achievement.id,
                        title: achievement.title,
                        description: achievement.description,
                        icon: achievement.icon
                    });
                }
            });
        }
        
        // Check for additional achievements
        additionalAchievements.forEach(achievement => {
            if (achievement.requirement && achievement.requirement(progress)) {
                unlockedAchievements.push({
                    id: achievement.id,
                    title: achievement.title,
                    description: achievement.description,
                    icon: achievement.icon
                });
            }
        });
    }
    
    return unlockedAchievements;
}

// Display achievements in the UI
function displayAchievements(unlockedAchievements, progress) {
    const achievementsContainer = document.getElementById('achievementsContainer');
    
    // Clear loading state
    achievementsContainer.innerHTML = '';
    
    // Check if there are any achievements
    if (!unlockedAchievements || unlockedAchievements.length === 0) {
        achievementsContainer.innerHTML = '<div class="no-achievements">Complete lessons to earn achievements!</div>';
        
        // Add a few locked achievements as previews
        const previewAchievements = achievementsList.slice(0, 3);
        previewAchievements.forEach(achievement => {
            const achievementCard = createAchievementCard(achievement, true);
            achievementsContainer.appendChild(achievementCard);
        });
        
        return;
    }
    
    // Get IDs of unlocked achievements
    const unlockedAchievementIds = unlockedAchievements.map(a => a.id);
    
    // Sort: earned achievements first, then locked ones
    const unlockedItems = achievementsList.filter(a => unlockedAchievementIds.includes(a.id));
    const lockedItems = achievementsList.filter(a => !unlockedAchievementIds.includes(a.id));
    const sortedAchievements = [...unlockedItems, ...lockedItems];
    
    // Generate HTML for each achievement
    sortedAchievements.forEach(achievement => {
        const isLocked = !unlockedAchievementIds.includes(achievement.id);
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
                        // Generate new achievements based on progress
                        const unlockedAchievements = generateAchievementsFromProgress(updatedProgress);
                        displayAchievements(unlockedAchievements, updatedProgress);
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
    
    // Create confetti if the function exists
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
}

// Export functions for use in other modules
window.addAchievement = addAchievement; 