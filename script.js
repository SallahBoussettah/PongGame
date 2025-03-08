// Get the canvas and its context
const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');
const scoreDisplay = document.getElementById('score');
const menuButton = document.getElementById('menuButton');
const singlePlayerBtn = document.getElementById('singlePlayerBtn');
const twoPlayerBtn = document.getElementById('twoPlayerBtn');
const onlineBtn = document.getElementById('onlineBtn');
const menuContainer = document.getElementById('menuContainer');
const gameContainer = document.getElementById('gameContainer');
const player2Controls = document.getElementById('player2Controls');

// Online mode elements
const onlineDialog = document.getElementById('onlineDialog');
const hostGameDialog = document.getElementById('hostGameDialog');
const joinGameDialog = document.getElementById('joinGameDialog');
const hostGameBtn = document.getElementById('hostGameBtn');
const joinGameBtn = document.getElementById('joinGameBtn');
const backToMenuBtn = document.getElementById('backToMenuBtn');
const gamePassword = document.getElementById('gamePassword');
const copyPasswordBtn = document.getElementById('copyPasswordBtn');
const passwordInput = document.getElementById('passwordInput');
const connectBtn = document.getElementById('connectBtn');
const cancelHostBtn = document.getElementById('cancelHostBtn');
const cancelJoinBtn = document.getElementById('cancelJoinBtn');
const hostStatusMsg = document.getElementById('hostStatusMsg');
const joinStatusMsg = document.getElementById('joinStatusMsg');

// Sound effects
const paddleHitSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-game-ball-tap-2073.mp3');
const wallHitSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-quick-jump-arcade-game-239.mp3');
const scoreSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-arcade-mechanical-bling-210.mp3');
const countdownSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-unlock-game-notification-253.mp3');
const menuSelectSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-select-click-1109.mp3');

// Game objects
const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 10,
    speedX: 3, // Reduced from 5 to 3
    speedY: 3, // Reduced from 5 to 3
    color: '#fff'
};

const paddleHeight = 80;
const paddleWidth = 10;
const paddleSpeed = 8;

const leftPaddle = {
    x: 10,
    y: canvas.height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    color: '#fff',
    score: 0,
    speed: paddleSpeed
};

const rightPaddle = {
    x: canvas.width - 20,
    y: canvas.height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    color: '#fff',
    score: 0,
    speed: paddleSpeed
};

// Power-ups
const powerUps = [];
const particles = [];

// Game state
let gameRunning = false;
let countdownActive = false;
let countdownValue = 3;
let keys = {};
let singlePlayerMode = false;
let gamePaused = false;
let gameOver = false;
const winScore = 5;

// Online multiplayer state
let onlineMode = false;
let isHost = false;
let peer = null;
let conn = null;
let opponentConnected = false;
let lastSentPaddleY = 0;
let gameStateSync = null;

// Generate a random password
function generatePassword() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Event listeners for keyboard
document.addEventListener('keydown', function(e) {
    keys[e.key] = true;
    
    // Pause game with 'p' key
    if ((e.key === 'p' || e.key === 'P') && gameRunning && !onlineMode) {
        togglePause();
    }
});

document.addEventListener('keyup', function(e) {
    keys[e.key] = false;
});

// Menu button event listeners
singlePlayerBtn.addEventListener('click', function() {
    menuSelectSound.play();
    singlePlayerMode = true;
    onlineMode = false;
    startGame();
    player2Controls.textContent = "Player 2: AI Controlled";
});

twoPlayerBtn.addEventListener('click', function() {
    menuSelectSound.play();
    singlePlayerMode = false;
    onlineMode = false;
    startGame();
    player2Controls.textContent = "Player 2: Arrow Up, Arrow Down";
});

onlineBtn.addEventListener('click', function() {
    menuSelectSound.play();
    showOnlineDialog();
});

menuButton.addEventListener('click', function() {
    if (onlineMode) {
        disconnectFromPeer();
    }
    showMenu();
});

// Online multiplayer event listeners
hostGameBtn.addEventListener('click', function() {
    menuSelectSound.play();
    showHostGameDialog();
    initHostGame();
});

joinGameBtn.addEventListener('click', function() {
    menuSelectSound.play();
    showJoinGameDialog();
});

backToMenuBtn.addEventListener('click', function() {
    menuSelectSound.play();
    hideOnlineDialog();
    showMenu();
});

cancelHostBtn.addEventListener('click', function() {
    menuSelectSound.play();
    disconnectFromPeer();
    hideHostGameDialog();
    showOnlineDialog();
});

