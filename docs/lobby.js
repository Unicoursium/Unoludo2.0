/**
 * lobby.js — Home screen, room creation, room joining, and waiting room.
 * Communicates with Firebase Realtime Database.
 */

(function () {
    "use strict";

    // ---- DOM refs ----
    const homeScreen = document.getElementById("home-screen");
    const lobbyScreen = document.getElementById("lobby-screen");
    const roomScreen = document.getElementById("room-screen");
    const gameScreen = document.getElementById("game-screen");

    const btnSinglePlayer = document.getElementById("btn-single-player");
    const btnMultiPlayer = document.getElementById("btn-multi-player");

    const lobbyBack = document.getElementById("lobby-back");
    const playerNameInput = document.getElementById("player-name-input");
    const btnCreateRoom = document.getElementById("btn-create-room");
    const roomCodeInput = document.getElementById("room-code-input");
    const btnJoinRoom = document.getElementById("btn-join-room");

    const roomLeave = document.getElementById("room-leave");
    const roomCodeValue = document.getElementById("room-code-value");
    const btnCopyCode = document.getElementById("btn-copy-code");
    const roomPlayerList = document.getElementById("room-player-list");
    const roomStatus = document.getElementById("room-status");

    // ---- State ----
    let currentRoomId = null;
    let currentPlayerIndex = null;
    let currentPlayers = {};
    let roomListener = null;
    let gameStartCallback = null;

    const PLAYER_COLOURS = ["#4d96ff", "#6bcb77", "#ff6b6b", "#ffd93d"];

    // ---- Screen management ----
    function showScreen(screen) {
        [homeScreen, lobbyScreen, roomScreen, gameScreen].forEach(function (s) {
            s.classList.add("hidden");
        });
        screen.classList.remove("hidden");
    }

    // ---- Generate 4-digit room code ----
    function generateRoomCode() {
        var code = "";
        for (var i = 0; i < 4; i++) {
            code += Math.floor(Math.random() * 10).toString();
        }
        return code;
    }

    // ---- Room code validation ----
    function isValidRoomCode(code) {
        return /^\d{4}$/.test(code);
    }

    // ---- Update player list UI ----
    function renderPlayerList(players) {
        roomPlayerList.innerHTML = "";
        var keys = Object.keys(players).sort();
        keys.forEach(function (key) {
            var p = players[key];
            var li = document.createElement("li");
            var dot = document.createElement("span");
            dot.className = "player-dot";
            dot.style.background = PLAYER_COLOURS[parseInt(key)] || "#999";

            var name = document.createElement("span");
            name.textContent = p.name;

            var label = document.createElement("span");
            label.className = "player-label";
            label.textContent = "P" + (parseInt(key) + 1);

            li.appendChild(dot);
            li.appendChild(name);
            li.appendChild(label);
            roomPlayerList.appendChild(li);
        });
    }

    // ---- Create room ----
    function createRoom() {
        var name = playerNameInput.value.trim() || "Player 1";
        var code = generateRoomCode();

        var roomRef = db.ref("rooms/" + code);

        roomRef.once("value", function (snapshot) {
            if (snapshot.exists()) {
                // Code collision, try again
                createRoom();
                return;
            }

            var roomData = {
                status: "waiting",
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                players: {
                    "0": {
                        name: name,
                        joinedAt: firebase.database.ServerValue.TIMESTAMP
                    }
                }
            };

            roomRef.set(roomData).then(function () {
                currentRoomId = code;
                currentPlayerIndex = 0;
                roomCodeValue.textContent = code;
                showScreen(roomScreen);
                roomStatus.textContent = "Waiting for players...";
                startRoomListener(code);
            });
        });
    }

    // ---- Join room ----
    function joinRoom() {
        var code = roomCodeInput.value.trim();
        var name = playerNameInput.value.trim() || "Player 2";

        if (!isValidRoomCode(code)) {
            alert("Please enter a valid 4-digit code.");
            return;
        }

        var roomRef = db.ref("rooms/" + code);

        roomRef.once("value", function (snapshot) {
            if (!snapshot.exists()) {
                alert("Room not found. Check the code and try again.");
                return;
            }

            var room = snapshot.val();
            if (room.status !== "waiting") {
                alert("This game has already started.");
                return;
            }

            var playerCount = Object.keys(room.players).length;
            if (playerCount >= 4) {
                alert("This room is full.");
                return;
            }

            var newIndex = playerCount;
            var playerUpdate = {};
            playerUpdate["rooms/" + code + "/players/" + newIndex] = {
                name: name,
                joinedAt: firebase.database.ServerValue.TIMESTAMP
            };

            db.ref().update(playerUpdate).then(function () {
                currentRoomId = code;
                currentPlayerIndex = newIndex;
                roomCodeValue.textContent = code;
                showScreen(roomScreen);
                roomStatus.textContent = "Waiting for players...";
                startRoomListener(code);
            });
        });
    }

    // ---- Listen for room changes ----
    function startRoomListener(code) {
        if (roomListener) {
            db.ref("rooms/" + code).off("value", roomListener);
        }

        roomListener = db.ref("rooms/" + code).on("value", function (snapshot) {
            var room = snapshot.val();
            if (!room) {
                alert("Room has been closed.");
                leaveRoom();
                return;
            }

            currentPlayers = room.players || {};
            renderPlayerList(currentPlayers);

            var playerCount = Object.keys(currentPlayers).length;
            roomStatus.textContent = "Waiting for players... (" + playerCount + "/4)";

            // Auto-start when room is full and still waiting (creator only, use transaction to prevent race)
            if (playerCount >= 4 && room.status === "waiting" && currentPlayerIndex === 0) {
                db.ref("rooms/" + code + "/status").transaction(function (currentStatus) {
                    if (currentStatus === "waiting") {
                        return "playing";
                    }
                    return currentStatus;
                });
            }

            if (room.status === "playing") {
                // Game started — notify main.js
                if (roomListener) {
                    db.ref("rooms/" + code).off("value", roomListener);
                    roomListener = null;
                }
                if (gameStartCallback) {
                    gameStartCallback(code, currentPlayerIndex);
                }
                return;
            }
        });
    }

    // ---- Leave room ----
    function leaveRoom() {
        if (roomListener && currentRoomId) {
            db.ref("rooms/" + currentRoomId).off("value", roomListener);
            roomListener = null;
        }

        // If we're the creator (index 0) and no one else joined, delete the room
        if (currentPlayerIndex === 0 && Object.keys(currentPlayers).length <= 1 && currentRoomId) {
            db.ref("rooms/" + currentRoomId).remove();
        }

        currentRoomId = null;
        currentPlayerIndex = null;
        currentPlayers = {};
        showScreen(lobbyScreen);
    }

    // ---- Start the game (creator only) ----
    function startGame() {
        if (currentPlayerIndex !== 0) return;

        var roomRef = db.ref("rooms/" + currentRoomId);
        roomRef.update({ status: "playing" });
    }

    // ---- Event bindings ----
    btnSinglePlayer.addEventListener("click", function () {
        showScreen(gameScreen);
        if (window.UnoludoApp && window.UnoludoApp.startSinglePlayer) {
            window.UnoludoApp.startSinglePlayer();
        }
    });

    btnMultiPlayer.addEventListener("click", function () {
        showScreen(lobbyScreen);
    });

    lobbyBack.addEventListener("click", function () {
        showScreen(homeScreen);
    });

    btnCreateRoom.addEventListener("click", function () {
        createRoom();
    });

    btnJoinRoom.addEventListener("click", function () {
        joinRoom();
    });

    roomCodeInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            joinRoom();
        }
    });

    roomLeave.addEventListener("click", function () {
        leaveRoom();
    });

    btnCopyCode.addEventListener("click", function () {
        if (currentRoomId) {
            navigator.clipboard.writeText(currentRoomId).then(function () {
                btnCopyCode.textContent = "Copied!";
                setTimeout(function () {
                    btnCopyCode.textContent = "Copy";
                }, 1500);
            });
        }
    });

    // ---- Public API ----
    window.UnoludoLobby = {
        showScreen: showScreen,
        getHomeScreen: function () { return homeScreen; },
        getGameScreen: function () { return gameScreen; },
        getCurrentRoomId: function () { return currentRoomId; },
        getCurrentPlayerIndex: function () { return currentPlayerIndex; },
        startGame: startGame,
        onGameStart: function (callback) { gameStartCallback = callback; }
    };

    // Show home screen on load
    showScreen(homeScreen);
})();
