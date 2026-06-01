/**
 * Unoludo.js is a module to model and play Unoludo,
 * a turn-based board game combining UNO-inspired card play
 * with Ludo-inspired plane movement.
 *
 * @namespace Unoludo
 * @author Unico Yin
 * @version 2025/26
 */
//import R from "./ramda.js";

const Unoludo = Object.create(null);

/**
 * The four colours used by both cards and planes.
 * @memberof Unoludo
 * @readonly
 * @enum {string}
 */
Unoludo.colours = Object.freeze(["blue", "green", "red", "yellow"]);

/**
 * The number values used in Unoludo.
 * 0 is a shield card. 1-6 are movement cards.
 * @memberof Unoludo
 * @readonly
 * @enum {number}
 */
Unoludo.number_values = Object.freeze([0, 1, 2, 3, 4, 5, 6]);

/**
 * A colour used by cards and planes.
 * @memberof Unoludo
 * @typedef {"red" | "yellow" | "blue" | "green"} Colour
 */

/**
 * A card type in Unoludo.
 * @memberof Unoludo
 * @typedef {"number" | "skip" | "reverse" | "draw2" | "wild" | "wild4" | "reward"} CardType
 */

/**
 * A card in the Unoludo deck.
 * @memberof Unoludo
 * @typedef {Object} Card
 * @property {string} id A unique identifier for the card.
 * @property {Unoludo.CardType} type The rule category of the card.
 * @property {(Unoludo.Colour | "wild")} colour The colour of the card, or "wild".
 * @property {number} [value] The number value on a number card.
 */

/**
 * A plane controlled by one player.
 * @memberof Unoludo
 * @typedef {Object} Plane
 * @property {"base" | "gate" | "track" | "home" | "finished"} status The plane's current area.
 * @property {number} position The plane's position. -1 means not on a path.
 * @property {boolean} shielded Whether the plane is protected from being sent back to base.
 * @property {boolean} frozen Whether the plane is unable to move this turn.
 */

/**
 * A player in Unoludo.
 * @memberof Unoludo
 * @typedef {Object} Player
 * @property {number} id The player's id.
 * @property {string} name The player's display name.
 * @property {Unoludo.Card[]} hand The player's current hand.
 * @property {Object} planes The player's planes, indexed by colour.
 */

/**
 * Complete Unoludo game state.
 * @memberof Unoludo
 * @typedef {Object} State
 * @property {Unoludo.Card[]} draw_pile The cards available to draw.
 * @property {Unoludo.Card[]} discard_pile The cards that have been played.
 * @property {Unoludo.Player[]} players The players in turn order.
 * @property {number} current_player The id of the player whose turn it is.
 * @property {(Unoludo.Colour | undefined)} active_colour The colour currently required by the discard pile.
 * @property {(number | undefined)} winner The winning player id, if the game has ended.
 * @property {string[]} log A human-readable game log.
 */

/**
 * Create a card object.
 * @memberof Unoludo
 * @function
 * @param {string} id The card id.
 * @param {Unoludo.CardType} type The card type.
 * @param {(Unoludo.Colour | "wild")} colour The card colour.
 * @param {number} [value] The card number value, if it has one.
 * @returns {Unoludo.Card} A card.
 */
Unoludo.card = function (id, type, colour, value) {
    const card = {
        id: id,
        type: type,
        colour: colour
    };

    if (value !== undefined) {
        card.value = value;
    }

    return Object.freeze(card);
};

/**
 * Create several copies of one card description.
 * @function
 * @param {string} prefix The base id prefix.
 * @param {number} count The number of cards to create.
 * @param {Unoludo.CardType} type The card type.
 * @param {(Unoludo.Colour | "wild")} colour The card colour.
 * @param {number} [value] The card value, if it has one.
 * @returns {Unoludo.Card[]} The created cards.
 */
const create_copies = function (prefix, count, type, colour, value) {
    const cards = [];
    let index = 0;

    while (index < count) {
        cards.push(Unoludo.card(
            prefix + "-" + index,
            type,
            colour,
            value
        ));
        index += 1;
    }

    return Object.freeze(cards);
};

/**
 * Create all coloured cards for one colour.
 * Each colour contains:
 * - 0 x 4
 * - 1 x 4
 * - 2-6 x 7 each
 * - Skip x 4
 * - Reverse x 1
 * - Draw Two x 4
 *
 * @function
 * @param {Unoludo.Colour} colour The colour to create cards for.
 * @returns {Unoludo.Card[]} The coloured cards.
 */
const create_colour_cards = function (colour) {
    const zero_cards = create_copies(
        colour + "-number-0",
        4,
        "number",
        colour,
        0
    );

    const one_cards = create_copies(
        colour + "-number-1",
        4,
        "number",
        colour,
        1
    );

    const movement_cards = [2, 3, 4, 5, 6].flatMap(function (value) {
        return create_copies(
            colour + "-number-" + value,
            7,
            "number",
            colour,
            value
        );
    });

    const skip_cards = create_copies(colour + "-skip", 4, "skip", colour);
    const reverse_cards = create_copies(
        colour + "-reverse",
        1,
        "reverse",
        colour
    );
    const draw_two_cards = create_copies(
        colour + "-draw2",
        4,
        "draw2",
        colour
    );

    return [
        ...zero_cards,
        ...one_cards,
        ...movement_cards,
        ...skip_cards,
        ...reverse_cards,
        ...draw_two_cards
    ];
};

/**
 * Create the full Unoludo deck.
 *
 * The deck contains 220 cards:
 * - 16 zero shield cards
 * - 16 movement cards with value 1
 * - 140 movement cards from 2 to 6
 * - 16 Skip cards
 * - 4 Reverse cards
 * - 16 Draw Two cards
 * - 6 Wild cards
 * - 6 Wild +4 cards
 *
 * @memberof Unoludo
 * @function
 * @returns {Unoludo.Card[]} The ordered, unshuffled deck.
 */
Unoludo.create_deck = function () {
    const coloured_cards = Unoludo.colours.flatMap(create_colour_cards);
    const wild_cards = create_copies("wild", 6, "wild", "wild");
    const wild_four_cards = create_copies("wild4", 6, "wild4", "wild");

    return Object.freeze([
        ...coloured_cards,
        ...wild_cards,
        ...wild_four_cards
    ]);
};

Unoludo.create_reward_card = function (value) {
    return Unoludo.card(
        "reward-" + value + "-" + Math.random().toString(36).slice(2),
        "reward",
        "wild",
        value
    );
};

Unoludo.create_random_reward_card = function (random = Math.random) {
    const values = [6, 7, 8, 9];
    const index = Math.floor(random() * values.length);

    return Unoludo.create_reward_card(values[index]);
};

/**
 * Return a shuffled copy of a deck.
 *
 * This uses the Fisher-Yates shuffle. It returns a new array and does not
 * mutate the original deck.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.Card[]} deck The deck to shuffle.
 * @param {function} [random = Math.random] A random number function.
 * @returns {Unoludo.Card[]} A shuffled deck.
 */