cancelJoinBtn.addEventListener('click', function() {
    menuSelectSound.play();
    disconnectFromPeer();
    hideJoinGameDialog();
    showOnlineDialog();
});

copyPasswordBtn.addEventListener('click', function() {
    const password = gamePassword.textContent;
    navigator.clipboard.writeText(password)
        .then(() => {
            copyPasswordBtn.textContent = "Copied!";
            setTimeout(() => {
                copyPasswordBtn.textContent = "Copy";
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy password: ', err);
        });
});

connectBtn.addEventListener('click', function() {
    const password = passwordInput.value.trim();
    if (password) {
        joinGame(password);
    } else {
        joinStatusMsg.textContent = "Please enter a password";
    }
});

// Function to initialize host game
function initHostGame() {
    const password = generatePassword();
    gamePassword.textContent = password;
    hostStatusMsg.textContent = "Waiting for opponent to connect...";
    
    // Initialize PeerJS
    peer = new Peer(password);
    
    peer.on('open', function(id) {
        console.log('Host connected with ID:', id);
    });
    
    peer.on('connection', function(connection) {
        conn = connection;
        isHost = true;
        onlineMode = true;
        
        conn.on('open', function() {
            console.log('Peer connected!');
            opponentConnected = true;
            hostStatusMsg.textContent = "Opponent connected! Starting game...";
            
            // Start the game in 2 seconds
            setTimeout(() => {
                hideHostGameDialog();
                startOnlineGame();
            }, 2000);
            
            // Set up data handling
            setupDataHandling();
        });
        
        conn.on('close', function() {
            console.log('Peer disconnected');
            opponentDisconnected();
        });
    });
    
    peer.on('error', function(err) {
        console.error('PeerJS error:', err);
        hostStatusMsg.textContent = "Connection error. Please try again.";
    });
}

// Function to join a game
function joinGame(password) {
    // Initialize PeerJS
    peer = new Peer();
    
    peer.on('open', function(id) {
        console.log('Peer ID:', id);
        joinStatusMsg.textContent = "Connecting to game...";
        
        // Connect to the host
        conn = peer.connect(password);
        isHost = false;
        onlineMode = true;
        
        conn.on('open', function() {
            console.log('Connected to host!');
            opponentConnected = true;
            joinStatusMsg.textContent = "Connected! Starting game...";
            
            // Start the game in 2 seconds
            setTimeout(() => {
                hideJoinGameDialog();
                startOnlineGame();
            }, 2000);
            
            // Set up data handling
            setupDataHandling();
        });
        
        conn.on('close', function() {
            console.log('Disconnected from host');
            opponentDisconnected();
        });
        
        conn.on('error', function(err) {
            console.error('Connection error:', err);
            joinStatusMsg.textContent = "Connection error. Please try again.";
        });
    });
    
    peer.on('error', function(err) {
        console.error('PeerJS error:', err);
        joinStatusMsg.textContent = "Error: Could not find game with that password.";
    });
}

// Set up data handling for online play
function setupDataHandling() {
    conn.on('data', function(data) {
        if (data.type === 'paddlePosition') {
            // Update opponent's paddle position
            if (isHost) {
                rightPaddle.y = data.y;
            } else {
                leftPaddle.y = data.y;
            }
        } else if (data.type === 'gameState' && !isHost) {
            // Only the client (non-host) receives game state updates
            ball.x = data.ball.x;
            ball.y = data.ball.y;
            ball.speedX = data.ball.speedX;
            ball.speedY = data.ball.speedY;
            leftPaddle.score = data.leftPaddle.score;
            rightPaddle.score = data.rightPaddle.score;
            
            // Update score display
            scoreDisplay.textContent = `${leftPaddle.score} : ${rightPaddle.score}`;
            
            // Check for game over
            if (leftPaddle.score >= winScore || rightPaddle.score >= winScore) {
                gameOver = true;
                gameRunning = false;
                clearInterval(gameStateSync);
                drawGameOverScreen();
            }
        } else if (data.type === 'startGame') {
            startCountdown();
        } else if (data.type === 'resetGame') {
            resetGame();
        }
    });
}

// Function to disconnect from peer
function disconnectFromPeer() {
    if (conn) {
        conn.close();
    }
    if (peer) {
        peer.destroy();
    }
    if (gameStateSync) {
        clearInterval(gameStateSync);
    }
    conn = null;
    peer = null;
    opponentConnected = false;
    onlineMode = false;
}

// Function to handle opponent disconnection
function opponentDisconnected() {
    if (gameRunning) {
        gamePaused = true;
        drawPauseScreen("Opponent disconnected");
    }
    
    setTimeout(() => {
        disconnectFromPeer();
        showMenu();
    }, 3000);
}

// Dialog visibility functions
function showOnlineDialog() {
    menuContainer.style.display = 'none';
    onlineDialog.style.display = 'flex';
}

function hideOnlineDialog() {
    onlineDialog.style.display = 'none';
}

function showHostGameDialog() {
    onlineDialog.style.display = 'none';
    hostGameDialog.style.display = 'flex';
}

function hideHostGameDialog() {
    hostGameDialog.style.display = 'none';
}

function showJoinGameDialog() {
    onlineDialog.style.display = 'none';
    joinGameDialog.style.display = 'flex';
    passwordInput.value = '';
    joinStatusMsg.textContent = '';
}

function hideJoinGameDialog() {
    joinGameDialog.style.display = 'none';
}

// Function to start the game from menu
function startGame() {
    menuContainer.style.display = 'none';
    gameContainer.style.display = 'flex';
    resetGame();
}

// Function to start online game
function startOnlineGame() {
    menuContainer.style.display = 'none';
    gameContainer.style.display = 'flex';
    
    resetGame();
    
    if (isHost) {
        // Host controls game state and sends updates to client
        player2Controls.textContent = "Player 2: Online Opponent";
        
        // Start sending game state updates to client
        gameStateSync = setInterval(() => {
            if (conn && opponentConnected && gameRunning) {
                conn.send({
                    type: 'gameState',
                    ball: {
                        x: ball.x,
                        y: ball.y,
                        speedX: ball.speedX,
                        speedY: ball.speedY
                    },
                    leftPaddle: {
                        score: leftPaddle.score
                    },
                    rightPaddle: {
                        score: rightPaddle.score
                    }
                });
            }
        }, 16); // ~60 times per second
    } else {
        // Client controls right paddle and sends position to host
        player2Controls.textContent = "You: Arrow Up, Arrow Down";
    }
}

// Function to show the menu
function showMenu() {
    gameRunning = false;
    gamePaused = false;
    gameContainer.style.display = 'none';
    menuContainer.style.display = 'flex';
}

// Start and reset buttons
startButton.addEventListener('click', function() {
    if (!gameRunning && !countdownActive && !gameOver) {
        if (onlineMode && isHost) {
            // Host broadcasts start game command
            conn.send({
                type: 'startGame'
            });
        }
        startCountdown();
    }
});

resetButton.addEventListener('click', function() {
    if (onlineMode && isHost) {
        // Host broadcasts reset game command
        conn.send({
            type: 'resetGame'
        });
    }
    resetGame();
});

// Countdown function
function startCountdown() {
    countdownActive = true;
    countdownValue = 3;
    
    // Display the countdown
    displayCountdown();
    
    // Start the countdown timer
    const countdownInterval = setInterval(function() {
        countdownValue--;
        
        if (countdownValue <= 0) {
            clearInterval(countdownInterval);
            countdownActive = false;
            gameRunning = true;
            gameLoop();
        } else {
            displayCountdown();
            countdownSound.play();
        }
    }, 1000);
    
    // Play sound for initial countdown
    countdownSound.play();
}

function displayCountdown() {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the net and paddles
    drawNet();
    drawPaddle(leftPaddle);
    drawPaddle(rightPaddle);
    
    // Draw the countdown text
    ctx.font = "60px Arial";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(countdownValue, canvas.width / 2, canvas.height / 2);
}

// Pause function
function togglePause() {
    gamePaused = !gamePaused;
    
    if (!gamePaused) {
        // Resume the game
        gameLoop();
    } else {
        // Draw pause screen
        drawPauseScreen();
    }
}

function drawPauseScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.font = "30px Arial";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText("GAME PAUSED", canvas.width / 2, canvas.height / 2);
    ctx.font = "20px Arial";
    ctx.fillText("Press 'P' to continue", canvas.width / 2, canvas.height / 2 + 40);
}

// Draw functions
function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.fill();
    ctx.closePath();
}

