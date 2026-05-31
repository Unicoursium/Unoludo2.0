/**
 * lobby.js — Home screen, room creation, room joining, and waiting room.
 * Communicates with Firebase Realtime Database.
 */

(function () {
    "use strict";

    // ---- DOM refs ----
    var homeScreen = document.getElementById("home-screen");
    var lobbyScreen = document.getElementById("lobby-screen");
    var roomScreen = document.getElementById("room-screen");
    var gameScreen = document.getElementById("game-screen");

    var btnSinglePlayer = document.getElementById("btn-single-player");
    var btnMultiPlayer = document.getElementById("btn-multi-player");

    var lobbyBack = document.getElementById("lobby-back");
    var playerNameInput = document.getElementById("player-name-input");
    var btnCreateRoom = document.getElementById("btn-create-room");
    var roomCodeInput = document.getElementById("room-code-input");
    var btnJoinRoom = document.getElementById("btn-join-room");

    var roomLeave = document.getElementById("room-leave");
    var roomCodeValue = document.getElementById("room-code-value");
    var btnCopyCode = document.getElementById("btn-copy-code");
    var roomPlayerList = document.getElementById("room-player-list");
    var roomStatus = document.getElementById("room-status");

    var cpuAddArea = document.getElementById("cpu-add-area");
    var btnAddCpu = document.getElementById("btn-add-cpu");
    var btnStartGame = document.getElementById("btn-start-game");

    // ---- State ----
    var currentRoomId = null;
    var currentPlayerIndex = null;
    var currentPlayers = {};
    var roomListener = null;
    var listenerRoomId = null;
    var gameStartCallback = null;

    var PLAYER_COLOURS = ["#4d96ff", "#6bcb77", "#ff6b6b", "#ffd93d"];
    var CPU_NAMES = ["CPU Green", "CPU Red", "CPU Yellow"];
    var CPU_COUNT = 0; // local counter for naming

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

    // ---- Check if player is host ----
    function isHost() {
        return currentPlayerIndex === 0;
    }

    // ---- Count human and CPU players ----
    function countPlayers(players) {
        var human = 0;
        var cpu = 0;
        Object.keys(players).forEach(function (key) {
            if (players[key].isCPU) {
                cpu++;
            } else {
                human++;
            }
        });
        return { human: human, cpu: cpu, total: human + cpu };
    }

    // ---- Update player list UI ----
    function renderPlayerList(players) {
        roomPlayerList.innerHTML = "";
        var keys = Object.keys(players).sort();
        keys.forEach(function (key) {
            var p = players[key];
            var li = document.createElement("li");
            if (p.isCPU) {
                li.className = "cpu-player-item";
            }

            var dot = document.createElement("span");
            dot.className = "player-dot";
            dot.style.background = PLAYER_COLOURS[parseInt(key)] || "#999";

            var name = document.createElement("span");
            if (p.isCPU) {
                name.innerHTML = "🤖 " + p.name + ' <span class="cpu-tag">CPU</span>';
            } else {
                name.textContent = p.name;
            }

            var label = document.createElement("span");
            label.className = "player-label";
            label.textContent = "P" + (parseInt(key) + 1);

            li.appendChild(dot);
            li.appendChild(name);
            li.appendChild(label);

            // Host can remove CPU players (but not human players)
            if (isHost() && p.isCPU) {
                var removeBtn = document.createElement("button");
                removeBtn.className = "cpu-remove-btn";
                removeBtn.textContent = "✕";
                removeBtn.title = "Remove CPU";
                removeBtn.addEventListener("click", function () {
                    removeCpuPlayer(key);
                });
                li.appendChild(removeBtn);
            }

            roomPlayerList.appendChild(li);
        });

        // Show/hide add CPU button (host only, if slots available)
        if (isHost() && keys.length < 4) {
            cpuAddArea.style.display = "";
        } else {
            cpuAddArea.style.display = "none";
        }

        // Show/hide start game button (host only, all 4 slots must be filled)
        if (isHost() && keys.length >= 4) {
            btnStartGame.style.display = "";
        } else {
            btnStartGame.style.display = "none";
        }
    }

    // ---- Add CPU player ----
    function addCpuPlayer() {
        if (!isHost() || !currentRoomId) return;

        var keys = Object.keys(currentPlayers).sort();
        if (keys.length >= 4) return;

        // Find the lowest empty slot
        var usedSlots = keys.map(function (k) { return parseInt(k); });
        var newSlot = -1;
        for (var i = 0; i < 4; i++) {
            if (usedSlots.indexOf(i) === -1) {
                newSlot = i;
                break;
            }
        }
        if (newSlot === -1) return;

        // Pick a name based on the slot's colour
        var colourNames = ["Blue", "Green", "Red", "Yellow"];
        var cpuName = "CPU " + colourNames[newSlot];

        var roomRef = db.ref("rooms/" + currentRoomId);
        var updates = {};
        updates["players/" + newSlot] = {
            name: cpuName,
            isCPU: true,
            addedAt: firebase.database.ServerValue.TIMESTAMP
        };
        updates["playersCount"] = keys.length + 1;

        roomRef.update(updates);
    }

    // ---- Remove CPU player ----
    function removeCpuPlayer(slotKey) {
        if (!isHost() || !currentRoomId) return;

        var roomRef = db.ref("rooms/" + currentRoomId);
        var updates = {};
        updates["players/" + slotKey] = null;
        updates["playersCount"] = Object.keys(currentPlayers).length - 1;

        roomRef.update(updates);
    }

    // ---- Create room ----
    function createRoom() {
        var name = playerNameInput.value.trim() || "Player 1";
        var code = generateRoomCode();

        var roomRef = db.ref("rooms/" + code);

        roomRef.once("value", function (snapshot) {
            if (snapshot.exists()) {
                createRoom();
                return;
            }

            var roomData = {
                status: "waiting",
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                playersCount: 1,
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

        // First check if room exists and is waiting
        roomRef.once("value", function (roomSnap) {
            var room = roomSnap.val();
            if (!room || room.status !== "waiting") {
                if (!room) {
                    alert("Room not found. Check the code and try again.");
                } else {
                    alert("This game has already started.");
                }
                return;
            }

            var players = room.players || {};
            var keys = Object.keys(players);
            if (keys.length >= 4) {
                alert("Room is full.");
                return;
            }

            // Find the lowest empty slot
            var usedSlots = keys.map(function (k) { return parseInt(k); });
            var newIndex = -1;
            for (var i = 0; i < 4; i++) {
                if (usedSlots.indexOf(i) === -1) {
                    newIndex = i;
                    break;
                }
            }
            if (newIndex === -1) {
                alert("Room is full.");
                return;
            }

            // Write the new player and update count
            var updates = {};
            updates["rooms/" + code + "/players/" + newIndex] = {
                name: name,
                joinedAt: firebase.database.ServerValue.TIMESTAMP
            };
            updates["rooms/" + code + "/playersCount"] = keys.length + 1;

            db.ref().update(updates).then(function () {
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
        var previousRoomId = listenerRoomId;
        if (roomListener) {
            db.ref("rooms/" + previousRoomId).off("value", roomListener);
        }
        listenerRoomId = code;

        roomListener = db.ref("rooms/" + code).on("value", function (snapshot) {
            var room = snapshot.val();
            if (!room) {
                alert("Room has been closed.");
                leaveRoom();
                return;
            }

            currentPlayers = room.players || {};
            renderPlayerList(currentPlayers);

            var counts = countPlayers(currentPlayers);
            roomStatus.textContent = "Waiting for players... (" + counts.total + "/4)";

            console.log("[Lobby] Room update: status=" + room.status + " players=" + counts.total + " myIndex=" + currentPlayerIndex);

            if (room.status === "playing") {
                console.log("[Lobby] Game is playing! Triggering callback...");
                if (roomListener) {
                    db.ref("rooms/" + code).off("value", roomListener);
                    roomListener = null;
                }
                if (gameStartCallback) {
                    // Build the definitive playerKinds array from room data
                    // Every client must use the SAME array for consistency
                    var playerKinds = ["cpu", "cpu", "cpu", "cpu"];
                    Object.keys(currentPlayers).forEach(function (key) {
                        var idx = parseInt(key);
                        if (currentPlayers[key].isCPU) {
                            playerKinds[idx] = "cpu";
                        } else {
                            playerKinds[idx] = "human";
                        }
                    });
                    console.log("[Lobby] Calling gameStartCallback with code=" + code + " index=" + currentPlayerIndex + " playerKinds=" + JSON.stringify(playerKinds));
                    gameStartCallback(code, currentPlayerIndex, playerKinds);
                } else {
                    console.log("[Lobby] WARNING: gameStartCallback is not set!");
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
            listenerRoomId = null;
        }

        // Remove this player from Firebase
        if (currentRoomId !== null && currentPlayerIndex !== null) {
            db.ref("rooms/" + currentRoomId + "/players/" + currentPlayerIndex).remove();
            // Update playersCount based on remaining players
            var remaining = Object.keys(currentPlayers).filter(function (k) {
                return parseInt(k) !== currentPlayerIndex;
            }).length;
            db.ref("rooms/" + currentRoomId + "/playersCount").set(remaining);
        }

        // Only remove the whole room if it's the host (index 0) and no other players remain
        if (currentPlayerIndex === 0 && currentRoomId) {
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

    btnAddCpu.addEventListener("click", function () {
        addCpuPlayer();
    });

    btnStartGame.addEventListener("click", function () {
        startGame();
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