Unoludo.shuffle_deck = function (deck, random = Math.random) {
    const shuffled = [...deck];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swap_index = Math.floor(random() * (index + 1));
        const temporary = shuffled[index];
        shuffled[index] = shuffled[swap_index];
        shuffled[swap_index] = temporary;
    }

    return Object.freeze(shuffled);
};

/**
 * Create an empty plane.
 * @memberof Unoludo
 * @function
 * @returns {Unoludo.Plane} A plane in base.
 */
Unoludo.empty_plane = function () {
    return Object.freeze({
        status: "base",
        position: -1,
        shielded: false,
        frozen: false
    });
};

/**
 * Create four empty planes for one player.
 *
 * @memberof Unoludo
 * @function
 * @returns {Unoludo.Plane[]} Four planes in base.
 */
Unoludo.empty_planes = function () {
    return Object.freeze([
        Unoludo.empty_plane(),
        Unoludo.empty_plane(),
        Unoludo.empty_plane(),
        Unoludo.empty_plane()
    ]);
};

/**
 * A player in Unoludo.
 *
 * @memberof Unoludo
 * @typedef {Object} Player
 * @property {number} id The player's id.
 * @property {string} name The player's display name.
 * @property {Unoludo.Colour} colour The player's plane colour.
 * @property {("human" | "cpu")} kind Whether the player is human or CPU.
 * @property {Unoludo.Card[]} hand The player's current hand.
 * @property {Unoludo.Plane[]} planes The player's four planes.
 */
/**
 * Create players with empty hands and four planes each.
 *
 * Player colours are assigned in turn order:
 * blue, green, red, yellow.
 *
 * @memberof Unoludo
 * @function
 * @param {string[]} player_names The names of the players.
 * @returns {Unoludo.Player[]} The created players.
 */
Unoludo.create_players = function (player_names) {
    const player_colours = ["blue", "green", "red", "yellow"];

    return Object.freeze(player_names.map(function (name, index) {
        return Object.freeze({
            id: index,
            name: name,
            colour: player_colours[index],
            kind: (
                index === 0
                ? "human"
                : "cpu"
            ),
            hand: Object.freeze([]),
            planes: Unoludo.empty_planes()
        });
    }));
};

/**
 * Deal cards to every player.
 * This returns new players and the remaining draw pile.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.Player[]} players The players to deal to.
 * @param {Unoludo.Card[]} draw_pile The draw pile.
 * @param {number} hand_size The number of cards for each player.
 * @returns {Object} An object containing players and draw_pile.
 */
Unoludo.deal_initial_hands = function (players, draw_pile, hand_size = 5) {
    let remaining_draw_pile = [...draw_pile];

    const dealt_players = players.map(function (player) {
        const hand = remaining_draw_pile.slice(0, hand_size);
        remaining_draw_pile = remaining_draw_pile.slice(hand_size);

        return Object.freeze({
            ...player,
            hand: sorted_hand(hand)
        });
    });

    return Object.freeze({
        players: Object.freeze(dealt_players),
        draw_pile: Object.freeze(remaining_draw_pile)
    });
};

/**
 * Start a discard pile with a random coloured 6 card.
 *
 * This opening card is not removed from the draw pile. It is created
 * separately so that every game starts with a playable 6.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.Card[]} draw_pile The current draw pile.
 * @param {function} [random = Math.random] A random number function.
 * @returns {Object} An object containing draw_pile, discard_pile, and active_colour.
 */
Unoludo.start_discard_pile = function (draw_pile, random = Math.random) {
    const colour = Unoludo.colours[
        Math.floor(random() * Unoludo.colours.length)
    ];

    const opening_card = Unoludo.card(
        "opening-" + colour + "-number-6",
        "number",
        colour,
        6
    );

    return Object.freeze({
        draw_pile: draw_pile,
        discard_pile: Object.freeze([opening_card]),
        active_colour: colour
    });
};

const card_colour_order = Object.freeze({
    blue: 0,
    green: 1,
    red: 2,
    yellow: 3,
    wild: 4
});

const card_type_order = function (card) {
    if (card.type === "number") {
        return card.value;
    }

    if (card.type === "skip") {
        return 7;
    }

    if (card.type === "reverse") {
        return 8;
    }

    if (card.type === "draw2") {
        return 9;
    }

    if (card.type === "wild") {
        return 10;
    }

    if (card.type === "wild4") {
        return 11;
    }
    if (card.type === "reward") {
        return 12 + card.value;
    }
    return 99;
};

const sorted_hand = function (hand) {
    const cards = hand.slice();

    cards.sort(function (card_a, card_b) {
        const colour_difference = (
            card_colour_order[card_a.colour] -
            card_colour_order[card_b.colour]
        );

        const type_difference = (
            card_type_order(card_a) -
            card_type_order(card_b)
        );

        if (colour_difference !== 0) {
            return colour_difference;
        }

        if (type_difference !== 0) {
            return type_difference;
        }

        return card_a.id.localeCompare(card_b.id);
    });

    return Object.freeze(cards);
};

Unoludo.sorted_hand = sorted_hand;

/**
 * Create a new initial game state.
 *
 * @memberof Unoludo
 * @function
 * @param {string[]} player_names The player names in turn order.
 * @param {Object} [options] Optional setup options.
 * @param {number} [options.hand_size = 5] The initial hand size.
 * @param {boolean} [options.shuffle = true] Whether to shuffle the deck.
 * @param {function} [options.random = Math.random] Random function for shuffling.
 * @returns {Unoludo.State} The initial state.
 */
Unoludo.create_initial_state = function (player_names, options = {}) {
    const hand_size = (
    options.hand_size === undefined
    ? 5
    : options.hand_size
    );
    const should_shuffle = options.shuffle ?? true;
    const random = options.random ?? Math.random;

    const deck = (
        should_shuffle
        ? Unoludo.shuffle_deck(Unoludo.create_deck(), random)
        : Unoludo.create_deck()
    );

    const players = Unoludo.create_players(player_names);
    const dealt = Unoludo.deal_initial_hands(players, deck, hand_size);
    const discard_setup = Unoludo.start_discard_pile(
        dealt.draw_pile,
        random
    );

    return Object.freeze({
        draw_pile: discard_setup.draw_pile,
        discard_pile: discard_setup.discard_pile,
        players: dealt.players,
        current_player: 0,
        active_colour: discard_setup.active_colour,
        winner: undefined,
        player_moods: Object.freeze({}),
        log: Object.freeze(["Game started."])
    });
};

/**
 * Return the top card of the discard pile.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The game state.
 * @returns {Unoludo.Card} The top discard card.
 */
Unoludo.top_discard = function (state) {
    return state.discard_pile[state.discard_pile.length - 1];
};

/**
 * Return the current player.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The game state.
 * @returns {Unoludo.Player} The current player.
 */
Unoludo.current_player = function (state) {
    return state.players[state.current_player];
};

const player_moods_for_state = function (state) {
    return state.player_moods || Object.freeze({});
};

const clear_player_mood = function (moods, player_id) {
    const key = String(player_id);
    const next_moods = {...moods};

    delete next_moods[key];
    return Object.freeze(next_moods);
};

