// Lessons JavaScript for handling lesson loading and interaction

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Load lessons if on the right page
    const lessonsContainer = document.getElementById('lessonsContainer');
    if (lessonsContainer) {
        loadLessons();
    }
});

// Load lessons from the server
function loadLessons() {
    const lessonsContainer = document.getElementById('lessonsContainer');
    
    // Show loading state
    lessonsContainer.innerHTML = '<div class="loading">Loading lessons...</div>';
    
    // Fetch lessons from the server
    fetch('/lessons')
        .then(response => response.json())
        .then(lessons => {
            displayLessons(lessons);
        })
        .catch(error => {
            console.error('Error fetching lessons:', error);
            lessonsContainer.innerHTML = '<div class="error">Failed to load lessons. Please try again later.</div>';
        });
}

// Display lessons in the UI
function displayLessons(lessons) {
    const lessonsContainer = document.getElementById('lessonsContainer');
    
    // Clear loading state
    lessonsContainer.innerHTML = '';
    
    // Get user progress
    fetch('/progress')
        .then(response => response.json())
        .then(progress => {
            // Sort lessons by ID
            lessons.sort((a, b) => a.id - b.id);
            
            // Generate HTML for each lesson
            lessons.forEach(lesson => {
                const lessonCard = createLessonCard(lesson, progress);
                lessonsContainer.appendChild(lessonCard);
                
                // Add animations with anime.js
                animateLessonCard(lessonCard);
            });
        })
        .catch(error => {
            console.error('Error fetching user progress:', error);
            
            // Display lessons without progress information
            lessons.sort((a, b) => a.id - b.id);
            
            lessons.forEach(lesson => {
                const lessonCard = createLessonCard(lesson, { completed_lessons: [] });
                lessonsContainer.appendChild(lessonCard);
                
                // Add animations with anime.js
                animateLessonCard(lessonCard);
            });
        });
}

// Create a lesson card element
function createLessonCard(lesson, progress) {
    // Determine the lesson status
    const isCompleted = progress.completed_lessons.includes(lesson.id);
    const isLocked = lesson.id > 1 && !progress.completed_lessons.includes(lesson.id - 1);
    
    // Create the lesson card element
    const lessonCard = document.createElement('div');
    lessonCard.className = 'lesson-card';
    lessonCard.dataset.lessonId = lesson.id;
    
    // Create the card content
    lessonCard.innerHTML = `
        <div class="lesson-header">
            <h3>${lesson.title}</h3>
            <p>${lesson.description}</p>
        </div>
        <div class="lesson-body">
            <p>${lesson.content}</p>
            <div class="lesson-objectives">
                <h4>Learning Objectives:</h4>
                <ul>
                    ${lesson.objectives.map(objective => `<li>${objective}</li>`).join('')}
                </ul>
            </div>
        </div>
        <div class="lesson-footer">
            <div class="lesson-status">
                <div class="status-indicator ${isCompleted ? 'status-completed' : isLocked ? 'status-locked' : 'status-in-progress'}"></div>
                <span>${isCompleted ? 'Completed' : isLocked ? 'Locked' : 'Available'}</span>
            </div>
            <button class="btn primary start-lesson-btn" ${isLocked ? 'disabled' : ''}>
                ${isCompleted ? 'Review' : 'Start'}
            </button>
        </div>
    `;
    
    // Add click event for the start button
    const startButton = lessonCard.querySelector('.start-lesson-btn');
    startButton.addEventListener('click', () => {
        if (!isLocked) {
            startLesson(lesson);
        }
    });
    
    return lessonCard;
}

// Animate a lesson card with anime.js
function animateLessonCard(lessonCard) {
    if (typeof anime === 'function') {
        anime({
            targets: lessonCard,
            opacity: [0, 1],
            translateY: [20, 0],
            duration: 600,
            easing: 'easeOutCubic',
            delay: lessonCard.dataset.lessonId * 100 // Stagger effect
        });
    }
}

// Start a lesson
function startLesson(lesson) {
    // Determine which exercise to start based on the lesson ID
    let exerciseUrl = '';
    
    switch(lesson.id) {
        case 1:
            exerciseUrl = '/exercises/piece_movement';
            break;
        case 2:
            exerciseUrl = '/exercises/board_setup';
            break;
        case 3:
            exerciseUrl = '/exercises/center_control';
            break;
        default:
            exerciseUrl = `/lesson/${lesson.id}`;
    }
    
    // Navigate to the exercise
    window.location.href = exerciseUrl;
}

// Mark a lesson as complete
function completeLesson(lessonId) {
    // Send a request to mark the lesson as completed
    fetch('/progress/complete-lesson', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lesson_id: lessonId })
    })
        .then(response => response.json())
        .then(progress => {
            // Update the UI to reflect completion
            const lessonCard = document.querySelector(`.lesson-card[data-lesson-id="${lessonId}"]`);
            if (lessonCard) {
                const statusIndicator = lessonCard.querySelector('.status-indicator');
                const statusText = lessonCard.querySelector('.lesson-status span');
                const startButton = lessonCard.querySelector('.start-lesson-btn');
                
                if (statusIndicator) {
                    statusIndicator.className = 'status-indicator status-completed';
                }
                
                if (statusText) {
                    statusText.textContent = 'Completed';
                }
                
                if (startButton) {
                    startButton.textContent = 'Review';
                }
                
                // Unlock the next lesson if available
                const nextLessonCard = document.querySelector(`.lesson-card[data-lesson-id="${lessonId + 1}"]`);
                if (nextLessonCard) {
                    const nextStatusIndicator = nextLessonCard.querySelector('.status-indicator');
                    const nextStatusText = nextLessonCard.querySelector('.lesson-status span');
                    const nextStartButton = nextLessonCard.querySelector('.start-lesson-btn');
                    
                    if (nextStatusIndicator) {
                        nextStatusIndicator.className = 'status-indicator status-in-progress';
                    }
                    
                    if (nextStatusText) {
                        nextStatusText.textContent = 'Available';
                    }
                    
                    if (nextStartButton) {
                        nextStartButton.disabled = false;
                    }
                    
                    // Highlight the newly unlocked lesson
                    highlightNewLesson(nextLessonCard);
                }
            }
            
            // Update streak count
            const streakElement = document.getElementById('streakCount');
            if (streakElement) {
                streakElement.textContent = progress.current_streak;
            }
            
            // Show a notification
            if (typeof showNotification === 'function') {
                showNotification('Lesson completed successfully!', 'success');
            }
        })
        .catch(error => {
            console.error('Error completing lesson:', error);
            
            // Show error notification
            if (typeof showNotification === 'function') {
                showNotification('Failed to save your progress. Please try again.', 'error');
            }
        });
}

// Highlight a newly unlocked lesson
function highlightNewLesson(lessonCard) {
    if (typeof anime === 'function') {
        anime({
            targets: lessonCard,
            scale: [1, 1.05, 1],
            borderColor: ['#dee2e6', '#4169e1', '#dee2e6'],
            boxShadow: [
                '0 4px 8px rgba(0,0,0,0.1)',
                '0 8px 16px rgba(65,105,225,0.3)',
                '0 4px 8px rgba(0,0,0,0.1)'
            ],
            duration: 1500,
            easing: 'easeInOutQuad'
        });
    }
}

// Export functions for use in other modules
window.completeLesson = completeLesson; 