import assert from "node:assert/strict";

import Unoludo from "./unoludo.js";
import UnoludoBoard from "./board_positions.js";

const withPlane = function (player, plane) {
    return Object.freeze({
        id: player.id,
        name: player.name,
        colour: player.colour,
        kind: player.kind,
        hand: player.hand,
        planes: Object.freeze([
            plane,
            ...Unoludo.empty_planes().slice(1)
        ])
    });
};

const withHand = function (player, hand) {
    return Object.freeze({
        id: player.id,
        name: player.name,
        colour: player.colour,
        kind: player.kind,
        hand: Object.freeze(hand),
        planes: player.planes
    });
};

const makeState = function (player, topCard) {
    return Object.freeze({
        draw_pile: Object.freeze([]),
        discard_pile: Object.freeze([topCard]),
        players: Object.freeze([player]),
        current_player: 0,
        active_colour: player.colour,
        winner: undefined,
        log: Object.freeze([])
    });
};

const basePlayer = Object.freeze({
    id: 0,
    name: "Tester",
    colour: "blue",
    kind: "human",
    hand: Object.freeze([Unoludo.card("blue-6", "number", "blue", 6)]),
    planes: Unoludo.empty_planes()
});

assert.equal(Unoludo.track_length, 52);
assert.equal(Unoludo.home_lane_length, 5);
assert.equal(UnoludoBoard.track_positions.length, 52);
assert.equal(UnoludoBoard.home_positions.blue.length, 5);
assert.deepEqual(Unoludo.start_positions, {
    blue: 0,
    green: 13,
    red: 26,
    yellow: 39
});
assert.deepEqual(Unoludo.home_entry_positions, {
    blue: 49,
    green: 10,
    red: 23,
    yellow: 36
});

let state = makeState(basePlayer, Unoludo.card("top-1", "number", "blue", 1));
let nextState = Unoludo.play_number_card(state, "blue-6", 0);

assert.deepEqual(nextState.players[0].planes[0], {
    status: "gate",
    position: -1,
    shielded: false,
    frozen: false
});

let player = withHand(
    nextState.players[0],
    [Unoludo.card("blue-2", "number", "blue", 2)]
);
state = makeState(player, Unoludo.card("top-2", "number", "blue", 4));
nextState = Unoludo.play_number_card(state, "blue-2", 0);

assert.deepEqual(nextState.players[0].planes[0], {
    status: "track",
    position: 1,
    shielded: false,
    frozen: false
});

player = withPlane(
    withHand(basePlayer, [Unoludo.card("blue-1", "number", "blue", 1)]),
    Object.freeze({
        status: "track",
        position: 49,
        shielded: false,
        frozen: false
    })
);
state = makeState(player, Unoludo.card("top-3", "number", "blue", 4));
nextState = Unoludo.play_number_card(state, "blue-1", 0);

assert.deepEqual(nextState.players[0].planes[0], {
    status: "home",
    position: 0,
    shielded: false,
    frozen: false
});

player = withPlane(
    withHand(basePlayer, [Unoludo.card("blue-1-finish", "number", "blue", 1)]),
    Object.freeze({
        status: "home",
        position: 4,
        shielded: false,
        frozen: false
    })
);
state = makeState(player, Unoludo.card("top-4", "number", "blue", 4));
nextState = Unoludo.play_number_card(state, "blue-1-finish", 0);

assert.deepEqual(nextState.players[0].planes[0], {
    status: "finished",
    position: 5,
    shielded: false,
    frozen: false
});

console.log("Board V3 movement smoke tests passed.");