const mark_disruption = function (state, disruptor_id, target_id) {
    return Object.freeze({
        ...state,
        player_moods: Object.freeze({
            ...player_moods_for_state(state),
            [disruptor_id]: "smug",
            [target_id]: "angry"
        })
    });
};

/**
 * Return whether the game has ended.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The game state.
 * @returns {boolean} Whether the game has ended.
 */
Unoludo.is_ended = function (state) {
    return state.winner !== undefined;
};

/**
 * Return whether a card can be played on the current discard state.
 *
 * A card can be played if:
 * - it is a Wild or Wild +4 card;
 * - it matches the active colour;
 * - it is a number card with the same value as the top number card;
 * - it is an action card with the same action type as the top action card.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.Card} card The card being played.
 * @param {Unoludo.Card} top_card The current top discard card.
 * @param {(Unoludo.Colour | undefined)} active_colour The currently active colour.
 * @returns {boolean} Whether the card can be played.
 */
Unoludo.can_play_on = function (card, top_card, active_colour) {
    if (card.colour === "wild") {
        return true;
    }

    if (card.colour === active_colour) {
        return true;
    }

    if (
        card.type === "number" &&
        (top_card.type === "number" || top_card.type === "reward") &&
        card.value === top_card.value
    ) {
        return true;
    }

    return (
        card.type !== "number" &&
        top_card.type !== "number" &&
        card.type === top_card.type
    );
};

/**
 * Return whether a card can be legally played now.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.Card} card The card to check.
 * @param {Unoludo.State} state The game state.
 * @returns {boolean} Whether the card can be played.
 */
Unoludo.can_play_card = function (card, state) {
    return Unoludo.can_play_on(
        card,
        Unoludo.top_discard(state),
        state.active_colour
    );
};
const is_valid_colour = function (colour) {
    return Unoludo.colours.includes(colour);
};
/**
 * Return the cards in a player's hand that are currently playable.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The game state.
 * @param {number} player_id The player id.
 * @returns {Unoludo.Card[]} Playable cards.
 */
Unoludo.playable_cards = function (state, player_id) {
    const player = state.players[player_id];

    return Object.freeze(player.hand.filter(function (card) {
        return Unoludo.can_play_card(card, state);
    }));
};

/**
 * Return whether a player has finished all planes.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.Player} player The player to check.
 * @returns {boolean} Whether all four planes are finished.
 */
Unoludo.player_has_won = function (player) {
    return player.planes.every(function (plane) {
        return plane.status === "finished";
    });
};

/**
 * Return the next player id.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The game state.
 * @returns {number} The next player id.
 */
Unoludo.next_player_id = function (state) {
    return (state.current_player + 1) % state.players.length;
};

/**
 * Return a card from a player's hand by id.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.Player} player The player whose hand is searched.
 * @param {string} card_id The card id.
 * @returns {(Unoludo.Card | undefined)} The matching card, if found.
 */
Unoludo.card_in_hand = function (player, card_id) {
    return player.hand.find(function (card) {
        return card.id === card_id;
    });
};

/**
 * Remove one card from a player's hand.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.Player} player The player.
 * @param {string} card_id The card id to remove.
 * @returns {(Unoludo.Player | undefined)} The updated player, or undefined.
 */
Unoludo.remove_card_from_hand = function (player, card_id) {
    const card = Unoludo.card_in_hand(player, card_id);

    if (card === undefined) {
        return undefined;
    }

    return Object.freeze({
        id: player.id,
        name: player.name,
        colour: player.colour,
        kind: player.kind,
        hand: sorted_hand(player.hand.filter(function (hand_card) {
            return hand_card.id !== card_id;
        })),
        planes: player.planes
    });
};

/**
 * Add an event to the game log.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The game state.
 * @param {string} message The message to add.
 * @returns {Unoludo.State} The updated state.
 */
Unoludo.add_log = function (state, message) {
    return Object.freeze({
        ...state,
        log: Object.freeze([...state.log, message])
    });
};

/**
 * The number of spaces on the main track.
 * This can be changed later to match the final board.
 * @memberof Unoludo
 * @readonly
 */
Unoludo.track_length = 52;

/**
 * The number of spaces in each home lane.
 * @memberof Unoludo
 * @readonly
 */
Unoludo.home_lane_length = 5;

Unoludo.start_positions = Object.freeze({
    blue: 0,
    green: 13,
    red: 26,
    yellow: 39
});

Unoludo.home_entry_positions = Object.freeze({
    blue: 49,
    green: 10,
    red: 23,
    yellow: 36
});

Unoludo.jump_positions = Object.freeze({
    blue: Object.freeze({from: 17, to: 29}),
    green: Object.freeze({from: 30, to: 42}),
    red: Object.freeze({from: 43, to: 3}),
    yellow: Object.freeze({from: 4, to: 16})
});


/**
 * Replace one player in the player list.
 *
 * @function
 * @param {Unoludo.Player[]} players The current players.
 * @param {number} player_id The player to replace.
 * @param {Unoludo.Player} new_player The updated player.
 * @returns {Unoludo.Player[]} The updated player list.
 */
const replace_player = function (players, player_id, new_player) {
    return Object.freeze(players.map(function (player) {
        if (player.id === player_id) {
            return new_player;
        }
        return player;
    }));
};

/**
 * Replace one plane in a player's plane list.
 *
 * @function
 * @param {Unoludo.Player} player The player to update.
 * @param {number} plane_index The plane index.
 * @param {Unoludo.Plane} new_plane The updated plane.
 * @returns {Unoludo.Player} The updated player.
 */
const replace_plane_in_player = function (player, plane_index, new_plane) {
    return Object.freeze({
        id: player.id,
        name: player.name,
        colour: player.colour,
        kind: player.kind,
        hand: player.hand,
        planes: Object.freeze(player.planes.map(function (plane, index) {
            if (index === plane_index) {
                return new_plane;
            }

            return plane;
        }))
    });
};

/**
 * Replace one player in the game state.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The game state.
 * @param {number} player_id The player to update.
 * @param {Unoludo.Player} new_player The updated player.
 * @returns {Unoludo.State} The updated state.
 */
Unoludo.update_player = function (state, player_id, new_player) {
    const new_winner = (
        state.winner !== undefined
        ? state.winner
        : (
            Unoludo.player_has_won(new_player)
            ? new_player.id
            : undefined
        )
    );

    return Object.freeze({
        draw_pile: state.draw_pile,
        discard_pile: state.discard_pile,
        players: replace_player(state.players, player_id, new_player),
        current_player: state.current_player,
        active_colour: state.active_colour,
        winner: new_winner,
        player_moods: player_moods_for_state(state),
        log: (
            state.winner === undefined &&
            new_winner !== undefined
            ? Object.freeze(state.log.concat([
                new_player.name + " won the game!"
            ]))
            : state.log
        )
    });
};

/**
 * Replace one plane in the game state.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The game state.
 * @param {number} player_id The owner of the plane.
 * @param {number} plane_index The plane index.
 * @param {Unoludo.Plane} new_plane The updated plane.
 * @returns {Unoludo.State} The updated state.
 */
