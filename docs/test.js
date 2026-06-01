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

const makeMultiState = function (players, topCard, currentPlayer = 0, moods = {}) {
    return Object.freeze({
        draw_pile: Object.freeze([]),
        discard_pile: Object.freeze([topCard]),
        players: Object.freeze(players),
        current_player: currentPlayer,
        active_colour: topCard.colour,
        winner: undefined,
        player_moods: Object.freeze(moods),
        log: Object.freeze([])
    });
};

const makePlayer = function (colour, plane, card) {
    return Object.freeze({
        id: 0,
        name: "Tester",
        colour: colour,
        kind: "human",
        hand: Object.freeze([card]),
        planes: Object.freeze([
            plane,
            ...Unoludo.empty_planes().slice(1)
        ])
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

const deck = Unoludo.create_deck();
assert.equal(deck.length, 220);
assert.equal(deck.filter(function (card) {
    return card.type === "wild";
}).length, 6);
assert.equal(deck.filter(function (card) {
    return card.type === "wild4";
}).length, 6);
assert.equal(deck.filter(function (card) {
    return card.colour === "blue" &&
        card.type === "number" &&
        card.value === 1;
}).length, 4);
assert.equal(deck.filter(function (card) {
    return card.colour === "blue" &&
        card.type === "number" &&
        card.value === 2;
}).length, 7);
assert.equal(deck.filter(function (card) {
    return card.colour === "blue" &&
        card.type === "reverse";
}).length, 1);

assert.deepEqual(Unoludo.jump_positions, {
    blue: {from: 17, to: 29},
    green: {from: 30, to: 42},
    red: {from: 43, to: 3},
    yellow: {from: 4, to: 16}
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

const shieldPlayer = withPlane(
    withHand(basePlayer, [Unoludo.card("blue-0-shield", "number", "blue", 0)]),
    Object.freeze({
        status: "track",
        position: 8,
        shielded: false,
        frozen: false
    })
);
const shieldOpponent = Object.freeze({
    id: 1,
    name: "Opponent",
    colour: "green",
    kind: "human",
    hand: Object.freeze([]),
    planes: Unoludo.empty_planes()
});

state = makeMultiState(
    [shieldPlayer, shieldOpponent],
    Unoludo.card("top-shield", "number", "blue", 5)
);
nextState = Unoludo.play_zero_card(state, "blue-0-shield", 0);
assert.equal(nextState.players[0].planes[0].shielded, 2);

nextState = Unoludo.end_turn(nextState);
assert.equal(nextState.players[0].planes[0].shielded, 2);

nextState = Unoludo.end_turn(nextState);
assert.equal(nextState.players[0].planes[0].shielded, 1);

nextState = Unoludo.end_turn(nextState);
assert.equal(nextState.players[0].planes[0].shielded, 1);

nextState = Unoludo.end_turn(nextState);
assert.equal(nextState.players[0].planes[0].shielded, false);

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

[
    {colour: "blue", start: 15, end: 29},
    {colour: "green", start: 28, end: 42},
    {colour: "red", start: 41, end: 3},
    {colour: "yellow", start: 2, end: 16}
].forEach(function (jumpCase) {
    const card = Unoludo.card(
        jumpCase.colour + "-jump-2",
        "number",
        jumpCase.colour,
        2
    );
    const jumpingPlayer = makePlayer(
        jumpCase.colour,
        Object.freeze({
            status: "track",
            position: jumpCase.start,
            shielded: false,
            frozen: false
        }),
        card
    );
    const jumpState = makeState(
        jumpingPlayer,
        Unoludo.card("top-" + jumpCase.colour, "number", jumpCase.colour, 4)
    );
    const jumpedState = Unoludo.play_number_card(
        jumpState,
        card.id,
        0
    );

    assert.deepEqual(jumpedState.players[0].planes[0], {
        status: "track",
        position: jumpCase.end,
        shielded: false,
        frozen: false
    });
});

const wild4Player = Object.freeze({
    id: 0,
    name: "Wild",
    colour: "blue",
    kind: "human",
    hand: Object.freeze([Unoludo.card("wild4-advance", "wild4", "wild")]),
    planes: Object.freeze([
        Object.freeze({
            status: "track",
            position: 5,
            shielded: false,
            frozen: false
        }),
        Object.freeze({
            status: "gate",
            position: -1,
            shielded: false,
            frozen: false
        }),
        Unoludo.empty_plane(),
        Unoludo.empty_plane()
    ])
});

state = makeState(wild4Player, Unoludo.card("top-wild4", "number", "blue", 4));
nextState = Unoludo.play_wild4_card(
    state,
    "wild4-advance",
    "advance_all",
    "blue"
);

assert.deepEqual(nextState.players[0].planes[0], {
    status: "track",
    position: 9,
    shielded: false,
    frozen: false
});
assert.deepEqual(nextState.players[0].planes[1], {
    status: "track",
    position: 3,
    shielded: false,
    frozen: false
});

const disruptor = Object.freeze({
    id: 0,
    name: "Blue",
    colour: "blue",
    kind: "human",
    hand: Object.freeze([Unoludo.card("blue-skip", "skip", "blue", undefined)]),
    planes: Unoludo.empty_planes()
});
const waitingGreen = Object.freeze({
    id: 1,
    name: "Green",
    colour: "green",
    kind: "human",
    hand: Object.freeze([]),
    planes: Unoludo.empty_planes()
});
const waitingRed = Object.freeze({
    id: 2,
    name: "Red",
    colour: "red",
    kind: "human",
    hand: Object.freeze([]),
    planes: Unoludo.empty_planes()
});
const victim = Object.freeze({
    id: 3,
    name: "Yellow",
    colour: "yellow",
    kind: "human",
    hand: Object.freeze([]),
    planes: Object.freeze([
        Object.freeze({
            status: "track",
            position: 7,
            shielded: false,
            frozen: false
        }),
        ...Unoludo.empty_planes().slice(1)
    ])
});

state = makeMultiState(
    [disruptor, waitingGreen, waitingRed, victim],
    Unoludo.card("top-skip", "skip", "blue", undefined)
);
nextState = Unoludo.play_skip_card(state, "blue-skip", 3, 0);

assert.deepEqual(nextState.player_moods, {
    0: "smug",
    3: "angry"
});

nextState = Unoludo.end_turn(nextState);
assert.equal(nextState.current_player, 1);
assert.deepEqual(nextState.player_moods, {
    0: "smug",
    3: "angry"
});

nextState = Unoludo.end_turn(nextState);
assert.equal(nextState.current_player, 2);
assert.deepEqual(nextState.player_moods, {
    0: "smug",
    3: "angry"
});

nextState = Unoludo.end_turn(nextState);
assert.equal(nextState.current_player, 3);
assert.deepEqual(nextState.player_moods, {
    0: "smug"
});

nextState = Unoludo.end_turn(nextState);
assert.equal(nextState.current_player, 0);
assert.deepEqual(nextState.player_moods, {});

const reversePlayer = Object.freeze({
    id: 0,
    name: "Blue",
    colour: "blue",
    kind: "human",
    hand: Object.freeze([
        Unoludo.card("blue-reverse", "reverse", "blue"),
        Unoludo.card("blue-spare-2", "number", "blue", 2)
    ]),
    planes: Unoludo.empty_planes()
});
const reverseVictim = Object.freeze({
    id: 1,
    name: "Green",
    colour: "green",
    kind: "human",
    hand: Object.freeze([]),
    planes: Object.freeze([
        Object.freeze({
            status: "track",
            position: 17,
            shielded: false,
            frozen: false
        }),
        ...Unoludo.empty_planes().slice(1)
    ])
});

state = makeMultiState(
    [reversePlayer, reverseVictim],
    Unoludo.card("top-reverse", "reverse", "blue")
);
nextState = Unoludo.play_reverse_card(state, "blue-reverse", 1, 0, 4);

assert.deepEqual(nextState.players[0].hand, [
    Unoludo.card("blue-spare-2", "number", "blue", 2)
]);
assert.deepEqual(nextState.players[1].planes[0], {
    status: "track",
    position: 13,
    shielded: false,
    frozen: false
});
assert.deepEqual(nextState.player_moods, {
    0: "smug",
    1: "angry"
});

const drawRefillPlayer = Object.freeze({
    id: 0,
    name: "Blue",
    colour: "blue",
    kind: "human",
    hand: Object.freeze([]),
    planes: Unoludo.empty_planes()
});

state = Object.freeze({
    draw_pile: Object.freeze([Unoludo.card("draw-only", "number", "blue", 1)]),
    discard_pile: Object.freeze([
        Unoludo.card("discard-a", "number", "green", 2),
        Unoludo.card("discard-b", "skip", "yellow"),
        Unoludo.card("discard-top", "number", "red", 4)
    ]),
    players: Object.freeze([drawRefillPlayer]),
    current_player: 0,
    active_colour: "red",
    winner: undefined,
    player_moods: Object.freeze({}),
    log: Object.freeze([])
});
nextState = Unoludo.draw_cards(state, 0, 2);

assert.equal(nextState.players[0].hand.length, 2);
assert.deepEqual(nextState.discard_pile, [
    Unoludo.card("discard-top", "number", "red", 4)
]);
assert.equal(nextState.draw_pile.length, 1);
assert.equal(
    nextState.log.includes("Draw pile was refilled from the discard pile."),
    true
);

assert.equal(
    Unoludo.can_play_on(
        Unoludo.card("blue-6-on-reward", "number", "blue", 6),
        Unoludo.card("reward-top-6", "reward", "wild", 6),
        "red"
    ),
    true
);
assert.equal(
    Unoludo.can_play_on(
        Unoludo.card("blue-5-on-reward", "number", "blue", 5),
        Unoludo.card("reward-top-6", "reward", "wild", 6),
        "red"
    ),
    false
);

console.log("Board V3 movement smoke tests passed.");
