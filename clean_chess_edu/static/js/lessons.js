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
            exerciseUrl = '/exercises/center_control';
            break;
        case 3:
            exerciseUrl = '/exercises/fork_practice';
            break;
        default:
            exerciseUrl = `/lesson/${lesson.id}`;
    }
    
    // Navigate to the exercise
    window.location.href = exerciseUrl;
}

// Define the lesson data
const lessonData = [
    {
        id: 1,
        title: "Chess Pieces & Board Setup",
        description: "Learn about the chess pieces and how to set up the board correctly.",
        difficulty: "Beginner",
        exercises: [
            {
                id: "piece_movement",
                title: "Piece Movement",
                description: "Learn how each chess piece moves on the board.",
                url: "/templates/exercises/piece_movement.html"
            },
            {
                id: "board_setup",
                title: "Board Setup",
                description: "Learn how to set up the chess board correctly before a game.",
                url: "/templates/exercises/board_setup.html"
            }
        ],
        unlocked: true
    },
    {
        id: 2,
        title: "Basic Opening Principles",
        description: "Learn the fundamental principles of the opening phase.",
        difficulty: "Beginner",
        exercises: [
            {
                id: "center_control",
                title: "Control the Center",
                description: "Learn why controlling the center is crucial in the opening.",
                url: "/templates/exercises/center_control.html"
            },
            {
                id: "piece_development",
                title: "Piece Development",
                description: "Learn how to efficiently develop your pieces in the opening.",
                url: "/templates/exercises/piece_development.html"
            }
        ],
        requirements: {
            lessons: [1]
        }
    },
    // ... existing code ...
];

// Function to check if a lesson is unlocked
function isLessonUnlocked(lesson) {
    // First lesson is always unlocked
    if (lesson.unlocked) return true;
    
    // Check requirements if present
    if (lesson.requirements) {
        // Check required lessons
        if (lesson.requirements.lessons) {
            for (const requiredLessonId of lesson.requirements.lessons) {
                // Check if required lesson is completed
                const isCompleted = userProgress.completedLessons.some(
                    completion => completion.lessonId === requiredLessonId && 
                    completion.completed === true
                );
                
                if (!isCompleted) return false;
            }
        }
    }
    
    return true;
}

// Mark a lesson as complete
function completeLesson(lessonId) {
    // Check if lesson is already marked as complete
    const existingCompletion = userProgress.completedLessons.find(
        completion => completion.lessonId === lessonId
    );
    
    if (existingCompletion) {
        existingCompletion.completed = true;
        existingCompletion.timestamp = new Date().toISOString();
    } else {
        userProgress.completedLessons.push({
            lessonId: lessonId,
            completed: true,
            timestamp: new Date().toISOString()
        });
    }
    
    // Save updated progress
    saveUserProgress();
    
    // Update UI to reflect changes
    updateUI();
    
    // Show notification
    showNotification(`Lesson ${lessonId} completed!`, 'success');
    
    console.log(`Lesson ${lessonId} marked as complete.`);
}

// Mark an exercise as complete
function completeExercise(lessonId, exerciseId) {
    // Find if there's an existing completion for this lesson
    let lessonCompletion = userProgress.completedLessons.find(
        completion => completion.lessonId === lessonId
    );
    
    // If no record exists for this lesson, create one
    if (!lessonCompletion) {
        lessonCompletion = {
            lessonId: lessonId,
            completed: false,
            exercises: [],
            timestamp: new Date().toISOString()
        };
        userProgress.completedLessons.push(lessonCompletion);
    }
    
    // If exercises array doesn't exist yet, create it
    if (!lessonCompletion.exercises) {
        lessonCompletion.exercises = [];
    }
    
    // Check if exercise is already marked as complete
    const existingExercise = lessonCompletion.exercises.find(
        ex => ex.id === exerciseId
    );
    
    if (existingExercise) {
        existingExercise.completed = true;
        existingExercise.timestamp = new Date().toISOString();
    } else {
        lessonCompletion.exercises.push({
            id: exerciseId,
            completed: true,
            timestamp: new Date().toISOString()
        });
    }
    
    // Check if all exercises for this lesson are completed
    const lesson = lessonData.find(l => l.id === lessonId);
    const allExercisesCompleted = lesson.exercises.every(exercise => {
        return lessonCompletion.exercises.some(ex => 
            ex.id === exercise.id && ex.completed === true
        );
    });
    
    // If all exercises are completed, mark the lesson as completed
    if (allExercisesCompleted) {
        lessonCompletion.completed = true;
        lessonCompletion.timestamp = new Date().toISOString();
    }
    
    // Save updated progress
    saveUserProgress();
    
    // Update UI
    updateUI();
    
    // Show notification
    showNotification(`Exercise "${exerciseId}" completed!`, 'success');
    
    console.log(`Exercise ${exerciseId} in lesson ${lessonId} marked as complete.`);
    
    return allExercisesCompleted;
}