Unoludo.update_plane = function (
    state,
    player_id,
    plane_index,
    new_plane
) {
    const player = state.players[player_id];
    const new_player = replace_plane_in_player(
        player,
        plane_index,
        new_plane
    );

    return Unoludo.update_player(state, player_id, new_player);
};

const refill_draw_pile_from_discard = function (state) {
    const top_discard = Unoludo.top_discard(state);
    const refill_cards = state.discard_pile.slice(0, -1);

    if (refill_cards.length === 0) {
        return undefined;
    }

    return Object.freeze({
        draw_pile: Unoludo.shuffle_deck(refill_cards),
        discard_pile: Object.freeze([top_discard]),
        refilled: true
    });
};

const create_emergency_refill_deck = function (state) {
    const suffix = "-emergency-refill-" + state.log.length;

    return Object.freeze(Unoludo.shuffle_deck(
        Unoludo.create_deck().map(function (card) {
            return Unoludo.card(
                card.id + suffix,
                card.type,
                card.colour,
                card.value
            );
        })
    ));
};

const prepare_draw_pile = function (state, count) {
    let draw_pile = state.draw_pile;
    let discard_pile = state.discard_pile;
    let refilled = false;
    let refill;

    if (draw_pile.length < count) {
        refill = refill_draw_pile_from_discard(state);

        if (refill !== undefined) {
            draw_pile = Object.freeze(draw_pile.concat(refill.draw_pile));
            discard_pile = refill.discard_pile;
            refilled = true;
        }
    }

    if (draw_pile.length < count) {
        draw_pile = Object.freeze(
            draw_pile.concat(create_emergency_refill_deck(state))
        );
        refilled = true;
    }

    return Object.freeze({
        draw_pile: draw_pile,
        discard_pile: discard_pile,
        refilled: refilled
    });
};

/**
 * Draw cards for a player.
 *
 * If the draw pile contains fewer cards than requested, the discard pile is
 * reshuffled into the draw pile while preserving the top discard card.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The game state.
 * @param {number} player_id The player drawing cards.
 * @param {number} count The number of cards to draw.
 * @returns {Unoludo.State} The updated state.
 */
Unoludo.draw_cards = function (state, player_id, count) {
    const player = state.players[player_id];
    const prepared_piles = prepare_draw_pile(state, count);
    const drawn_cards = prepared_piles.draw_pile.slice(0, count);
    const remaining_draw_pile = prepared_piles.draw_pile.slice(drawn_cards.length);
    const refill_message = (
        prepared_piles.refilled
        ? ["Draw pile was refilled from the discard pile."]
        : []
    );

    const new_player = Object.freeze({
        id: player.id,
        name: player.name,
        colour: player.colour,
        kind: player.kind,
        hand: sorted_hand(player.hand.concat(drawn_cards)),
        planes: player.planes
    });

    return Object.freeze({
        draw_pile: Object.freeze(remaining_draw_pile),
        discard_pile: prepared_piles.discard_pile,
        players: replace_player(state.players, player_id, new_player),
        current_player: state.current_player,
        active_colour: state.active_colour,
        winner: state.winner,
        player_moods: player_moods_for_state(state),
        log: Object.freeze(
            state.log.concat(refill_message).concat([
                player.name + " drew " + drawn_cards.length + " card(s)."
            ])
        )
    });
};

const grant_empty_hand_bonus = function (state, player_id) {
    const player = state.players[player_id];
    const reward_card = Unoludo.create_random_reward_card();
    let state_after_draw;
    let updated_player;

    if (player.hand.length !== 0) {
        return state;
    }

    state_after_draw = Unoludo.draw_cards(state, player_id, 2);
    updated_player = state_after_draw.players[player_id];

    updated_player = Object.freeze({
        id: updated_player.id,
        name: updated_player.name,
        colour: updated_player.colour,
        kind: updated_player.kind,
        hand: sorted_hand(updated_player.hand.concat([reward_card])),
        planes: updated_player.planes
    });

    return Object.freeze({
        draw_pile: state_after_draw.draw_pile,
        discard_pile: state_after_draw.discard_pile,
        players: replace_player(
            state_after_draw.players,
            player_id,
            updated_player
        ),
        current_player: state_after_draw.current_player,
        active_colour: state_after_draw.active_colour,
        winner: state_after_draw.winner,
        player_moods: player_moods_for_state(state_after_draw),
        log: Object.freeze(state_after_draw.log.concat([
            player.name + " emptied their hand and received a reward card."
        ]))
    });
};


/**
 * Clear all shields from a player.
 *
 * @function
 * @param {Unoludo.Player} player The player to update.
 * @returns {Unoludo.Player} The updated player.
 */
const clear_shields = function (player) {
    return Object.freeze({
        id: player.id,
        name: player.name,
        colour: player.colour,
        kind: player.kind,
        hand: player.hand,
        planes: Object.freeze(player.planes.map(function (plane) {
            return Object.freeze({
                status: plane.status,
                position: plane.position,
                shielded: false,
                frozen: plane.frozen
            });
        }))
    });
};

/**
 * Clear all frozen states from a player.
 *
 * @function
 * @param {Unoludo.Player} player The player to update.
 * @returns {Unoludo.Player} The updated player.
 */
const clear_frozen = function (player) {
    return Object.freeze({
        id: player.id,
        name: player.name,
        colour: player.colour,
        kind: player.kind,
        hand: player.hand,
        planes: Object.freeze(player.planes.map(function (plane) {
            return Object.freeze({
                status: plane.status,
                position: plane.position,
                shielded: plane.shielded,
                frozen: false
            });
        }))
    });
};

/**
 * End the current player's turn.
 *
 * Frozen states are cleared from the player whose turn is ending.
 * Shields are cleared from the player whose turn is beginning, because
 * shields last until the start of that player's next turn.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The current game state.
 * @returns {Unoludo.State} The updated state.
 */
Unoludo.end_turn = function (state) {
    const current_player = state.players[state.current_player];
    const current_player_cleared = clear_frozen(current_player);
    const next_player_id = Unoludo.next_player_id(state);
    const next_player = state.players[next_player_id];
    const next_player_cleared = clear_shields(next_player);

    let players = replace_player(
        state.players,
        state.current_player,
        current_player_cleared
    );

    players = replace_player(
        players,
        next_player_id,
        next_player_cleared
    );

    return Object.freeze({
        draw_pile: state.draw_pile,
        discard_pile: state.discard_pile,
        players: players,
        current_player: next_player_id,
        active_colour: state.active_colour,
        winner: state.winner,
        player_moods: clear_player_mood(
            player_moods_for_state(state),
            next_player_id
        ),
        log: Object.freeze(
            state.log.concat([
                "Turn ended. It is now "
                + next_player.name
                + "'s turn."
            ])
        )
    });
};

/**
 * Draw one card for the current player and end their turn.
 *
 * This is the alternative to playing a card. The drawn card cannot be played
 * immediately in the same turn.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The current game state.
 * @returns {Unoludo.State} The updated state after drawing and ending turn.
 */
const player_has_frozen_planes = function (player) {
    return player.planes.some(function (plane) {
        return plane.frozen;
    });
};

