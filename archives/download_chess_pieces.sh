#!/bin/bash

# Create the directory for chess piece images
mkdir -p static/images/chesspieces/wikipedia

# Download white pieces
curl -L https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg -o static/images/chesspieces/wikipedia/wP.png
curl -L https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg -o static/images/chesspieces/wikipedia/wR.png
curl -L https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg -o static/images/chesspieces/wikipedia/wN.png
curl -L https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg -o static/images/chesspieces/wikipedia/wB.png
curl -L https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg -o static/images/chesspieces/wikipedia/wQ.png
curl -L https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg -o static/images/chesspieces/wikipedia/wK.png

# Download black pieces
curl -L https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg -o static/images/chesspieces/wikipedia/bP.png
curl -L https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg -o static/images/chesspieces/wikipedia/bR.png
curl -L https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg -o static/images/chesspieces/wikipedia/bN.png
curl -L https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg -o static/images/chesspieces/wikipedia/bB.png
curl -L https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg -o static/images/chesspieces/wikipedia/bQ.png
curl -L https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg -o static/images/chesspieces/wikipedia/bK.png

# Create a symbolic link for the exercises directory
ln -s -f ../static/images/chesspieces exercises/img

echo "Chess pieces downloaded successfully!" 