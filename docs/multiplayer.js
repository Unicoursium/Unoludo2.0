/**
 * multiplayer.js — Multiplayer game synchronization via Firebase Realtime Database.
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
    var lastSyncedVersion = null;

    function init(roomIdParam, playerIndex) {
        destroy();
        roomId = roomIdParam;
        myIndex = playerIndex;
        roomRef = db.ref("rooms/" + roomId);
        startGameStateListener();
        startLastActionListener();
    }

    function startGameStateListener() {
        gameStateListener = roomRef.child("gameState").on("value", function (snapshot) {
            var state = snapshot.val();
            if (state && onStateChangeCallback) {
                lastSyncedVersion = (
                    state.version === undefined
                    ? 0
                    : state.version
                );
                onStateChangeCallback(state);
            }
        });
    }

    function startLastActionListener() {
        lastActionListener = roomRef.child("lastAction").on("value", function (snapshot) {
            var action = snapshot.val();
            if (action && onTurnChangeCallback) {
                onTurnChangeCallback(action);
            }
        });
    }

    function setInitialState(state) {
        if (!roomRef) return Promise.reject("No room");
        var flatState = flattenState(state);
        flatState.version = 0;
        lastSyncedVersion = 0;
        return firebaseReady.then(function () {
            return roomRef.child("gameState").set(flatState);
        }).then(function () {
            return roomRef.update({
                currentTurn: 0,
                status: "playing"
            });
        });
    }

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

    function updateGameState(newState, nextTurn) {
        if (!roomRef) return Promise.reject("No room");
        var flatState = flattenState(newState);
        var expectedVersion = (
            lastSyncedVersion === null
            ? 0
            : lastSyncedVersion
        );
        var nextVersion = expectedVersion + 1;

        flatState.version = nextVersion;

        return firebaseReady.then(function () {
            return new Promise(function (resolve, reject) {
                roomRef.child("gameState").transaction(function (remoteState) {
                    var remoteVersion;

                    if (!remoteState) {
                        return;
                    }

                    remoteVersion = (
                        remoteState.version === undefined
                        ? 0
                        : remoteState.version
                    );

                    if (remoteVersion !== expectedVersion) {
                        return;
                    }

                    return flatState;
                }, function (error, committed, snapshot) {
                    if (error) {
                        reject(error);
                        return;
                    }

                    if (!committed) {
                        resolve({
                            committed: false,
                            expectedVersion: expectedVersion,
                            remoteState: snapshot ? snapshot.val() : undefined
                        });
                        return;
                    }

                    lastSyncedVersion = nextVersion;

                    roomRef.update({
                        currentTurn: nextTurn
                    }).then(function () {
                        resolve({
                            committed: true,
                            version: nextVersion
                        });
                    }).catch(reject);
                }, false);
            });
        });
    }

    function isMyTurn(currentTurn) {
        return currentTurn === myIndex;
    }

    function getMyIndex() { return myIndex; }
    function getRoomId() { return roomId; }
    function getSyncedVersion() { return lastSyncedVersion; }

    // ---- Flatten state for Firebase (arrays -> objects with numeric keys) ----
    function removeUndefined(obj) {
        if (obj === null || obj === undefined) return undefined;
        if (typeof obj !== "object") return obj;
        if (Array.isArray(obj)) {
            var arr = obj
                .map(function (item) { return removeUndefined(item); })
                .filter(function (item) { return item !== undefined; });
            return arr;
        }
        var result = {};
        var keys = Object.keys(obj);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var val = removeUndefined(obj[key]);
            if (val !== undefined) {
                result[key] = val;
            }
        }
        return result;
    }

    function flattenState(state) {
        if (!state) return state;
        var flat = {};
        for (var key in state) {
            // Firebase rejects undefined values — skip them
            if (state[key] === undefined) continue;
            flat[key] = state[key];
        }
        if (state.players && Array.isArray(state.players)) {
            flat.players = {};
            state.players.forEach(function (player, i) {
                var p = {};
                for (var pk in player) {
                    if ((pk === "hand" || pk === "planes") && Array.isArray(player[pk])) {
                        p[pk] = arrayToObject(player[pk]);
                    } else {
                        p[pk] = player[pk];
                    }
                }
                flat.players[i] = p;
            });
        }
        if (state.discard_pile && Array.isArray(state.discard_pile)) {
            flat.discard_pile = arrayToObject(state.discard_pile);
        }
        if (state.draw_pile && Array.isArray(state.draw_pile)) {
            flat.draw_pile = arrayToObject(state.draw_pile);
        }
        if (state.log && Array.isArray(state.log)) {
            flat.log = arrayToObject(state.log);
        }
        return removeUndefined(flat);
    }

    // ---- Unflatten state from Firebase (objects -> arrays) ----
    function unflattenState(state) {
        if (!state) return state;
        var result = {};
        for (var key in state) {
            if (key === "players") {
                result.players = objectToArray(state.players).map(function (player) {
                    var p = {};
                    for (var pk in player) {
                        if (pk === "hand" || pk === "planes") {
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

    function arrayToObject(arr) {
        if (!arr || !Array.isArray(arr)) return arr;
        var obj = {};
        arr.forEach(function (item, i) { obj[i] = item; });
        return obj;
    }

    function objectToArray(obj) {
        if (!obj) return [];
        if (Array.isArray(obj)) return obj;
        var keys = Object.keys(obj).sort(function (a, b) { return parseInt(a) - parseInt(b); });
        return keys.map(function (key) { return obj[key]; });
    }

    function destroy() {
        if (roomRef) {
            if (gameStateListener) roomRef.child("gameState").off("value", gameStateListener);
            if (lastActionListener) roomRef.child("lastAction").off("value", lastActionListener);
        }
        gameStateListener = null;
        lastActionListener = null;
        lastSyncedVersion = null;
        roomRef = null;
        roomId = null;
        myIndex = null;
    }

    window.UnoludoMultiplayer = {
        init: init,
        setInitialState: setInitialState,
        submitAction: submitAction,
        updateGameState: updateGameState,
        isMyTurn: isMyTurn,
        getMyIndex: getMyIndex,
        getRoomId: getRoomId,
        getSyncedVersion: getSyncedVersion,
        unflattenState: unflattenState,
        destroy: destroy,
        onStateChange: function (callback) { onStateChangeCallback = callback; },
        onTurnChange: function (callback) { onTurnChangeCallback = callback; }
    };
})();