Unoludo.draw_one_and_end_turn = function (state) {
    const player = Unoludo.current_player(state);
    let state_after_draw;

    if (Unoludo.is_ended(state)) {
        return undefined;
    }

    if (player_has_frozen_planes(player)) {
        return Unoludo.add_log(
            Unoludo.end_turn(state),
            player.name + " could not draw because their planes were frozen."
        );
    }

    state_after_draw = Unoludo.draw_cards(
        state,
        player.id,
        1
    );

    return Unoludo.end_turn(state_after_draw);
};

/**
 * Remove a card from a player and place it on the discard pile.
 *
 * @function
 * @param {Unoludo.State} state The game state.
 * @param {Unoludo.Player} updated_player The player after the card effect.
 * @param {string} card_id The played card id.
 * @param {Unoludo.Card} card The played card.
 * @param {string} message The log message.
 * @returns {Unoludo.State} The updated state.
 */
const commit_played_card = function (
    state,
    updated_player,
    card_id,
    card,
    message
) {
    const player_without_card = Unoludo.remove_card_from_hand(
        updated_player,
        card_id
    );

    if (player_without_card === undefined) {
        return undefined;
    }

    const new_state = Object.freeze({
        draw_pile: state.draw_pile,
        discard_pile: Object.freeze(state.discard_pile.concat([card])),
        players: replace_player(
            state.players,
            updated_player.id,
            player_without_card
        ),
        current_player: state.current_player,
        active_colour: card.colour,
        winner: (
            Unoludo.player_has_won(player_without_card)
            ? player_without_card.id
            : state.winner
        ),
        player_moods: player_moods_for_state(state),
        log: Object.freeze(state.log.concat([message]))
    });

    if (new_state.winner !== state.winner) {
        return new_state;
    }

    return grant_empty_hand_bonus(new_state, updated_player.id);
};

Unoludo.play_reward_card = function (
    state,
    card_id,
    target_player_id,
    target_plane_index,
    chosen_colour
) {
    const player = Unoludo.current_player(state);
    const card = Unoludo.card_in_hand(player, card_id);
    const target_player = state.players[target_player_id];
    let target_plane;
    let moved_plane;
    let player_after_card;
    let state_after_card;
    let state_after_move;

    if (Unoludo.is_ended(state)) {
        return undefined;
    }

    if (card === undefined) {
        return undefined;
    }

    if (
        card.type !== "reward" ||
        card.value < 6 ||
        card.value > 9
    ) {
        return undefined;
    }

    if (!is_valid_colour(chosen_colour)) {
        return undefined;
    }

    if (target_player === undefined) {
        return undefined;
    }

    target_plane = target_player.planes[target_plane_index];

    if (target_plane === undefined) {
        return undefined;
    }

    if (target_plane.frozen) {
        return undefined;
    }

    if (target_plane.status === "base") {
        moved_plane = Object.freeze({
            status: "gate",
            position: -1,
            shielded: false,
            frozen: false
        });
    } else {
        moved_plane = move_active_plane(
            target_plane,
            card.value,
            target_player.colour
        );
    }

    if (moved_plane === undefined) {
        return undefined;
    }

    player_after_card = Unoludo.remove_card_from_hand(player, card_id);

    if (player_after_card === undefined) {
        return undefined;
    }

    state_after_card = Object.freeze({
        draw_pile: state.draw_pile,
        discard_pile: Object.freeze(state.discard_pile.concat([card])),
        players: replace_player(
            state.players,
            player.id,
            player_after_card
        ),
        current_player: state.current_player,
        active_colour: chosen_colour,
        winner: state.winner,
        player_moods: player_moods_for_state(state),
        log: Object.freeze(state.log.concat([
            player.name + " played reward "
            + card.value + ", chose " + chosen_colour
            + ", and " + (target_plane.status === "base" ? "launched" : "moved")
            + " " + target_player.name + "'s plane "
            + target_plane_index
            + (target_plane.status === "base" ? " to the gate." : " forward by " + card.value + ".")
        ]))
    });

    state_after_move = Unoludo.update_plane(
        state_after_card,
        target_player_id,
        target_plane_index,
        moved_plane
    );

    state_after_move = Unoludo.resolve_captures(
        state_after_move,
        target_player_id,
        target_plane_index
    );

    return grant_empty_hand_bonus(
        state_after_move,
        player.id
    );
};



/**
 * Move an active plane forward.
 *
 * This simplified movement model treats the board as:
 * gate -> main track -> home lane -> finished.
 * Overshooting the final home position is illegal.
 *
 * @function
 * @param {Unoludo.Plane} plane The plane to move.
 * @param {number} steps The number of spaces to move.
 * @returns {(Unoludo.Plane | undefined)} The moved plane, or undefined.
 */
const wrapped_track_position = function (position) {
    return ((position % Unoludo.track_length) + Unoludo.track_length) % Unoludo.track_length;
};

const apply_track_jump = function (position, colour) {
    const jump = Unoludo.jump_positions[colour];

    if (jump !== undefined && position === jump.from) {
        return jump.to;
    }

    return position;
};

const has_passed_home_entry = function (start_position, steps, entry_position) {
    const distance_to_entry = (
        (entry_position - start_position + Unoludo.track_length) %
        Unoludo.track_length
    );

    if (steps <= 0) {
        return false;
    }

    return steps > distance_to_entry;
};

const move_active_plane = function (plane, steps, colour) {
    const entry_position = Unoludo.home_entry_positions[colour];
    const start_position = Unoludo.start_positions[colour];
    const remaining_steps = steps - 1;
    let distance_to_entry;
    let home_position;
    let next_position;

    if (plane.status === "gate") {
        if (start_position === undefined || steps <= 0) {
            return undefined;
        }

        if (remaining_steps === 0) {
            return Object.freeze({
                status: "track",
                position: start_position,
                shielded: plane.shielded,
                frozen: plane.frozen
            });
        }

        return move_active_plane(
            Object.freeze({
                status: "track",
                position: start_position,
                shielded: plane.shielded,
                frozen: plane.frozen
            }),
            remaining_steps,
            colour
        );
    }

    if (plane.status === "track") {
        if (entry_position === undefined) {
            return undefined;
        }

        if (has_passed_home_entry(plane.position, steps, entry_position)) {
            distance_to_entry = (
                (entry_position - plane.position + Unoludo.track_length) %
                Unoludo.track_length
            );

            home_position = steps - distance_to_entry - 1;

            if (home_position < Unoludo.home_lane_length) {
                return Object.freeze({
                    status: "home",
                    position: home_position,
                    shielded: plane.shielded,
                    frozen: plane.frozen
                });
            }

            if (home_position === Unoludo.home_lane_length) {
                return Object.freeze({
                    status: "finished",
                    position: Unoludo.home_lane_length,
                    shielded: false,
                    frozen: false
                });
            }

            return undefined;
        }

        next_position = apply_track_jump(
            wrapped_track_position(plane.position + steps),
            colour
        );

        return Object.freeze({
            status: "track",
            position: next_position,
            shielded: plane.shielded,
            frozen: plane.frozen
        });
    }

    if (plane.status === "home") {
        next_position = plane.position + steps;

        if (next_position < Unoludo.home_lane_length) {
            return Object.freeze({
                status: "home",
                position: next_position,
                shielded: plane.shielded,
                frozen: plane.frozen
            });
        }

        if (next_position === Unoludo.home_lane_length) {
            return Object.freeze({
                status: "finished",
                position: Unoludo.home_lane_length,
                shielded: false,
                frozen: false
            });
        }

        return undefined;
    }

    return undefined;
};

