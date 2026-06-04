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

    var btnCopyLink = document.getElementById("btn-copy-link");
    var roomShareSection = document.getElementById("room-share-section");
    var roomQrCode = document.getElementById("room-qr-code");

    // ---- State ----
    var currentRoomId = null;
    var currentPlayerIndex = null;
    var currentHostIndex = 0;
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
        return (
            currentPlayerIndex !== null &&
            currentPlayerIndex === currentHostIndex
        );
    }

    // ---- URL routing helpers ----
    var BASE_URL = "https://unoludo.unicoy.uk";

    function getRoomUrl(code) {
        return BASE_URL + "/" + (code || currentRoomId);
    }

    function updateRoomUrl(code) {
        if (window.history && window.history.pushState) {
            window.history.pushState(null, "", "/" + (code || currentRoomId));
        }
    }

    function clearRoomUrl() {
        if (window.history && window.history.pushState) {
            window.history.pushState(null, "", "/");
        }
    }

    function showQrCode(code) {
        var url = getRoomUrl(code);
        roomQrCode.src =
            "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" +
            encodeURIComponent(url);
        roomShareSection.style.display = "";
    }

    function hideQrCode() {
        roomShareSection.style.display = "none";
        roomQrCode.src = "";
    }

    function getRoomParam() {
        var params = new URLSearchParams(window.location.search);
        return params.get("room");
    }

    function clearRoomParam() {
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, "", "/");
        }
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

        firebaseReady.then(function (user) {
            var roomRef = db.ref("rooms/" + currentRoomId);
            var colourNames = ["Blue", "Green", "Red", "Yellow"];

            roomRef.once("value", function (snapshot) {
                var room = snapshot.val();
                var players;
                var keys;
                var usedSlots;
                var newSlot = -1;
                var i;

                if (!room || room.status !== "waiting") {
                    return;
                }

                players = room.players || {};
                keys = Object.keys(players);

                if (keys.length >= 4) {
                    return;
                }

                usedSlots = keys.map(function (k) { return parseInt(k); });
                for (i = 0; i < 4; i++) {
                    if (usedSlots.indexOf(i) === -1) {
                        newSlot = i;
                        break;
                    }
                }

                if (newSlot === -1) {
                    return;
                }

                roomRef.child("players/" + newSlot).transaction(function (slot) {
                    if (slot !== null) {
                        return;
                    }

                    return {
                        name: "CPU " + colourNames[newSlot],
                        uid: user.uid,
                        isCPU: true,
                        addedAt: Date.now()
                    };
                }, function (error, committed) {
                    if (!error && committed) {
                        updatePlayersCount(currentRoomId);
                    }
                });
            });
        }).catch(function () {
            alert("Could not sign in to Firebase. Please refresh and try again.");
        });
    }

    function updatePlayersCount(roomId) {
        db.ref("rooms/" + roomId + "/players").once("value", function (snapshot) {
            var players = snapshot.val() || {};
            db.ref("rooms/" + roomId + "/playersCount").set(
                Object.keys(players).length
            );
        });
    }

    // ---- Remove CPU player ----
    function removeCpuPlayer(slotKey) {
        if (!isHost() || !currentRoomId) return;

        db.ref("rooms/" + currentRoomId + "/players/" + slotKey)
            .remove()
            .then(function () {
                updatePlayersCount(currentRoomId);
            });
    }

    // ---- Create room ----
    function createRoom() {
        var name = playerNameInput.value.trim() || "Player 1";
        var code = generateRoomCode();

        firebaseReady.then(function (user) {
            var roomRef = db.ref("rooms/" + code);

            roomRef.once("value", function (snapshot) {
                if (snapshot.exists()) {
                    createRoom();
                    return;
                }

                var roomData = {
                    status: "waiting",
                    hostUid: user.uid,
                    hostIndex: 0,
                    createdAt: firebase.database.ServerValue.TIMESTAMP,
                    playersCount: 1,
                    players: {
                        "0": {
                            name: name,
                            uid: user.uid,
                            joinedAt: firebase.database.ServerValue.TIMESTAMP
                        }
                    }
                };

                roomRef.set(roomData).then(function () {
                    currentRoomId = code;
                    currentPlayerIndex = 0;
                    currentHostIndex = 0;
                    roomCodeValue.textContent = code;
                    showScreen(roomScreen);
                    roomStatus.textContent = "Waiting for players...";
                    updateRoomUrl(code);
                    showQrCode(code);
                    startRoomListener(code);
                });
            });
        }).catch(function () {
            alert("Could not sign in to Firebase. Please refresh and try again.");
        });
    }

    // ---- Join room ----
    function joinRoom() {
        var code = roomCodeInput.value.trim();
        var name = playerNameInput.value.trim() || "Player 2";
        var joinToken = (
            Date.now().toString(36) +
            "-" +
            Math.random().toString(36).slice(2)
        );

        if (!isValidRoomCode(code)) {
            alert("Please enter a valid 4-digit code.");
            return;
        }

        firebaseReady.then(function (user) {
            var roomRef = db.ref("rooms/" + code);

            roomRef.once("value", function (roomSnap) {
                var existingRoom = roomSnap.val();

                if (!existingRoom) {
                    alert("Room not found. Check the code and try again.");
                    return;
                }

                if (existingRoom.status !== "waiting") {
                    alert("This game has already started.");
                    return;
                }

                var players = existingRoom.players || {};
                var keys = Object.keys(players);
                var usedSlots;
                var newIndex = -1;
                var i;

                if (keys.length >= 4) {
                    alert("Room is full.");
                    return;
                }

                usedSlots = keys.map(function (k) { return parseInt(k); });
                for (i = 0; i < 4; i++) {
                    if (usedSlots.indexOf(i) === -1) {
                        newIndex = i;
                        break;
                    }
                }

                if (newIndex === -1) {
                    alert("Room is full.");
                    return;
                }

                roomRef.child("players/" + newIndex).transaction(function (slot) {
                    if (slot !== null) {
                        return;
                    }

                    return {
                        name: name,
                        uid: user.uid,
                        joinToken: joinToken,
                        joinedAt: Date.now()
                    };
                }, function (error, committed, snapshot) {
                    var player;

                    if (error) {
                        alert("Could not join room. Please try again.");
                        return;
                    }

                    if (!committed) {
                        alert("That player slot was just taken. Please try again.");
                        return;
                    }

                    player = snapshot.val();

                    if (!player || player.joinToken !== joinToken) {
                        alert("Could not confirm your player slot. Please try again.");
                        return;
                    }

                    currentRoomId = code;
                    currentPlayerIndex = newIndex;
                    currentHostIndex = (
                        existingRoom.hostIndex === undefined
                        ? 0
                        : existingRoom.hostIndex
                    );
                    updatePlayersCount(code);
                    roomCodeValue.textContent = code;
                    showScreen(roomScreen);
                    roomStatus.textContent = "Waiting for players...";
                    updateRoomUrl(code);
                    showQrCode(code);
                    startRoomListener(code);
                });
            });
        }).catch(function () {
            alert("Could not sign in to Firebase. Please refresh and try again.");
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

            currentHostIndex = (
                room.hostIndex === undefined
                ? 0
                : room.hostIndex
            );
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
                    var playerNames = [
                        "Player 1",
                        "Player 2",
                        "Player 3",
                        "Player 4"
                    ];
                    Object.keys(currentPlayers).forEach(function (key) {
                        var idx = parseInt(key);
                        playerNames[idx] = currentPlayers[key].name || playerNames[idx];
                        if (currentPlayers[key].isCPU) {
                            playerKinds[idx] = "cpu";
                        } else {
                            playerKinds[idx] = "human";
                        }
                    });
                    console.log("[Lobby] Calling gameStartCallback with code=" + code + " index=" + currentPlayerIndex + " playerKinds=" + JSON.stringify(playerKinds));
                    gameStartCallback(
                        code,
                        currentPlayerIndex,
                        playerKinds,
                        playerNames
                    );
                } else {
                    console.log("[Lobby] WARNING: gameStartCallback is not set!");
                }
                return;
            }
        });
    }

    // ---- Leave room ----
    function leaveRoom() {
        var roomId = currentRoomId;
        var playerIndex = currentPlayerIndex;

        if (roomListener && roomId) {
            db.ref("rooms/" + roomId).off("value", roomListener);
            roomListener = null;
            listenerRoomId = null;
        }

        if (roomId !== null && playerIndex !== null) {
            db.ref("rooms/" + roomId).transaction(function (room) {
                var remainingKeys;
                var hostIndex;

                if (!room || !room.players) {
                    return room;
                }

                delete room.players[playerIndex];
                remainingKeys = Object.keys(room.players);

                if (remainingKeys.length === 0) {
                    return null;
                }

                room.playersCount = remainingKeys.length;
                hostIndex = (
                    room.hostIndex === undefined
                    ? 0
                    : room.hostIndex
                );

                if (hostIndex === playerIndex) {
                    room.hostIndex = parseInt(remainingKeys.sort(function (a, b) {
                        return parseInt(a) - parseInt(b);
                    })[0]);
                }

                return room;
            });
        }

        currentRoomId = null;
        currentPlayerIndex = null;
        currentHostIndex = 0;
        currentPlayers = {};
        hideQrCode();
        clearRoomUrl();
        showScreen(lobbyScreen);
    }

    // ---- Start the game (host only) ----
    function startGame() {
        if (!isHost()) return;
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
                    btnCopyCode.textContent = "Copy Code";
                }, 1500);
            });
        }
    });

    btnCopyLink.addEventListener("click", function () {
        if (currentRoomId) {
            navigator.clipboard.writeText(getRoomUrl()).then(function () {
                btnCopyLink.textContent = "Copied!";
                setTimeout(function () {
                    btnCopyLink.textContent = "Copy Link";
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
        getCurrentHostIndex: function () { return currentHostIndex; },
        startGame: startGame,
        onGameStart: function (callback) { gameStartCallback = callback; }
    };

    // ---- Handle ?room= param on page load ----
    var pendingRoom = getRoomParam();
    if (pendingRoom && isValidRoomCode(pendingRoom)) {
        // Clear the URL param so refresh doesn't re-trigger
        clearRoomParam();
        // Pre-fill the room code input and go to lobby
        roomCodeInput.value = pendingRoom;
        showScreen(lobbyScreen);
    } else {
        // Show home screen on load
        showScreen(homeScreen);
    }

    // ---- Handle browser back button ----
    window.addEventListener("popstate", function () {
        if (currentRoomId) {
            // User pressed back while in a room → leave
            leaveRoom();
        } else {
            showScreen(homeScreen);
        }
    });
})();