// Function to update UI based on user progress
function updateUI() {
    const lessonContainer = document.getElementById('lessonContainer');
    if (!lessonContainer) return;
    
    lessonContainer.innerHTML = '';
    
    lessonData.forEach(lesson => {
        // Check if lesson is unlocked
        const isUnlocked = isLessonUnlocked(lesson);
        
        // Check if lesson is completed
        const lessonCompletion = userProgress.completedLessons.find(
            completion => completion.lessonId === lesson.id
        );
        
        const isCompleted = lessonCompletion && lessonCompletion.completed;
        
        // Create lesson card
        const lessonCard = document.createElement('div');
        lessonCard.className = `lesson-card ${isUnlocked ? 'unlocked' : 'locked'} ${isCompleted ? 'completed' : ''}`;
        
        // Add completed badge if completed
        let completedBadge = '';
        if (isCompleted) {
            completedBadge = '<div class="completion-badge"><i class="fas fa-check-circle"></i></div>';
        }
        
        // Calculate progress for partially completed lessons
        let progressText = '';
        let progressBar = '';
        
        if (lessonCompletion && lessonCompletion.exercises && lesson.exercises) {
            const completedExercises = lessonCompletion.exercises.filter(ex => ex.completed).length;
            const totalExercises = lesson.exercises.length;
            const progressPercent = (completedExercises / totalExercises) * 100;
            
            if (!isCompleted && completedExercises > 0) {
                progressText = `<div class="progress-text">${completedExercises}/${totalExercises} exercises completed</div>`;
                progressBar = `<div class="progress-bar"><div class="progress-fill" style="width: ${progressPercent}%"></div></div>`;
            }
        }
        
        lessonCard.innerHTML = `
            <div class="lesson-header">
                <h3>${lesson.title}</h3>
                <span class="difficulty ${lesson.difficulty.toLowerCase()}">${lesson.difficulty}</span>
                ${completedBadge}
            </div>
            <p>${lesson.description}</p>
            ${progressText}
            ${progressBar}
            <div class="lesson-exercises">
                ${isUnlocked ? 
                    lesson.exercises.map(exercise => {
                        // Check if exercise is completed
                        const isExerciseCompleted = lessonCompletion && 
                                                lessonCompletion.exercises &&
                                                lessonCompletion.exercises.some(ex => 
                                                    ex.id === exercise.id && ex.completed === true
                                                );
                        
                        return `
                            <div class="exercise ${isExerciseCompleted ? 'completed' : ''}">
                                <div class="exercise-details">
                                    <h4>${exercise.title}</h4>
                                    <p>${exercise.description}</p>
                                </div>
                                <a href="${exercise.url}" class="btn ${isExerciseCompleted ? 'secondary' : 'primary'}">
                                    ${isExerciseCompleted ? 'Review' : 'Start'}
                                </a>
                            </div>
                        `;
                    }).join('') : 
                    `<div class="locked-message">
                        <i class="fas fa-lock"></i>
                        <p>Complete previous lessons to unlock</p>
                    </div>`
                }
            </div>
        `;
        
        lessonContainer.appendChild(lessonCard);
    });
}

// Save user progress to localStorage and server
function saveUserProgress() {
    // Save to localStorage for immediate use
    localStorage.setItem('chessEduProgress', JSON.stringify(userProgress));
    
    // Also send to server if available
    if (typeof fetch !== 'undefined') {
        fetch('/save-progress', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userProgress)
        })
        .then(response => response.json())
        .then(data => {
            console.log('Progress saved to server:', data);
        })
        .catch(error => {
            console.error('Error saving progress to server:', error);
        });
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animation to slide in
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Export functions for use in other modules
window.completeLesson = completeLesson; 