/**
 * Create a plane returned to base.
 *
 * @function
 * @returns {Unoludo.Plane} A plane in base.
 */
const plane_returned_to_base = function () {
    return Object.freeze({
        status: "base",
        position: -1,
        shielded: false,
        frozen: false
    });
};

/**
 * Return whether two planes are on the same capturable track position.
 *
 * @function
 * @param {Unoludo.Plane} moved_plane The plane that has just moved.
 * @param {Unoludo.Plane} target_plane A possible captured plane.
 * @returns {boolean} Whether the target is on the same track space.
 */
const is_same_track_position = function (moved_plane, target_plane) {
    return (
        moved_plane.status === "track" &&
        target_plane.status === "track" &&
        moved_plane.position === target_plane.position
    );
};

/**
 * Resolve captures caused by a moved plane.
 *
 * Only planes on the main track can be captured. A shielded plane is not sent
 * back to base. The moved plane itself is not changed.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The game state after movement.
 * @param {number} mover_player_id The player id of the moved plane.
 * @param {Unoludo.Colour} mover_plane_colour The colour of the moved plane.
 * @returns {Unoludo.State} The state after resolving captures.
 */
Unoludo.resolve_captures = function (
    state,
    mover_player_id,
    mover_plane_index
) {
    const mover = state.players[mover_player_id];
    const moved_plane = mover.planes[mover_plane_index];
    let resolved_state = state;

    if (moved_plane.status !== "track") {
        return state;
    }

    state.players.forEach(function (target_player) {
        if (target_player.id === mover_player_id) {
            return;
        }

        target_player.planes.forEach(function (target_plane, target_plane_index) {
            const current_target_plane = resolved_state
                .players[target_player.id]
                .planes[target_plane_index];

            if (!is_same_track_position(moved_plane, current_target_plane)) {
                return;
            }

            if (current_target_plane.shielded) {
                resolved_state = Unoludo.add_log(
                    resolved_state,
                    target_player.name + "'s plane "
                    + target_plane_index + " was protected by shield."
                );
                return;
            }

            resolved_state = Unoludo.update_plane(
                resolved_state,
                target_player.id,
                target_plane_index,
                plane_returned_to_base()
            );

            resolved_state = Unoludo.add_log(
                resolved_state,
                mover.name + "'s plane "
                + mover_plane_index + " captured "
                + target_player.name + "'s plane "
                + target_plane_index + "."
            );

            resolved_state = mark_disruption(
                resolved_state,
                mover.id,
                target_player.id
            );
        });
    });

    return resolved_state;
};

/**
 * Play a 0 card to shield the matching-colour active plane.
 *
 * A shield only prevents being sent back to base by capture.
 * It does not block Reverse, Wild movement, or Skip freeze.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The current game state.
 * @param {string} card_id The 0 card id.
 * @param {Unoludo.Colour} plane_colour The plane to shield.
 * @returns {(Unoludo.State | undefined)} The updated state, or undefined.
 */
Unoludo.play_zero_card = function (state, card_id, plane_index) {
    const player = Unoludo.current_player(state);
    const card = Unoludo.card_in_hand(player, card_id);
    let plane;
    let new_plane;
    let updated_player;

    if (Unoludo.is_ended(state)) {
        return undefined;
    }
    if (card === undefined) {
        return undefined;
    }

    if (!Unoludo.can_play_card(card, state)) {
        return undefined;
    }

    if (
        card.type !== "number" ||
        card.value !== 0
    ) {
        return undefined;
    }

    plane = player.planes[plane_index];

    if (plane === undefined) {
        return undefined;
    }

    if (plane.status === "base" || plane.status === "finished") {
        return undefined;
    }

    if (plane.frozen) {
        return undefined;
    }

    new_plane = Object.freeze({
        status: plane.status,
        position: plane.position,
        shielded: true,
        frozen: plane.frozen
    });

    updated_player = replace_plane_in_player(player, plane_index, new_plane);

    return commit_played_card(
        state,
        updated_player,
        card_id,
        card,
        player.name + " played " + card.colour + " 0 and shielded plane "
        + plane_index + "."
    );
};

/**
 * Play a number card from 1 to 6.
 *
 * A 6 card launches a matching-colour plane from base to the gate.
 * Otherwise, number cards move an active matching-colour plane by their value.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The current game state.
 * @param {string} card_id The number card id.
 * @param {Unoludo.Colour} plane_colour The plane to move or launch.
 * @returns {(Unoludo.State | undefined)} The updated state, or undefined.
 */
Unoludo.play_number_card = function (state, card_id, plane_index) {
    const player = Unoludo.current_player(state);
    const card = Unoludo.card_in_hand(player, card_id);
    let plane;
    let new_plane;
    let updated_player;
    let message;

    if (Unoludo.is_ended(state)) {
        return undefined;
    }

    if (card === undefined) {
        return undefined;
    }

    if (!Unoludo.can_play_card(card, state)) {
        return undefined;
    }

    if (
        card.type !== "number" ||
        card.value < 1 ||
        card.value > 6
    ) {
        return undefined;
    }

    plane = player.planes[plane_index];

    if (plane === undefined) {
        return undefined;
    }

    if (plane.frozen) {
        return undefined;
    }

    if (plane.status === "base") {
        if (card.value !== 6) {
            return undefined;
        }

        new_plane = Object.freeze({
            status: "gate",
            position: -1,
            shielded: false,
            frozen: false
        });

        message = (
            player.name + " played " + card.colour + " 6 and launched "
            + player.colour + " to the gate."
        );
    } else {
        new_plane = move_active_plane(plane, card.value, player.colour);

        if (new_plane === undefined) {
            return undefined;
        }

        message = (
            player.name + " played " + card.colour + " "
            + card.value + " and moved plane " + plane_index + " by "
            + card.value + "."
        );
    }

    updated_player = replace_plane_in_player(
        player,
        plane_index,
        new_plane
    );

    const state_after_play = commit_played_card(
        state,
        updated_player,
        card_id,
        card,
        message
    );

    if (state_after_play === undefined) {
        return undefined;
    }

    return Unoludo.resolve_captures(
        state_after_play,
        player.id,
        plane_index
    );
};
/**
 * Play a Draw Two card.
 *
 * Draw Two lets the current player draw two cards. It does not move any
 * plane. The card must satisfy the current UNO play condition.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The current game state.
 * @param {string} card_id The Draw Two card id.
 * @returns {(Unoludo.State | undefined)} The updated state, or undefined.
 */
