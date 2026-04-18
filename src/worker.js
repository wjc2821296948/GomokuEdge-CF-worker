const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gomoku Room</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        #roomInfo, #gameArea, #waitingMessage, #winnerMessage { display: none; }
        #board { display: grid; grid-template-columns: repeat(15, 30px); grid-gap: 1px; margin-bottom: 20px; }
        .cell { width: 30px; height: 30px; border: 1px solid #000; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        #turnInfo { font-weight: bold; margin-bottom: 10px; }
        #winnerMessage { text-align: center; font-size: 24px; font-weight: bold; margin-top: 20px; }
    </style>
</head>
<body>
    <h1>Gomoku Room</h1>
    <div id="joinArea">
        <input type="text" id="roomIdInput" placeholder="Enter Room ID">
        <button onclick="joinRoom()">Join Room</button>
        <button onclick="createRoom()">Create Room</button>
    </div>
    <div id="waitingMessage">Waiting for another player to join...</div>
    <div id="roomInfo">
        <h2>Room: <span id="roomId"></span></h2>
        <p>Your ID: <span id="userId"></span></p>
        <p>由于技术原因，在你这边显示的棋子始终是O</p>
        <p>先手始终为房主</p>
        <h3>Users in Room:</h3>
        <ul id="userList"></ul>
    </div>
    <div id="gameArea">
        <div id="turnInfo"></div>
        <div id="board"></div>
    </div>
    <div id="winnerMessage"></div>

    <script>
    let userId;
    let currentRoomId;
    let lastMessageId = 0;
    let board = Array(15).fill().map(() => Array(15).fill(null));
    let currentTurn;
    let gameStarted = false;

    function createRoom() {
        currentRoomId = Math.random().toString(36).substr(2, 9);
        joinRoom(currentRoomId);
    }

    function joinRoom(roomId) {
        if (!roomId) {
            roomId = document.getElementById("roomIdInput").value.trim();
        }
        if (roomId) {
            currentRoomId = roomId;
            fetch("/join/" + currentRoomId)
                .then(response => response.json())
                .then(data => {
                    userId = data.userId;
                    document.getElementById("joinArea").style.display = "none";
                    document.getElementById("roomInfo").style.display = "block";
                    document.getElementById("roomId").textContent = currentRoomId;
                    document.getElementById("userId").textContent = userId;
                    updateUserList(data.users);
                    if (data.users.length < 2) {
                        document.getElementById("waitingMessage").style.display = "block";
                    } else {
                        startGame();
                    }
                    startPolling();
                });
        } else {
            alert("Please enter a room ID");
        }
    }

    function startGame() {
        gameStarted = true;
        document.getElementById("waitingMessage").style.display = "none";
        document.getElementById("gameArea").style.display = "block";
        createBoard();
        updateTurnInfo(currentTurn);
    }

    function createBoard() {
        const boardElement = document.getElementById("board");
        boardElement.innerHTML = '';
        for (let y = 0; y < 15; y++) {
            for (let x = 0; x < 15; x++) {
                const cell = document.createElement("div");
                cell.className = "cell";
                cell.onclick = () => makeMove(x, y);
                boardElement.appendChild(cell);
            }
        }
    }

    function makeMove(x, y) {
        if (gameStarted && board[y][x] === null && currentTurn === userId) {
            fetch("/send/" + currentRoomId, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ type: "move", userId: userId, x: x, y: y })
            });
        }
    }

    function updateBoard(x, y, player) {
        board[y][x] = player;
        const cell = document.getElementById("board").children[y * 15 + x];
        cell.textContent = player === userId ? "O" : "X";
    }

    function startPolling() {
        setInterval(pollMessages, 100);
    }

    function pollMessages() {
        fetch("/poll/" + currentRoomId + "/" + lastMessageId)
            .then(response => response.json())
            .then(data => {
                data.messages.forEach(handleMessage);
                if (data.messages.length > 0) {
                    lastMessageId = data.messages[data.messages.length - 1].id;
                }
                updateUserList(data.users);
                updateTurnInfo(data.currentTurn);
                if (data.users.length < 2 && gameStarted) {
                    showWinnerMessage("A player has disconnected. The game will restart.");
                } else if (data.users.length === 2 && !gameStarted) {
                    startGame();
                }
            });
    }

    function handleMessage(message) {
        switch (message.type) {
            case "userJoined":
            case "userLeft":
                updateUserList(message.users);
                break;
            case "move":
                updateBoard(message.x, message.y, message.userId);
                if (message.winner) {
                    showWinnerMessage("Player " + message.winner + " wins!");
                }
                break;
        }
    }

    function showWinnerMessage(message) {
        const winnerMessage = document.getElementById("winnerMessage");
        winnerMessage.textContent = message;
        winnerMessage.style.display = "block";
        
        gameStarted = false;
        
        setTimeout(() => {
            location.reload();
        }, 3000);
    }

    function updateUserList(users) {
        var userList = document.getElementById("userList");
        userList.innerHTML = users.map(function(user) {
            return "<li>" + user + "</li>";
        }).join("");
    }

    function updateTurnInfo(turn) {
        currentTurn = turn;
        const turnInfo = document.getElementById("turnInfo");
        if (turn === userId) {
            turnInfo.textContent = "It's your turn";
        } else {
            turnInfo.textContent = "Waiting for opponent's move";
        }
    }
    </script>