function drawPaddle(paddle) {
    ctx.fillStyle = paddle.color;
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
}

function drawNet() {
    ctx.beginPath();
    ctx.setLineDash([5, 15]);
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.closePath();
}

function drawPowerUps() {
    powerUps.forEach(powerUp => {
        ctx.beginPath();
        ctx.arc(powerUp.x, powerUp.y, powerUp.radius, 0, Math.PI * 2);
        ctx.fillStyle = powerUp.type === 'speed' ? '#ff0' : '#0ff';
        ctx.fill();
        ctx.closePath();
    });
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life / 30;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.closePath();
        ctx.globalAlpha = 1;
    });
}

function drawGameOverScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.font = "40px Arial";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    
    const winner = leftPaddle.score >= winScore ? "Player 1" : "Player 2";
    ctx.fillText(winner + " Wins!", canvas.width / 2, canvas.height / 2 - 20);
    
    ctx.font = "20px Arial";
    ctx.fillText("Final Score: " + leftPaddle.score + " - " + rightPaddle.score, 
                canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText("Press 'Reset Game' to play again", 
                canvas.width / 2, canvas.height / 2 + 60);
}

function draw() {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the net
    drawNet();
    
    // Draw the ball and paddles
    drawBall();
    drawPaddle(leftPaddle);
    drawPaddle(rightPaddle);
    
    // Draw power-ups and particles
    drawPowerUps();
    drawParticles();
}