Unoludo.play_draw2_card = function (state, card_id) {
    const player = Unoludo.current_player(state);
    const card = Unoludo.card_in_hand(player, card_id);
    let state_after_card;

    if (Unoludo.is_ended(state)) {
        return undefined;
    }

    if (card === undefined) {
        return undefined;
    }

    if (!Unoludo.can_play_card(card, state)) {
        return undefined;
    }

    if (card.type !== "draw2") {
        return undefined;
    }

    state_after_card = commit_played_card(
        state,
        player,
        card_id,
        card,
        player.name + " played " + card.colour + " Draw Two."
    );

    if (state_after_card === undefined) {
        return undefined;
    }

    return Unoludo.draw_cards(
        state_after_card,
        player.id,
        2
    );
};

/**
 * Play a Skip card.
 *
 * Skip freezes one active plane belonging to a target opponent. The target
 * player can still take a turn, but the frozen plane cannot move until that
 * player's turn ends.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The current game state.
 * @param {string} card_id The Skip card id.
 * @param {number} target_player_id The target opponent player id.
 * @param {number} target_plane_index The index of the target plane to freeze (0-3).
 * @returns {(Unoludo.State | undefined)} The updated state, or undefined.
 */
Unoludo.play_skip_card = function (
    state,
    card_id,
    target_player_id,
    target_plane_index
) {
    const player = Unoludo.current_player(state);
    const card = Unoludo.card_in_hand(player, card_id);
    const target_player = state.players[target_player_id];
    let clicked_plane;
    let frozen_target_player;
    let state_after_card;

    if (Unoludo.is_ended(state)) {
        return undefined;
    }

    if (card === undefined) {
        return undefined;
    }

    if (!Unoludo.can_play_card(card, state)) {
        return undefined;
    }

    if (card.type !== "skip") {
        return undefined;
    }

    if (target_player === undefined) {
        return undefined;
    }

    if (target_player.id === player.id) {
        return undefined;
    }

    clicked_plane = target_player.planes[target_plane_index];

    if (clicked_plane === undefined) {
        return undefined;
    }

    if (
        clicked_plane.status === "base" ||
        clicked_plane.status === "finished"
    ) {
        return undefined;
    }

    frozen_target_player = Object.freeze({
        id: target_player.id,
        name: target_player.name,
        colour: target_player.colour,
        kind: target_player.kind,
        hand: target_player.hand,
        planes: Object.freeze(target_player.planes.map(function (plane) {
            if (plane.status === "finished") {
                return plane;
            }

            return Object.freeze({
                status: plane.status,
                position: plane.position,
                shielded: plane.shielded,
                frozen: true
            });
        }))
    });

    state_after_card = commit_played_card(
        state,
        player,
        card_id,
        card,
        player.name + " played " + card.colour + " Skip and froze all of "
        + target_player.name + "'s planes."
    );

    if (state_after_card === undefined) {
        return undefined;
    }

    return mark_disruption(
        Unoludo.update_player(
            state_after_card,
            target_player_id,
            frozen_target_player
        ),
        player.id,
        target_player_id
    );
};

/**
 * Move an active plane backwards.
 *
 * If the backward movement would go before the start of the main track
 * (i.e. past the plane's start position), the plane is sent back to base.
 *
 * @function
 * @param {Unoludo.Plane} plane The plane to move backwards.
 * @param {number} steps The number of spaces to move backwards.
 * @param {Unoludo.Colour} colour The colour of the plane (for position calculation).
 * @returns {(Unoludo.Plane | undefined)} The moved plane, or undefined.
 */
const move_plane_backward = function (plane, steps, colour) {
    const start_position = Unoludo.start_positions[colour];
    const entry_position = Unoludo.home_entry_positions[colour];
    let distance_from_start;
    let entry_distance;
    let next_distance;
    let next_position;

    if (steps <= 0) {
        return undefined;
    }

    if (start_position === undefined || entry_position === undefined) {
        return undefined;
    }

    if (plane.status === "base" || plane.status === "finished") {
        return undefined;
    }

    if (plane.status === "gate") {
        return plane_returned_to_base();
    }

    if (plane.status === "track") {
        distance_from_start = (
            (plane.position - start_position + Unoludo.track_length) %
            Unoludo.track_length
        );

        next_distance = distance_from_start - steps;

        if (next_distance < 0) {
            return plane_returned_to_base();
        }

        next_position = wrapped_track_position(
            start_position + next_distance
        );

        return Object.freeze({
            status: "track",
            position: next_position,
            shielded: plane.shielded,
            frozen: plane.frozen
        });
    }

    if (plane.status === "home") {
        next_position = plane.position - steps;

        if (next_position >= 0) {
            return Object.freeze({
                status: "home",
                position: next_position,
                shielded: plane.shielded,
                frozen: plane.frozen
            });
        }

        entry_distance = (
            (entry_position - start_position + Unoludo.track_length) %
            Unoludo.track_length
        );

        next_distance = entry_distance + next_position + 1;

        if (next_distance < 0) {
            return plane_returned_to_base();
        }

        return Object.freeze({
            status: "track",
            position: wrapped_track_position(
                start_position + next_distance
            ),
            shielded: plane.shielded,
            frozen: plane.frozen
        });
    }

    return undefined;
};

/**
 * Play a Reverse card.
 *
 * The player chooses how many spaces, from 1 to 6, to move the selected
 * opponent plane backwards.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The current game state.
 * @param {string} card_id The Reverse card id.
 * @param {number} target_player_id The target opponent player id.
 * @param {number} target_plane_index The index of the target plane to move backwards (0-3).
 * @param {number} steps The number of spaces to move backwards.
 * @returns {(Unoludo.State | undefined)} The updated state, or undefined.
 */
Unoludo.play_reverse_card = function (
    state,
    card_id,
    target_player_id,
    target_plane_index,
    steps
) {
    const player = Unoludo.current_player(state);
    const card = Unoludo.card_in_hand(player, card_id);
    let target_player;
    let target_plane;
    let moved_plane;
    let player_after_card;
    let state_after_card;

    if (Unoludo.is_ended(state)) {
        return undefined;
    }

    if (card === undefined) {
        return undefined;
    }

    if (!Unoludo.can_play_card(card, state)) {
        return undefined;
    }

    if (card.type !== "reverse") {
        return undefined;
    }

    if (!Number.isInteger(steps) || steps < 1 || steps > 6) {
        return undefined;
    }

    if (target_player_id === player.id) {
        return undefined;
    }

    target_player = state.players[target_player_id];

    if (target_player === undefined) {
        return undefined;
    }

    target_plane = target_player.planes[target_plane_index];

    if (target_plane === undefined) {
        return undefined;
    }

    moved_plane = move_plane_backward(
        target_plane,
        steps,
        target_player.colour
    );

    if (moved_plane === undefined) {
        return undefined;
    }

    player_after_card = Unoludo.remove_card_from_hand(player, card_id);

    if (player_after_card === undefined) {
        return undefined;
    }

    state_after_card = Object.freeze({
        draw_pile: state.draw_pile,
        discard_pile: Object.freeze(state.discard_pile.concat([card])),
        players: replace_player(
            state.players,
            player.id,
            player_after_card
        ),
        current_player: state.current_player,
        active_colour: card.colour,
        winner: state.winner,
        player_moods: player_moods_for_state(state),
        log: Object.freeze(state.log.concat([
            player.name + " played "
            + card.colour + " Reverse and moved "
            + target_player.name + "'s plane "
            + target_plane_index + " backwards by "
            + steps + "."
        ]))
    });

    state_after_card = Unoludo.update_plane(
        state_after_card,
        target_player_id,
        target_plane_index,
        moved_plane
    );

    state_after_card = mark_disruption(
        state_after_card,
        player.id,
        target_player_id
    );

    return grant_empty_hand_bonus(state_after_card, player.id);
};

