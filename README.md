# ChessEdu - Interactive Chess Learning Application

ChessEdu is an educational interactive web application designed to teach chess fundamentals to beginners. The application features step-by-step lessons, interactive exercises, and a practice chessboard to help users learn chess at their own pace.

***Important Notes:***

- ***1. It was mentioned in the introduction document that this app will be in the form of a mobile app. This development strategy of this app has been changed to a website due to the timeline and cost to actually put it up in the AppStore as an app.***

- ***2. Everything is in clean_chess_edu folder. Run all setup commands inside it.***

## Features

- **Interactive Lessons**: Step-by-step guided lessons on chess fundamentals
- **Piece Movement Exercise**: Learn how each chess piece moves on the board
- **Board Setup**: Learn how to correctly set up a chess board
- **Practice Board**: Interactive chessboard to practice what you've learned
- **Achievement System**: Track your progress and earn achievements
- **User Progress Tracking**: Keep track of completed lessons and exercises

## [▶️ Watch the demo video](https://drive.google.com/file/d/1tjnfJCwfS-T7Tn-sCvOENa9TfflNVdVo/view?usp=sharing)


## Installation

### Prerequisites

- Python 3.10 or higher
- Conda
- Node.js and npm

### Setup

1. Clone the repository
```
git clone https://github.com/qianjay10/ChessEdu.git
cd clean_chess_edu
```

2. Set up the conda environment
```
conda create -n chessedu python=3.10
conda activate chessedu
pip install -r requirements.txt
```

3. Install JavaScript dependencies
```
npm install
```

4. Set up vendor libraries
```
./setup_vendor_libs.sh
```

5. Run the application
```
python src/app.py
```

6. Open your browser and navigate to `http://localhost:5001`

## Project Structure

- `src/`: Python source code
- `static/`: Static assets (CSS, JavaScript, images)
  - `css/`: CSS stylesheets
  - `js/`: JavaScript files
  - `images/`: Image assets
- `templates/`: HTML templates
  - `exercises/`: Exercise-specific templates
- `docs/`: Documentation (to be added in the future)

## Learning Path

1. **Chess Pieces & Board Setup**
   - Learn about each chess piece and how it moves
   - Learn about proper chess board orientation
   - Learn how to set up a chess board correctly

2. **Basic Opening Principles**
   - Learn fundamental principles to start your chess games effectively
   - Control the center, develop your pieces, and castle for king safety

3. **Simple Tactics: Forks & Pins**
   - Learn about forks, pins, and how they can give you an advantage
   - Practice identifying and executing these tactics

## Technology Stack

- **Backend**: Flask (Python)
- **Frontend**: HTML, CSS, JavaScript
- **Chess Logic**: chess.js
- **Chessboard UI**: chessboard.js
- **Animations**: anime.js, Three.js
- **Dependencies**: npm, conda

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by Chess.com, Lichess, and Duolingo
- Built for CS6460 EdTech final project 