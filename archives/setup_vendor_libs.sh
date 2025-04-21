#!/bin/bash

# Create vendor directories
mkdir -p static/js/vendor/animejs/lib
mkdir -p static/js/vendor

# Copy Three.js (or download if not available in node_modules)
if [ -f "node_modules/three/build/three.min.js" ]; then
    cp node_modules/three/build/three.min.js static/js/vendor/
else
    echo "Downloading Three.js from CDN..."
    curl -L https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js -o static/js/vendor/three.min.js
fi

# Create placeholder for anime.js
echo "Creating anime.js placeholder..."
cat > static/js/vendor/animejs/lib/anime.min.js << 'EOF'
/*
 * anime.min.js v3.2.1
 * This is a placeholder file.
 * The actual library is loaded from CDN in the HTML templates.
 * See https://animejs.com/ for documentation
 */

// Verify if anime is already loaded from CDN
if (typeof anime === 'undefined') {
  console.error('anime.js is not loaded. Make sure to include it in your HTML from CDN.');
}
EOF

# Copy chess.js (or download if not available)
if [ -f "node_modules/chess.js/dist/chess.min.js" ]; then
    cp node_modules/chess.js/dist/chess.min.js static/js/vendor/
else
    echo "Downloading chess.js from CDN..."
    curl -L https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js -o static/js/vendor/chess.min.js
fi

# Copy chessboard.js (or download if not available)
if [ -f "node_modules/@chrisoakman/chessboardjs/dist/chessboard-1.0.0.min.js" ]; then
    cp node_modules/@chrisoakman/chessboardjs/dist/chessboard-1.0.0.min.js static/js/vendor/
    cp node_modules/@chrisoakman/chessboardjs/dist/chessboard-1.0.0.min.css static/css/chessboard-1.0.0.min.css
else
    echo "Downloading chessboard.js from CDN..."
    curl -L https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.js -o static/js/vendor/chessboard-1.0.0.min.js
    curl -L https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.css -o static/css/chessboard-1.0.0.min.css
fi

# Add jQuery (required by chessboard.js)
curl -L https://code.jquery.com/jquery-3.6.0.min.js -o static/js/vendor/jquery-3.6.0.min.js

echo "Vendor libraries set up successfully!" 