/**
 * Play a Wild combo.
 *
 * Wild must be played with a number card. The number card determines how many
 * spaces the target plane moves forward. The target can be any active plane
 * belonging to any player.
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The current game state.
 * @param {string} wild_card_id The Wild card id.
 * @param {string} number_card_id The number card id.
 * @param {number} target_player_id The target player id.
 * @param {Unoludo.Colour} target_plane_colour The target plane colour.
 * @returns {(Unoludo.State | undefined)} The updated state, or undefined.
 */
Unoludo.play_wild_combo = function (
    state,
    wild_card_id,
    number_card_id,
    target_player_id,
    target_plane_index
) {
    const player = Unoludo.current_player(state);
    const wild_card = Unoludo.card_in_hand(player, wild_card_id);
    const number_card = Unoludo.card_in_hand(player, number_card_id);
    let target_player;
    let target_plane;
    let moved_plane;
    let player_after_wild;
    let player_after_both_cards;
    let state_after_cards;
    let state_after_move;

    if (Unoludo.is_ended(state)) {
        return undefined;
    }

    if (wild_card === undefined || number_card === undefined) {
        return undefined;
    }

    if (wild_card.type !== "wild") {
        return undefined;
    }

    if (
        number_card.type !== "number" ||
        number_card.value < 1 ||
        number_card.value > 6
    ) {
        return undefined;
    }

    target_player = state.players[target_player_id];

    if (target_player === undefined) {
        return undefined;
    }

    target_plane = target_player.planes[target_plane_index];

    if (target_plane === undefined) {
        return undefined;
    }

    if (target_plane.frozen) {
        return undefined;
    }

    if (target_plane.status === "base") {
        if (number_card.value !== 6) {
            return undefined;
        }

        moved_plane = Object.freeze({
            status: "gate",
            position: -1,
            shielded: false,
            frozen: false
        });
    } else {
        moved_plane = move_active_plane(
            target_plane,
            number_card.value,
            target_player.colour
        );

        if (moved_plane === undefined) {
            return undefined;
        }
    }

    player_after_wild = Unoludo.remove_card_from_hand(
        player,
        wild_card_id
    );

    if (player_after_wild === undefined) {
        return undefined;
    }

    player_after_both_cards = Unoludo.remove_card_from_hand(
        player_after_wild,
        number_card_id
    );

    if (player_after_both_cards === undefined) {
        return undefined;
    }

    state_after_cards = Object.freeze({
        draw_pile: state.draw_pile,
        discard_pile: Object.freeze(
            state.discard_pile.concat([wild_card, number_card])
        ),
        players: replace_player(
            state.players,
            player.id,
            player_after_both_cards
        ),
        current_player: state.current_player,
        active_colour: number_card.colour,
        winner: state.winner,
        player_moods: player_moods_for_state(state),
        log: Object.freeze(state.log.concat([
            player.name + " played Wild with "
            + number_card.colour + " " + number_card.value
            + ", and affected "
            + target_player.name + "'s plane "
            + target_plane_index + "."
        ]))
    });

    state_after_move = Unoludo.update_plane(
        state_after_cards,
        target_player_id,
        target_plane_index,
        moved_plane
    );

    state_after_move = Unoludo.resolve_captures(
        state_after_move,
        target_player_id,
        target_plane_index
    );

    return grant_empty_hand_bonus(
        state_after_move,
        player.id
    );
};

/**
 * Advance all active planes belonging to one player by two spaces.
 *
 * Planes in base or finished are not affected. If any active plane cannot move
 * by exactly two spaces, that plane stays where it is.
 *
 * @function
 * @param {Unoludo.Player} player The player whose planes are advanced.
 * @returns {Unoludo.Player} The updated player.
 */
const advance_all_active_planes = function (player) {
    return Object.freeze({
        id: player.id,
        name: player.name,
        colour: player.colour,
        kind: player.kind,
        hand: player.hand,
        planes: Object.freeze(player.planes.map(function (plane) {
            const moved_plane = move_active_plane(plane, 2, player.colour);

            if (moved_plane === undefined) {
                return plane;
            }

            return moved_plane;
        }))
    });
};

/**
 * Play a Wild +4 card.
 *
 * Wild +4 gives the player a choice:
 * - "draw4": draw four cards;
 * - "advance_all": move all active own planes forward by two spaces.
 *
 * Planes in base or finished are not affected by "advance_all".
 *
 * @memberof Unoludo
 * @function
 * @param {Unoludo.State} state The current game state.
 * @param {string} card_id The Wild +4 card id.
 * @param {"draw4" | "advance_all"} option The chosen effect.
 * @returns {(Unoludo.State | undefined)} The updated state, or undefined.
 */
Unoludo.play_wild4_card = function (state, card_id, option, chosen_colour) {
    const player = Unoludo.current_player(state);
    const card = Unoludo.card_in_hand(player, card_id);
    let player_after_card;
    let advanced_player;
    let state_after_card;

    if (Unoludo.is_ended(state)) {
        return undefined;
    }

    if (card === undefined) {
        return undefined;
    }

    if (card.type !== "wild4") {
        return undefined;
    }

    if (option !== "draw4" && option !== "advance_all") {
        return undefined;
    }

    if (!is_valid_colour(chosen_colour)) {
        return undefined;
    }

    player_after_card = Unoludo.remove_card_from_hand(player, card_id);

    if (player_after_card === undefined) {
        return undefined;
    }

    state_after_card = Object.freeze({
        draw_pile: state.draw_pile,
        discard_pile: Object.freeze(state.discard_pile.concat([card])),
        players: replace_player(
            state.players,
            player.id,
            player_after_card
        ),
        current_player: state.current_player,
        active_colour: chosen_colour,
        winner: state.winner,
        player_moods: player_moods_for_state(state),
        log: Object.freeze(state.log.concat([
            player.name + " played Wild +4 and chose " + chosen_colour + "."
        ]))
    });

    if (option === "draw4") {
        return Unoludo.draw_cards(
            state_after_card,
            player.id,
            4
        );
    }

    advanced_player = advance_all_active_planes(player_after_card);

    state_after_card = Unoludo.update_player(
        state_after_card,
        player.id,
        advanced_player
    );

    advanced_player.planes.forEach(function (plane, plane_index) {
        if (plane.status === "track") {
            state_after_card = Unoludo.resolve_captures(
                state_after_card,
                player.id,
                plane_index
            );
        }
    });

    return grant_empty_hand_bonus(state_after_card, player.id);
};



export default Object.freeze(Unoludo);