// Particle effects
function createParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            radius: Math.random() * 3 + 1,
            color: color,
            speedX: Math.random() * 6 - 3,
            speedY: Math.random() * 6 - 3,
            life: 30
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.speedX;
        p.y += p.speedY;
        p.life--;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// Power-ups
function spawnPowerUp() {
    if (Math.random() < 0.005 && powerUps.length < 1) { // 0.5% chance per frame, max 1 power-up
        powerUps.push({
            x: Math.random() * (canvas.width - 100) + 50,
            y: Math.random() * (canvas.height - 100) + 50,
            type: Math.random() < 0.5 ? 'speed' : 'size',
            radius: 15,
            active: false,
            duration: 5000 // 5 seconds
        });
    }
}

function checkPowerUpCollision() {
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        const dx = powerUp.x - ball.x;
        const dy = powerUp.y - ball.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < ball.radius + powerUp.radius) {
            // Ball hit power-up
            activatePowerUp(powerUp);
            powerUps.splice(i, 1);
        }
    }
}

function activatePowerUp(powerUp) {
    if (powerUp.type === 'speed') {
        // Increase paddle speed for the player who's about to receive the ball
        const paddle = ball.speedX > 0 ? leftPaddle : rightPaddle;
        paddle.speed *= 1.5;
        
        setTimeout(() => {
            paddle.speed /= 1.5;
        }, powerUp.duration);
    } else if (powerUp.type === 'size') {
        // Increase paddle size for the player who's about to receive the ball
        const paddle = ball.speedX > 0 ? leftPaddle : rightPaddle;
        paddle.height *= 1.5;
        
        setTimeout(() => {
            paddle.height /= 1.5;
        }, powerUp.duration);
    }
}

// Update functions
function updatePaddles() {
    if (onlineMode) {
        // In online mode, each player only controls their paddle
        if (isHost) {
            // Host controls left paddle
            if (keys['w'] || keys['W']) {
                leftPaddle.y = Math.max(0, leftPaddle.y - leftPaddle.speed);
            }
            if (keys['s'] || keys['S']) {
                leftPaddle.y = Math.min(canvas.height - leftPaddle.height, leftPaddle.y + leftPaddle.speed);
            }
            
            // Send paddle position to peer if it changed
            if (conn && opponentConnected && Math.abs(leftPaddle.y - lastSentPaddleY) > 1) {
                conn.send({
                    type: 'paddlePosition',
                    y: leftPaddle.y
                });
                lastSentPaddleY = leftPaddle.y;
            }
        } else {
            // Client controls right paddle
            if (keys['ArrowUp']) {
                rightPaddle.y = Math.max(0, rightPaddle.y - rightPaddle.speed);
            }
            if (keys['ArrowDown']) {
                rightPaddle.y = Math.min(canvas.height - rightPaddle.height, rightPaddle.y + rightPaddle.speed);
            }
            
            // Send paddle position to peer if it changed
            if (conn && opponentConnected && Math.abs(rightPaddle.y - lastSentPaddleY) > 1) {
                conn.send({
                    type: 'paddlePosition',
                    y: rightPaddle.y
                });
                lastSentPaddleY = rightPaddle.y;
            }
        }
    } else {
        // Local play mode (same as before)
        // Player 1 (left paddle) controls - W and S keys
        if (keys['w'] || keys['W']) {
            leftPaddle.y = Math.max(0, leftPaddle.y - leftPaddle.speed);
        }
        if (keys['s'] || keys['S']) {
            leftPaddle.y = Math.min(canvas.height - leftPaddle.height, leftPaddle.y + leftPaddle.speed);
        }
        
        // Player 2 (right paddle) controls - AI or human
        if (singlePlayerMode) {
            // Simple AI - follow the ball with some delay
            const targetY = ball.y - (rightPaddle.height / 2);
            const difficulty = 0.07; // Lower = harder (faster reaction)
            
            // Add some prediction for where the ball will be
            let prediction = 0;
            if (ball.speedX > 0) {
                // Ball is moving toward AI paddle
                const timeToIntercept = (rightPaddle.x - ball.x) / ball.speedX;
                prediction = ball.y + ball.speedY * timeToIntercept;
            }
            
            // Move toward predicted position with some error
            const aiTargetY = prediction || targetY;
            rightPaddle.y += (aiTargetY - rightPaddle.y) * difficulty;
            
            // Keep paddle within bounds
            rightPaddle.y = Math.max(0, Math.min(canvas.height - rightPaddle.height, rightPaddle.y));
        } else {
            // Human player 2 controls - Arrow keys
            if (keys['ArrowUp']) {
                rightPaddle.y = Math.max(0, rightPaddle.y - rightPaddle.speed);
            }
            if (keys['ArrowDown']) {
                rightPaddle.y = Math.min(canvas.height - rightPaddle.height, rightPaddle.y + rightPaddle.speed);
            }
        }
    }
}