</body>
</html>
`;

export default {
    async fetch(request, env) {
        var url = new URL(request.url);
        var path = url.pathname.split('/');

        if (path[1] === 'join') {
            return this.handleJoin(request, env, path[2]);
        } else if (path[1] === 'poll') {
            return this.handlePoll(request, env, path[2], parseInt(path[3]));
        } else if (path[1] === 'send') {
            return this.handleSend(request, env, path[2]);
        }

        return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    },

    async handleJoin(request, env, roomId) {
        var userId = 'User-' + Math.random().toString(36).substr(2, 9);
        var roomInfo = await env.GOMOKU_ROOMS.get(roomId, "json") || { users: [], messages: [], board: Array(15).fill().map(() => Array(15).fill(null)), currentTurn: null };
        
        if (roomInfo.users.length < 2) {
            roomInfo.users.push(userId);
            if (roomInfo.users.length === 1) {
                roomInfo.currentTurn = userId;
            }
            await env.GOMOKU_ROOMS.put(roomId, JSON.stringify(roomInfo), {expirationTtl: 600});

            var joinMessage = {
                id: roomInfo.messages.length + 1,
                type: "userJoined",
                userId: userId,
                users: roomInfo.users
            };
            roomInfo.messages.push(joinMessage);
            await env.GOMOKU_ROOMS.put(roomId, JSON.stringify(roomInfo), {expirationTtl: 600});
            return new Response(JSON.stringify({
                userId: userId,
                users: roomInfo.users,
                currentTurn: roomInfo.currentTurn
            }), { headers: { 'Content-Type': 'application/json' } });
        } else {
            return new Response(JSON.stringify({
                error: "Room is full"
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
    },

    async handlePoll(request, env, roomId, lastMessageId) {
        var roomInfo = await env.GOMOKU_ROOMS.get(roomId, "json");
        var newMessages = roomInfo.messages.filter(m => m.id > lastMessageId);

        return new Response(JSON.stringify({
            messages: newMessages,
            users: roomInfo.users,
            currentTurn: roomInfo.currentTurn
        }), { headers: { 'Content-Type': 'application/json' } });
    },

    async handleSend(request, env, roomId) {
        var message = await request.json();
        var roomInfo = await env.GOMOKU_ROOMS.get(roomId, "json");
        
        if (message.type === "move" && message.userId === roomInfo.currentTurn) {
            var newMessage = {
                id: roomInfo.messages.length + 1,
                type: "move",
                userId: message.userId,
                x: message.x,
                y: message.y
            };
            
            roomInfo.board[message.y][message.x] = message.userId;
            
            if (this.checkWin(roomInfo.board, message.x, message.y, message.userId)) {
                newMessage.winner = message.userId;
            } else {
                // Switch turn only if the game hasn't ended
                roomInfo.currentTurn = roomInfo.users.find(user => user !== message.userId);
            }
            
            roomInfo.messages.push(newMessage);
            
            await env.GOMOKU_ROOMS.put(roomId, JSON.stringify(roomInfo));
            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }
        
        return new Response(JSON.stringify({ success: false, error: "Invalid move" }), { headers: { 'Content-Type': 'application/json' } });
    },

    checkWin(board, x, y, player) {
        const directions = [
            [1, 0], [0, 1], [1, 1], [1, -1]
        ];
        
        for (let [dx, dy] of directions) {
            let count = 1;
            for (let i = 1; i < 5; i++) {
                if (board[y + i*dy] && board[y + i*dy][x + i*dx] === player) {
                    count++;
                } else {
                    break;
                }
            }
            for (let i = 1; i < 5; i++) {
                if (board[y - i*dy] && board[y - i*dy][x - i*dx] === player) {
                    count++;
                } else {
                    break;
                }
            }
            if (count >= 5) {
                return true;
            }
        }
        return false;
    }
};
