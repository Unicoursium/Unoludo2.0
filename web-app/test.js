import Unoludo from "./unoludo.js";

/*global console*/

const base_state = Unoludo.create_initial_state(["Player 1", "Player 2"], {
    shuffle: false
});

const red_3 = Unoludo.card("test-red-3", "number", "red", 3);

const player_1 = base_state.players[0];
const player_2 = base_state.players[1];

const test_player_1 = Object.freeze({
    id: player_1.id,
    name: player_1.name,
    hand: Object.freeze([red_3]),
    planes: Object.freeze({
        red: Object.freeze({
            status: "track",
            position: 7,
            shielded: false,
            frozen: false
        }),
        yellow: player_1.planes.yellow,
        blue: player_1.planes.blue,
        green: player_1.planes.green
    })
});

const test_player_2 = Object.freeze({
    id: player_2.id,
    name: player_2.name,
    hand: player_2.hand,
    planes: Object.freeze({
        red: Object.freeze({
            status: "track",
            position: 10,
            shielded: true,
            frozen: false
        }),
        yellow: player_2.planes.yellow,
        blue: player_2.planes.blue,
        green: player_2.planes.green
    })
});

let test_state = Unoludo.update_player(base_state, 0, test_player_1);
test_state = Unoludo.update_player(test_state, 1, test_player_2);

const shield_state = Unoludo.play_number_card(
    test_state,
    "test-red-3",
    "red"
);

console.log("Player 1 red after:", shield_state.players[0].planes.red);
console.log("Player 2 red after shielded capture attempt:", shield_state.players[1].planes.red);
console.log("Log:", shield_state.log);