function updateBall() {
    // In online mode, only the host updates the ball
    if (onlineMode && !isHost) return;
    
    // Move the ball
    ball.x += ball.speedX;
    ball.y += ball.speedY;
    
    // Ball collision with top and bottom walls
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
        ball.speedY = -ball.speedY;
        wallHitSound.play();
    }
    
    // Ball collision with paddles
    if (
        // Left paddle collision
        ball.x - ball.radius < leftPaddle.x + leftPaddle.width &&
        ball.y > leftPaddle.y &&
        ball.y < leftPaddle.y + leftPaddle.height &&
        ball.speedX < 0
    ) {
        ball.speedX = -ball.speedX;
        // Add a little randomness to the bounce, but keep it controlled
        ball.speedY += (Math.random() * 1.5 - 0.75);
        paddleHitSound.play();
        createParticles(ball.x, ball.y, 15, '#fff');
    }
    
    if (
        // Right paddle collision
        ball.x + ball.radius > rightPaddle.x &&
        ball.y > rightPaddle.y &&
        ball.y < rightPaddle.y + rightPaddle.height &&
        ball.speedX > 0
    ) {
        ball.speedX = -ball.speedX;
        // Add a little randomness to the bounce, but keep it controlled
        ball.speedY += (Math.random() * 1.5 - 0.75);
        paddleHitSound.play();
        createParticles(ball.x, ball.y, 15, '#fff');
    }
    
    // Ball out of bounds - scoring
    if (ball.x < 0) {
        // Right player scores
        rightPaddle.score++;
        scoreSound.play();
        checkWinCondition();
        resetBall();
    } else if (ball.x > canvas.width) {
        // Left player scores
        leftPaddle.score++;
        scoreSound.play();
        checkWinCondition();
        resetBall();
    }
    
    // Update score display
    scoreDisplay.textContent = `${leftPaddle.score} : ${rightPaddle.score}`;
}

function checkWinCondition() {
    if (leftPaddle.score >= winScore || rightPaddle.score >= winScore) {
        gameOver = true;
        gameRunning = false;
        drawGameOverScreen();
    }
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speedX = -ball.speedX;
    // Keep the vertical speed reasonable
    ball.speedY = (Math.random() * 4 - 2);
}

function resetGame() {
    gameRunning = false;
    countdownActive = false;
    gameOver = false;
    leftPaddle.score = 0;
    rightPaddle.score = 0;
    leftPaddle.y = canvas.height / 2 - paddleHeight / 2;
    rightPaddle.y = canvas.height / 2 - paddleHeight / 2;
    resetBall();
    scoreDisplay.textContent = "0 : 0";
    
    // Clear power-ups and particles
    powerUps.length = 0;
    particles.length = 0;
    
    draw();
}

// Main game loop
function gameLoop() {
    if (!gameRunning || gamePaused || gameOver) return;
    
    updatePaddles();
    
    // In online mode, only the host updates the game state
    if (!onlineMode || isHost) {
        updateBall();
        updateParticles();
        spawnPowerUp();
        checkPowerUpCollision();
    }
    
    draw();
    
    requestAnimationFrame(gameLoop);
}

// Initial draw
draw();