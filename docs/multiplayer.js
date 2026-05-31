/**
 * multiplayer.js — Multiplayer game synchronization via Firebase Realtime Database.
 * 
 * Flow:
 * 1. Join a room → get roomRef
 * 2. Initialize game state → write to Firebase
 * 3. Each player listens to gameState changes via onValue
 * 4. On player action → validate turn → update gameState in Firebase
 * 5. All clients receive update → re-render
 */

(function () {
    "use strict";

    var roomRef = null;
    var roomId = null;
    var myIndex = null;
    var gameStateListener = null;
    var lastActionListener = null;
    var onStateChangeCallback = null;
    var onTurnChangeCallback = null;
    var isProcessing = false;

    // ---- Initialize multiplayer for a room ----
    function init(roomIdParam, playerIndex) {
        roomId = roomIdParam;
        myIndex = playerIndex;
        roomRef = db.ref("rooms/" + roomId);

        // Start listening to game state changes
        startGameStateListener();
        startLastActionListener();
    }

    // ---- Listen to game state ----
    function startGameStateListener() {
        gameStateListener = roomRef.child("gameState").on("value", function (snapshot) {
            var state = snapshot.val();
            if (state && onStateChangeCallback) {
                onStateChangeCallback(state);
            }
        });
    }

    // ---- Listen to last action (for action-specific triggers) ----
    function startLastActionListener() {
        lastActionListener = roomRef.child("lastAction").on("value", function (snapshot) {
            var action = snapshot.val();
            if (action && onTurnChangeCallback) {
                onTurnChangeCallback(action);
            }
        });
    }

    // ---- Write initial game state ----
    function setInitialState(state) {
        if (!roomRef) return Promise.reject("No room");

        // Firebase doesn't handle nested arrays well — convert to objects
        var flatState = flattenState(state);

        return roomRef.child("gameState").set(flatState).then(function () {
            return roomRef.update({
                currentTurn: 0,
                status: "playing"
            });
        });
    }

    // ---- Submit an action ----
    function submitAction(actionType, data) {
        if (!roomRef) return Promise.reject("No room");
        if (isProcessing) return Promise.reject("Already processing");

        isProcessing = true;

        var action = Object.assign({
            type: actionType,
            player: myIndex,
            timestamp: Date.now()
        }, data);

        return roomRef.child("lastAction").set(action).then(function () {
            isProcessing = false;
        }).catch(function (err) {
            isProcessing = false;
            throw err;
        });
    }

    // ---- Update game state (called after processing an action) ----
    function updateGameState(newState, nextTurn) {
        if (!roomRef) return Promise.reject("No room");

        var flatState = flattenState(newState);

        var updates = {
            gameState: flatState,
            currentTurn: nextTurn
        };

        return roomRef.update(updates);
    }

    // ---- Check if it's my turn ----
    function isMyTurn(currentTurn) {
        return currentTurn === myIndex;
    }

    // ---- Get my player index ----
    function getMyIndex() {
        return myIndex;
    }

    // ---- Get room info ----
    function getRoomId() {
        return roomId;
    }

    // ---- Flatten state for Firebase (arrays → objects with numeric keys) ----
    function flattenState(state) {
        if (!state) return state;

        var flat = {};
        for (var key in state) {
            if (Array.isArray(state[key])) {
                flat[key] = arrayToObject(state[key]);
            } else if (typeof state[key] === "object" && state[key] !== null && !Array.isArray(state[key])) {
                // Deep flatten players array
                flat[key] = state[key];
            } else {
                flat[key] = state[key];
            }
        }

        // Flatten players specially
        if (state.players && Array.isArray(state.players)) {
            flat.players = {};
            state.players.forEach(function (player, i) {
                var p = {};
                for (var pk in player) {
                    if (pk === "hand" && Array.isArray(player[pk])) {
                        p[pk] = arrayToObject(player[pk]);
                    } else if (pk === "planes" && Array.isArray(player[pk])) {
                        p[pk] = arrayToObject(player[pk]);
                    } else {
                        p[pk] = player[pk];
                    }
                }
                flat.players[i] = p;
            });
        }

        // Flatten discard_pile
        if (state.discard_pile && Array.isArray(state.discard_pile)) {
            flat.discard_pile = arrayToObject(state.discard_pile);
        }

        // Flatten draw_pile
        if (state.draw_pile && Array.isArray(state.draw_pile)) {
            flat.draw_pile = arrayToObject(state.draw_pile);
        }

        // Flatten log
        if (state.log && Array.isArray(state.log)) {
            flat.log = arrayToObject(state.log);
        }

        return flat;
    }

    // ---- Unflatten state from Firebase (objects → arrays) ----
    function unflattenState(state) {
        if (!state) return state;

        var result = {};
        for (var key in state) {
            if (key === "players") {
                result.players = objectToArray(state.players).map(function (player) {
                    var p = {};
                    for (var pk in player) {
                        if (pk === "hand") {
                            p[pk] = objectToArray(player[pk]);
                        } else if (pk === "planes") {
                            p[pk] = objectToArray(player[pk]);
                        } else {
                            p[pk] = player[pk];
                        }
                    }
                    return p;
                });
            } else if (key === "discard_pile" || key === "draw_pile" || key === "log") {
                result[key] = objectToArray(state[key]);
            } else {
                result[key] = state[key];
            }
        }

        return result;
    }

    // ---- Utility: Array → Object with numeric keys ----
    function arrayToObject(arr) {
        if (!arr || !Array.isArray(arr)) return arr;
        var obj = {};
        arr.forEach(function (item, i) {
            obj[i] = item;
        });
        return obj;
    }

    // ---- Utility: Object with numeric keys → Array ----
    function objectToArray(obj) {
        if (!obj) return [];
        if (Array.isArray(obj)) return obj;

        var keys = Object.keys(obj).sort(function (a, b) {
            return parseInt(a) - parseInt(b);
        });

        return keys.map(function (key) {
            return obj[key];
        });
    }

    // ---- Cleanup ----
    function destroy() {
        if (roomRef) {
            if (gameStateListener) {
                roomRef.child("gameState").off("value", gameStateListener);
            }
            if (lastActionListener) {
                roomRef.child("lastAction").off("value", lastActionListener);
            }
        }
        roomRef = null;
        roomId = null;
        myIndex = null;
        gameStateListener = null;
        lastActionListener = null;
    }

    // ---- Public API ----
    window.UnoludoMultiplayer = {
        init: init,
        setInitialState: setInitialState,
        submitAction: submitAction,
        updateGameState: updateGameState,
        isMyTurn: isMyTurn,
        getMyIndex: getMyIndex,
        getRoomId: getRoomId,
        unflattenState: unflattenState,
        destroy: destroy,

        onStateChange: function (callback) {
            onStateChangeCallback = callback;
        },
        onTurnChange: function (callback) {
            onTurnChangeCallback = callback;
        }
    };
})();
