//import R from "./ramda.js";
import Unoludo from "./unoludo.js";
import UnoludoBoard from "./board_positions.js";
import UnoludoAssets from "./assets.js";

/*global document, window*/

let state = Unoludo.create_initial_state([
    "Player",
    "CPU Green",
    "CPU Red",
    "CPU Yellow"
], {
    shuffle: true
});
let rendered_discard_card_id = undefined;
let selected_card_id = undefined;
let combo_card_id = undefined;
let target_mode = undefined;
let cpu_timer = undefined;
let winner_popup_shown = false;
const CPU_TURN_DELAY = 1600;
const piece_elements = Object.create(null);
const draw_end_turn_button = document.getElementById("draw-end-turn");
const clear_selection = function () {
    selected_card_id = undefined;
    combo_card_id = undefined;
    target_mode = undefined;
};
const colour_overlay = document.getElementById("colour-overlay");
const colour_choice_buttons = document.querySelectorAll(".colour-choice");

const wild4_option_overlay = document.getElementById("wild4-option-overlay");
const wild4_draw4_choice = document.getElementById("wild4-draw4-choice");
const wild4_move_choice = document.getElementById("wild4-move-choice");
const winner_overlay = document.getElementById("winner-overlay");
const winner_name = document.getElementById("winner-name");
const winner_restart_button = document.getElementById("winner-restart");
const player_colour_hex = function (colour) {
    if (colour === "blue") {
        return "#4979E0";
    }

    if (colour === "green") {
        return "#48DB73";
    }

    if (colour === "red") {
        return "#BD2222";
    }

    if (colour === "yellow") {
        return "#E5CA22";
    }

    return "#f8fafc";
};
const show_winner_popup = function () {
    let winner;

    if (state.winner === undefined || winner_popup_shown) {
        return;
    }

    winner = state.players[state.winner];

    winner_name.textContent = winner.name;
    winner_name.style.color = player_colour_hex(winner.colour);

    winner_overlay.classList.remove("hidden");
    winner_popup_shown = true;
};

const hide_winner_popup = function () {
    winner_overlay.classList.add("hidden");
};
const played_card_title = document.getElementById("played-card-title");
const played_card_image = document.getElementById("played-card-image");
const open_log_button = document.getElementById("open-log");
const log_overlay = document.getElementById("log-overlay");
const close_log_button = document.getElementById("close-log");
const log_overlay_list = document.getElementById("log-overlay-list");
const debug_move_button = document.getElementById("debug-move");
const give_card_button = document.getElementById("give-card");
const help_overlay = document.getElementById("help-overlay");
const help_image = document.getElementById("help-image");
const help_page_indicator = document.getElementById("help-page-indicator");
const open_help_button = document.getElementById("open-help");
const close_help_button = document.getElementById("close-help");
const help_prev_button = document.getElementById("help-prev");
const help_next_button = document.getElementById("help-next");
const help_pages = Object.freeze([
    "./assets/img/help1.png",
    "./assets/img/help2.png",
    "./assets/img/help3.png"
]);

let help_page_index = 0;

const render_log_overlay = function () {
    log_overlay_list.replaceChildren();

    state.log.forEach(function (message) {
        const item = document.createElement("li");
        item.textContent = message;
        log_overlay_list.appendChild(item);
    });
};

const open_log = function () {
    render_log_overlay();
    log_overlay.classList.remove("hidden");
};

const close_log = function () {
    log_overlay.classList.add("hidden");
};

const player_id_by_colour = function (colour) {
    const player = state.players.find(function (candidate) {
        return candidate.colour === colour;
    });

    if (player === undefined) {
        return undefined;
    }

    return player.id;
};

const debug_plane_from_input = function (position_input) {
    const trimmed = position_input.trim().toLowerCase();
    let value;

    if (trimmed === "base") {
        return Object.freeze({
            status: "base",
            position: -1,
            shielded: false,
            frozen: false
        });
    }

    if (trimmed === "finished") {
        return Object.freeze({
            status: "finished",
            position: Unoludo.home_lane_length,
            shielded: false,
            frozen: false
        });
    }

    if (trimmed.startsWith("home:")) {
        value = Number(trimmed.slice(5));

        if (
            Number.isInteger(value) &&
            value >= 0 &&
            value < Unoludo.home_lane_length
        ) {
            return Object.freeze({
                status: "home",
                position: value,
                shielded: false,
                frozen: false
            });
        }

        return undefined;
    }

    if (trimmed.startsWith("track:")) {
        value = Number(trimmed.slice(6));
    } else {
        value = Number(trimmed);
    }

    if (
        Number.isInteger(value) &&
        value >= 0 &&
        value < Unoludo.track_length
    ) {
        return Object.freeze({
            status: "track",
            position: value,
            shielded: false,
            frozen: false
        });
    }

    return undefined;
};

debug_move_button.addEventListener("click", function () {
    const colour = window.prompt(
        "Choose plane colour: blue, green, red, yellow"
    );

    const plane_index_text = window.prompt(
        "Choose plane index: 0, 1, 2, or 3"
    );

    const position_text = window.prompt(
        "Enter position: number, track:number, home:number, base, or finished"
    );

    const player_id = player_id_by_colour(
        colour === null
        ? ""
        : colour.trim().toLowerCase()
    );

    const plane_index = Number(plane_index_text);
    const new_plane = (
        position_text === null
        ? undefined
        : debug_plane_from_input(position_text)
    );

    if (
        player_id === undefined ||
        !Number.isInteger(plane_index) ||
        plane_index < 0 ||
        plane_index > 3 ||
        new_plane === undefined
    ) {
        action_message.textContent = "Debug move failed: invalid input.";
        return;
    }

    state = Unoludo.update_plane(
        state,
        player_id,
        plane_index,
        new_plane
    );

    clear_selection();
    action_message.textContent = (
        "Debug moved " + colour + " plane " + plane_index + "."
    );
    render();
});

const colour_from_card_code = function (letter) {
    if (letter === "B") {
        return "blue";
    }

    if (letter === "G") {
        return "green";
    }

    if (letter === "R") {
        return "red";
    }

    if (letter === "Y") {
        return "yellow";
    }

    return undefined;
};

const create_debug_card_from_code = function (code) {
    const normalised = code.trim().toUpperCase();
    const colour = colour_from_card_code(normalised[0]);
    const symbol = normalised.slice(1);
    const unique_suffix = Date.now() + "-" + Math.random().toString(36).slice(2);
    let value;

    if (normalised === "PW") {
        return Unoludo.card(
            "debug-wild-" + unique_suffix,
            "wild",
            "wild"
        );
    }

    if (normalised === "P4") {
        return Unoludo.card(
            "debug-wild4-" + unique_suffix,
            "wild4",
            "wild"
        );
    }

    if (
        normalised === "P7" ||
        normalised === "P8" ||
        normalised === "P9"
    ) {
        value = Number(normalised.slice(1));

        return Unoludo.card(
            "debug-reward-" + value + "-" + unique_suffix,
            "reward",
            "wild",
            value
        );
    }

    if (colour === undefined) {
        return undefined;
    }

    if (/^[0-6]$/.test(symbol)) {
        value = Number(symbol);

        return Unoludo.card(
            "debug-" + colour + "-number-" + value + "-" + unique_suffix,
            "number",
            colour,
            value
        );
    }

    if (symbol === "S") {
        return Unoludo.card(
            "debug-" + colour + "-skip-" + unique_suffix,
            "skip",
            colour
        );
    }

    if (symbol === "R") {
        return Unoludo.card(
            "debug-" + colour + "-reverse-" + unique_suffix,
            "reverse",
            colour
        );
    }

    if (symbol === "P" || symbol === "+2") {
        return Unoludo.card(
            "debug-" + colour + "-draw2-" + unique_suffix,
            "draw2",
            colour
        );
    }

    return undefined;
};

const give_card_to_current_player = function (card) {
    const player = Unoludo.current_player(state);
    const updated_player = Object.freeze({
        id: player.id,
        name: player.name,
        colour: player.colour,
        kind: player.kind,
        hand: Unoludo.sorted_hand(player.hand.concat([card])),
        planes: player.planes
    });

    state = Unoludo.update_player(
        state,
        player.id,
        updated_player
    );
};

give_card_button.addEventListener("click", function () {
    const code = window.prompt(
        "Enter card code, e.g. B3, YR, GS, RP, PW, P4, P7, P8, P9"
    );

    let card;

    if (code === null) {
        return;
    }

    card = create_debug_card_from_code(code);

    if (card === undefined) {
        action_message.textContent = "Give card failed: invalid card code.";
        return;
    }

    give_card_to_current_player(card);
    clear_selection();
    action_message.textContent = "Gave card " + code.toUpperCase() + " to current player.";
    render();
});

const render_help_page = function () {
    help_image.src = help_pages[help_page_index];
    help_image.alt = "Unoludo help page " + (help_page_index + 1);
    help_page_indicator.textContent = (
        (help_page_index + 1) + " / " + help_pages.length
    );
};

const open_help = function () {
    help_page_index = 0;
    render_help_page();
    help_overlay.classList.remove("hidden");
};

const close_help = function () {
    help_overlay.classList.add("hidden");
};

const show_previous_help_page = function () {
    help_page_index = (
        help_page_index - 1 + help_pages.length
    ) % help_pages.length;

    render_help_page();
};

const show_next_help_page = function () {
    help_page_index = (
        help_page_index + 1
    ) % help_pages.length;

    render_help_page();
};

open_help_button.addEventListener("click", open_help);
close_help_button.addEventListener("click", close_help);
help_prev_button.addEventListener("click", show_previous_help_page);
help_next_button.addEventListener("click", show_next_help_page);
open_log_button.addEventListener("click", open_log);
close_log_button.addEventListener("click", close_log);

const is_active_plane = function (plane) {
    return plane.status === "track" || plane.status === "home";
};

const choose_colour_for_cpu = function (player) {
    const counts = {
        blue: 0,
        green: 0,
        red: 0,
        yellow: 0
    };

    let best_colour = player.colour;

    player.hand.forEach(function (card) {
        if (counts[card.colour] !== undefined) {
            counts[card.colour] += 1;
        }
    });

    Object.keys(counts).forEach(function (colour) {
        if (counts[colour] > counts[best_colour]) {
            best_colour = colour;
        }
    });

    return best_colour;
};

const find_cpu_number_move = function (cpu_state, player) {
    let result;

    player.hand.some(function (card) {
        if (
            !Unoludo.can_play_card(card, cpu_state) ||
            card.type !== "number" ||
            card.value < 1 ||
            card.value > 6
        ) {
            return false;
        }

        return player.planes.some(function (plane, plane_index) {
            const next_state = Unoludo.play_number_card(
                cpu_state,
                card.id,
                plane_index
            );

            if (next_state !== undefined) {
                result = {
                    state: next_state,
                    message: player.name + " played a number card."
                };
                return true;
            }

            return false;
        });
    });

    return result;
};

const find_cpu_zero_move = function (cpu_state, player) {
    let result;

    player.hand.some(function (card) {
        if (
            !Unoludo.can_play_card(card, cpu_state) ||
            card.type !== "number" ||
            card.value !== 0
        ) {
            return false;
        }

        return player.planes.some(function (plane, plane_index) {
            const next_state = Unoludo.play_zero_card(
                cpu_state,
                card.id,
                plane_index
            );

            if (next_state !== undefined) {
                result = {
                    state: next_state,
                    message: player.name + " played a shield card."
                };
                return true;
            }

            return false;
        });
    });

    return result;
};

const find_cpu_draw2_move = function (cpu_state, player) {
    let result;

    player.hand.some(function (card) {
        let next_state;

        if (
            !Unoludo.can_play_card(card, cpu_state) ||
            card.type !== "draw2"
        ) {
            return false;
        }

        next_state = Unoludo.play_draw2_card(cpu_state, card.id);

        if (next_state !== undefined) {
            result = {
                state: next_state,
                message: player.name + " played +2."
            };
            return true;
        }

        return false;
    });

    return result;
};

const find_cpu_skip_move = function (cpu_state, player) {
    let result;

    player.hand.some(function (card) {
        if (
            !Unoludo.can_play_card(card, cpu_state) ||
            card.type !== "skip"
        ) {
            return false;
        }

        return cpu_state.players.some(function (target_player) {
            if (target_player.id === player.id) {
                return false;
            }

            return target_player.planes.some(function (plane, plane_index) {
                const next_state = Unoludo.play_skip_card(
                    cpu_state,
                    card.id,
                    target_player.id,
                    plane_index
                );

                if (next_state !== undefined) {
                    result = {
                        state: next_state,
                        message: player.name + " played Skip."
                    };
                    return true;
                }

                return false;
            });
        });
    });

    return result;
};

const find_cpu_reverse_move = function (cpu_state, player) {
    let result;

    player.hand.some(function (reverse_card) {
        if (
            reverse_card.type !== "reverse" ||
            !Unoludo.can_play_card(reverse_card, cpu_state)
        ) {
            return false;
        }

        return player.hand.some(function (number_card) {
            if (
                number_card.type !== "number" ||
                number_card.value < 1 ||
                number_card.value > 6 ||
                number_card.colour !== reverse_card.colour
            ) {
                return false;
            }

            return cpu_state.players.some(function (target_player) {
                if (target_player.id === player.id) {
                    return false;
                }

                return target_player.planes.some(function (plane, plane_index) {
                    const next_state = Unoludo.play_reverse_combo(
                        cpu_state,
                        reverse_card.id,
                        number_card.id,
                        target_player.id,
                        plane_index
                    );

                    if (next_state !== undefined) {
                        result = {
                            state: next_state,
                            message: player.name + " played Reverse combo."
                        };
                        return true;
                    }

                    return false;
                });
            });
        });
    });

    return result;
};

const find_cpu_wild_move = function (cpu_state, player) {
    let result;

    player.hand.some(function (wild_card) {
        if (
            wild_card.type !== "wild" ||
            !Unoludo.can_play_card(wild_card, cpu_state)
        ) {
            return false;
        }

        return player.hand.some(function (number_card) {
            if (
                number_card.type !== "number" ||
                number_card.value < 1 ||
                number_card.value > 6
            ) {
                return false;
            }

            return cpu_state.players.some(function (target_player) {
                return target_player.planes.some(function (plane, plane_index) {
                    const next_state = Unoludo.play_wild_combo(
                        cpu_state,
                        wild_card.id,
                        number_card.id,
                        target_player.id,
                        plane_index,
                        choose_colour_for_cpu(player)
                    );

                    if (next_state !== undefined) {
                        result = {
                            state: next_state,
                            message: player.name + " played Wild combo."
                        };
                        return true;
                    }

                    return false;
                });
            });
        });
    });

    return result;
};

const find_cpu_wild4_move = function (cpu_state, player) {
    let result;

    player.hand.some(function (card) {
        const has_active_plane = player.planes.some(is_active_plane);
        let next_state;

        if (
            card.type !== "wild4" ||
            !Unoludo.can_play_card(card, cpu_state)
        ) {
            return false;
        }

        next_state = Unoludo.play_wild4_card(
            cpu_state,
            card.id,
            (
                has_active_plane
                ? "advance_all"
                : "draw4"
            ),
            choose_colour_for_cpu(player)
        );

        if (next_state !== undefined) {
            result = {
                state: next_state,
                message: player.name + " played Wild +4."
            };
            return true;
        }

        return false;
    });

    return result;
};

const find_cpu_reward_move = function (cpu_state, player) {
    let result;

    player.hand.some(function (card) {
        if (card.type !== "reward") {
            return false;
        }

        player.planes.some(function (plane, plane_index) {
            const next_state = Unoludo.play_reward_card(
                cpu_state,
                card.id,
                player.id,
                plane_index,
                choose_colour_for_cpu(player)
            );

            if (next_state !== undefined) {
                result = {
                    state: next_state,
                    message: player.name + " played reward " + card.value + "."
                };
                return true;
            }

            return false;
        });

        if (result !== undefined) {
            return true;
        }

        return cpu_state.players.some(function (target_player) {
            return target_player.planes.some(function (plane, plane_index) {
                const next_state = Unoludo.play_reward_card(
                    cpu_state,
                    card.id,
                    target_player.id,
                    plane_index,
                    choose_colour_for_cpu(player)
                );

                if (next_state !== undefined) {
                    result = {
                        state: next_state,
                        message: player.name + " played reward " + card.value + "."
                    };
                    return true;
                }

                return false;
            });
        });
    });

    return result;
};

const find_cpu_action = function (cpu_state) {
    const player = Unoludo.current_player(cpu_state);

    return (
        find_cpu_reward_move(cpu_state, player) ||
        find_cpu_number_move(cpu_state, player) ||
        find_cpu_draw2_move(cpu_state, player) ||
        find_cpu_skip_move(cpu_state, player) ||
        find_cpu_reverse_move(cpu_state, player) ||
        find_cpu_wild_move(cpu_state, player) ||
        find_cpu_wild4_move(cpu_state, player) ||
        find_cpu_zero_move(cpu_state, player)
    );
};

const cpu_take_turn = function () {
    const player = Unoludo.current_player(state);
    const action = find_cpu_action(state);

    if (player.kind !== "cpu") {
        return;
    }

    if (action !== undefined) {
        state = Unoludo.end_turn(action.state);
        clear_selection();
        action_message.textContent = action.message;
        render();
        return;
    }

    state = Unoludo.draw_one_and_end_turn(state);
    clear_selection();
    action_message.textContent = player.name + " drew one card and ended turn.";
    render();
};

const schedule_cpu_if_needed = function () {
    const player = Unoludo.current_player(state);

    if (Unoludo.is_ended(state)) {
        return;
    }

    if (player.kind !== "cpu") {
        return;
    }

    if (cpu_timer !== undefined) {
        return;
    }

    action_message.textContent = player.name + " is thinking...";

    cpu_timer = window.setTimeout(function () {
        cpu_timer = undefined;
        cpu_take_turn();
    }, CPU_TURN_DELAY);
};

const choose_colour_with_modal = function () {
    return new Promise(function (resolve) {
        const close_with_colour = function (colour) {
            colour_overlay.classList.add("hidden");

            colour_choice_buttons.forEach(function (button) {
                button.onclick = null;
            });

            resolve(colour);
        };

        colour_choice_buttons.forEach(function (button) {
            button.onclick = function () {
                close_with_colour(button.dataset.colour);
            };
        });

        colour_overlay.classList.remove("hidden");
    });
};

const choose_wild4_option_with_modal = function () {
    return new Promise(function (resolve) {
        wild4_draw4_choice.onclick = function () {
            wild4_option_overlay.classList.add("hidden");
            wild4_draw4_choice.onclick = null;
            wild4_move_choice.onclick = null;
            resolve("draw4");
        };

        wild4_move_choice.onclick = function () {
            wild4_option_overlay.classList.add("hidden");
            wild4_draw4_choice.onclick = null;
            wild4_move_choice.onclick = null;
            resolve("advance_all");
        };

        wild4_option_overlay.classList.remove("hidden");
    });
};
const piece_layer = document.getElementById("piece-layer");
const discard_layer = document.getElementById("discard-layer");
const hand_cards = document.getElementById("hand-cards");
const current_player_text = document.getElementById("current-player");
const top_discard = document.getElementById("top-discard");
const draw_count_text = document.getElementById("draw-count");
const game_log = document.getElementById("game-log");
const action_message = document.getElementById("action-message");

const finish_successful_action = function (next_state, message) {
    state = Unoludo.end_turn(next_state);
    clear_selection();
    action_message.textContent = message;
    render();
};

const play_selected_card_without_plane = async function () {
    const player = Unoludo.current_player(state);
    const card = Unoludo.card_in_hand(player, selected_card_id);
    let next_state;

    if (card === undefined) {
        return;
    }

    if (card.type === "reverse") {
        const reverse_is_playable = Unoludo.can_play_card(card, state);
        const has_matching_number = player.hand.some(function (hand_card) {
            return (
                hand_card.id !== card.id &&
                hand_card.type === "number" &&
                hand_card.value > 0 &&
                hand_card.colour === card.colour
            );
        });
        const has_playable_matching_number = player.hand.some(function (hand_card) {
            return (
                hand_card.id !== card.id &&
                hand_card.type === "number" &&
                hand_card.value > 0 &&
                hand_card.colour === card.colour &&
                Unoludo.can_play_card(hand_card, state)
            );
        });

        if (!has_matching_number) {
            clear_selection();
            action_message.textContent = "Reverse needs a same-colour number card.";
            render();
            return;
        }

        if (!reverse_is_playable && !has_playable_matching_number) {
            action_message.textContent = "That Reverse combo cannot be played on the current discard.";
            return;
        }

        target_mode = "reverse_number";
        combo_card_id = undefined;
        action_message.textContent = "Select a same-colour number card for Reverse.";
        return;
    }

    if (!Unoludo.can_play_card(card, state)) {
        action_message.textContent = "That card cannot be played on the current discard.";
        return;
    }
    
    if (card.type === "wild") {
        const has_number_card = player.hand.some(function (hand_card) {
            return (
                hand_card.id !== card.id &&
                hand_card.type === "number" &&
                hand_card.value > 0
            );
        });

        if (!has_number_card) {
            clear_selection();
            action_message.textContent = "Wild needs a number card.";
            render();
            return;
        }

        target_mode = "wild_number";
        combo_card_id = undefined;
        action_message.textContent = "Select a number card for Wild.";
        return;
    }

    if (card.type === "number" && card.value === 0) {
        action_message.textContent = "Select one of your active planes to shield.";
        return;
    }

    if (card.type === "draw2") {
        next_state = Unoludo.play_draw2_card(
            state,
            selected_card_id
        );

        if (next_state === undefined) {
            action_message.textContent = "That +2 card cannot be played.";
            return;
        }

        finish_successful_action(
            next_state,
            "Played +2, drew two cards, and ended turn."
        );
    }

    if (card.type === "wild4") {
        const option = await choose_wild4_option_with_modal();
        const chosen_colour = await choose_colour_with_modal();

        next_state = Unoludo.play_wild4_card(
            state,
            selected_card_id,
            option,
            chosen_colour
        );

        if (next_state === undefined) {
            action_message.textContent = "That Wild +4 card cannot be played.";
            return;
        }

        finish_successful_action(
            next_state,
            (
                option === "advance_all"
                ? "Played Wild +4 and advanced all active planes."
                : "Played Wild +4 and drew four cards."
            )
        );

        return;
    }

    if (card.type === "skip") {
        target_mode = "skip";
        action_message.textContent = "Select one active plane belonging to the next player.";
        return;
    }

    if (card.type === "reward") {
        target_mode = "reward_target";
        action_message.textContent = "Select any active plane for reward " + card.value + ".";
        return;
    }
};

const play_reward_on_plane = async function (target_player_id, plane_index) {
    const chosen_colour = await choose_colour_with_modal();

    const next_state = Unoludo.play_reward_card(
        state,
        selected_card_id,
        target_player_id,
        plane_index,
        chosen_colour
    );

    if (next_state === undefined) {
        action_message.textContent = "That reward target is not legal.";
        return;
    }

    target_mode = undefined;
    finish_successful_action(
        next_state,
        "Played reward card, chose " + chosen_colour + ", and moved a plane."
    );
};


const play_selected_card_on_plane = function (plane_index) {
    const player = Unoludo.current_player(state);
    const card = Unoludo.card_in_hand(player, selected_card_id);
    let next_state;

    if (card === undefined) {
        action_message.textContent = "Select a card first.";
        return;
    }

    if (!Unoludo.can_play_card(card, state)) {
        action_message.textContent = "That card cannot be played on the current discard.";
        return;
    }

    if (card.type === "number" && card.value > 0) {
        next_state = Unoludo.play_number_card(
            state,
            selected_card_id,
            plane_index
        );
    }

    if (card.type === "number" && card.value === 0) {
        next_state = Unoludo.play_zero_card(
            state,
            selected_card_id,
            plane_index
        );
    }

    if (next_state === undefined) {
        action_message.textContent = "That move is not legal for this plane.";
        return;
    }

    finish_successful_action(next_state, "Move played and turn ended.");
};

const play_skip_on_plane = function (target_player_id, plane_index) {
    const next_state = Unoludo.play_skip_card(
        state,
        selected_card_id,
        target_player_id,
        plane_index
    );

    if (next_state === undefined) {
        action_message.textContent = "That Skip target is not legal.";
        return;
    }

    target_mode = undefined;
    finish_successful_action(
        next_state,
        "Played Skip and froze a plane."
    );
};

const play_reverse_on_plane = function (target_player_id, plane_index) {
    const next_state = Unoludo.play_reverse_combo(
        state,
        selected_card_id,
        combo_card_id,
        target_player_id,
        plane_index
    );

    if (next_state === undefined) {
        action_message.textContent = "That Reverse target is not legal.";
        return;
    }

    target_mode = undefined;
    combo_card_id = undefined;
    finish_successful_action(
        next_state,
        "Played Reverse combo and moved a plane backwards."
    );
};

const play_wild_on_plane = function (target_player_id, plane_index) {
    const next_state = Unoludo.play_wild_combo(
        state,
        selected_card_id,
        combo_card_id,
        target_player_id,
        plane_index
    );

    if (next_state === undefined) {
        action_message.textContent = "That Wild target is not legal.";
        return;
    }

    target_mode = undefined;
    combo_card_id = undefined;
    finish_successful_action(
        next_state,
        "Played Wild combo and moved a plane forward."
    );
};

const plane_position_key = function (player, plane, plane_index) {
    if (plane.status === "base") {
        return player.colour + "-base-" + plane_index;
    }

    if (plane.status === "track") {
        return "track-" + plane.position;
    }

    if (plane.status === "home") {
        return player.colour + "-home-" + plane.position;
    }

    if (plane.status === "finished") {
        return player.colour + "-finished-" + plane_index;
    }

    return "unknown";
};

const overlap_offset = function (overlap_index, overlap_count) {
    const offsets = [
        {x: 0, y: 0},
        {x: -1.15, y: -1.15},
        {x: 1.15, y: -1.15},
        {x: -1.15, y: 1.15},
        {x: 1.15, y: 1.15},
        {x: 0, y: -1.75},
        {x: 0, y: 1.75},
        {x: -1.75, y: 0},
        {x: 1.75, y: 0}
    ];

    if (overlap_count <= 1) {
        return offsets[0];
    }

    return offsets[overlap_index % offsets.length];
};

const piece_key_for = function (player, plane_index) {
    return "player-" + player.id + "-plane-" + plane_index;
};

const render_piece = function (
    player,
    plane,
    plane_index,
    overlap_index,
    overlap_count
) {
    let position = UnoludoBoard.position_for_plane(
        plane,
        player.colour,
        plane_index
    );

    const piece_key = piece_key_for(player, plane_index);
    const offset = overlap_offset(overlap_index, overlap_count);

    let piece = piece_elements[piece_key];
    let image;
    let image_src;
    let image_alt;

    if (plane.status === "finished") {
        position = UnoludoBoard.base_positions[player.colour][plane_index];
        image_src = UnoludoAssets.finished_marker;
        image_alt = player.colour + " finished marker";
    } else {
        image_src = UnoludoAssets.plane_image(player.colour);
        image_alt = player.colour + " plane";
    }

    if (position === undefined) {
        return;
    }

    if (piece === undefined) {
        piece = document.createElement("div");
        image = document.createElement("img");

        piece.dataset.pieceKey = piece_key;
        piece.appendChild(image);
        piece_layer.appendChild(piece);

        piece_elements[piece_key] = piece;
    } else {
        image = piece.querySelector("img");
    }

    piece.className = (
        plane.status === "finished"
        ? "finished-marker"
        : "piece"
    );

    piece.onclick = null;

    if (
        plane.status !== "finished" &&
        target_mode === "skip" &&
        player.id !== state.current_player
    ) {
        piece.className += " target-piece";
        piece.onclick = function () {
            play_skip_on_plane(player.id, plane_index);
        };
    } else if (
        plane.status !== "finished" &&
        target_mode === "reverse_target" &&
        player.id !== state.current_player
    ) {
        piece.className += " target-piece";
        piece.onclick = function () {
            play_reverse_on_plane(player.id, plane_index);
        };
    } else if (
        plane.status !== "finished" &&
        target_mode === "wild_target"
    ) {
        piece.className += " target-piece";
        piece.onclick = function () {
            play_wild_on_plane(player.id, plane_index);
        };
    } else if (
        plane.status !== "finished" &&
        target_mode === undefined &&
        player.id === state.current_player
    ) {
        piece.className += " current-player-piece";
        piece.onclick = function () {
            play_selected_card_on_plane(plane_index);
        };
    } else if (
        plane.status !== "finished" &&
        target_mode === "reward_target"
    ) {
        piece.className += " target-piece";
        piece.onclick = function () {
            play_reward_on_plane(player.id, plane_index);
        };
    }

    if (plane.status !== "finished" && plane.shielded) {
        piece.className += " shielded";
    }

    if (plane.status !== "finished" && plane.frozen) {
        piece.className += " frozen";
    }

    piece.style.left = (position.x + offset.x) + "%";
    piece.style.top = (position.y + offset.y) + "%";

    image.src = image_src;
    image.alt = image_alt;
};

const render_top_discard_on_board = function () {
    const top_card = Unoludo.top_discard(state);
    let image;

    if (
        rendered_discard_card_id !== undefined &&
        rendered_discard_card_id === top_card.id
    ) {
        return;
    }

    rendered_discard_card_id = top_card.id;
    discard_layer.replaceChildren();

    image = document.createElement("img");
    image.className = "center-discard-card";
    image.src = UnoludoAssets.card_image(top_card);
    image.alt = "Top discard: " + top_card.id;

    discard_layer.appendChild(image);
};

const render_pieces = function () {
    const groups = Object.create(null);
    const rendered_keys = Object.create(null);

    state.players.forEach(function (player) {
        player.planes.forEach(function (plane, plane_index) {
            const key = plane_position_key(player, plane, plane_index);

            if (groups[key] === undefined) {
                groups[key] = [];
            }

            groups[key].push({
                player: player,
                plane: plane,
                plane_index: plane_index
            });
        });
    });

    Object.keys(groups).forEach(function (key) {
        const group = groups[key];

        group.forEach(function (entry, overlap_index) {
            const piece_key = piece_key_for(
                entry.player,
                entry.plane_index
            );

            rendered_keys[piece_key] = true;

            render_piece(
                entry.player,
                entry.plane,
                entry.plane_index,
                overlap_index,
                group.length
            );
        });
    });

    Object.keys(piece_elements).forEach(function (piece_key) {
        if (rendered_keys[piece_key] !== true) {
            piece_elements[piece_key].remove();
            delete piece_elements[piece_key];
        }
    });
};

const render_hand = function () {
    const player = Unoludo.current_player(state);

    hand_cards.replaceChildren();

    player.hand.forEach(function (card) {
        const image = document.createElement("img");

        image.className = "card-image";

        if (Unoludo.can_play_card(card, state)) {
            image.className += " playable-card";
        }

        if (card.id === selected_card_id) {
            image.className += " selected-card";
        }
        if (card.id === combo_card_id) {
            image.className += " combo-card";
        }

        image.src = UnoludoAssets.card_image(card);
        image.alt = card.id;

        image.addEventListener("click", function () {
            const selected_card = Unoludo.card_in_hand(
                Unoludo.current_player(state),
                selected_card_id
            );

            if (target_mode === "reverse_number") {
                if (
                    selected_card !== undefined &&
                    card.type === "number" &&
                    card.value > 0 &&
                    card.colour === selected_card.colour
                ) {
                    combo_card_id = card.id;
                    target_mode = "reverse_target";
                    action_message.textContent = "Select an opponent plane to move backwards.";
                    render();
                    return;
                }

                clear_selection();
                selected_card_id = card.id;
                play_selected_card_without_plane().then(render);
                render();
                return;
            }

            if (target_mode === "wild_number") {
                if (
                    card.type === "number" &&
                    card.value > 0
                ) {
                    combo_card_id = card.id;
                    target_mode = "wild_target";
                    action_message.textContent = "Select any active plane to move forward.";
                    render();
                    return;
                }

                clear_selection();
                selected_card_id = card.id;
                play_selected_card_without_plane().then(render);
                render();
                return;
            }

            clear_selection();
            selected_card_id = card.id;
            play_selected_card_without_plane().then(render);
            render();
        });

        hand_cards.appendChild(image);
    });
};

const render_info = function () {
    const current_player = Unoludo.current_player(state);
    const previous_player_id = (
        state.current_player - 1 + state.players.length
    ) % state.players.length;
    const previous_player = state.players[previous_player_id];
    const top_card = Unoludo.top_discard(state);
    let winner;

    if (state.winner !== undefined) {
        winner = state.players[state.winner];

        current_player_text.textContent = "Winner: " + winner.name;
        action_message.textContent = winner.name + " wins the game!";
    } else {
        current_player_text.textContent = (
            "Current Player: " + current_player.name
        );
    }

    if (state.log.length === 1) {
        played_card_title.textContent = "The First Card:";
    } else {
        played_card_title.textContent = previous_player.name + " Played:";
    }

    played_card_image.src = UnoludoAssets.card_image(top_card);
    played_card_image.alt = "Last played card: " + top_card.id;

    draw_count_text.textContent = "Draw Pile: " + state.draw_pile.length;

    if (game_log !== null) {
        game_log.replaceChildren();

        state.log.slice(-5).forEach(function (message) {
            const item = document.createElement("li");
            item.textContent = message;
            game_log.appendChild(item);
        });
    }
    if (state.winner !== undefined) {
        show_winner_popup();
    }
};

const render = function () {
    render_top_discard_on_board();
    render_pieces();
    render_hand();
    render_info();
    schedule_cpu_if_needed();
};

const set_demo_plane = function (status, position) {
    const player = state.players[0];

    const blue_plane = Object.freeze({
        status: status,
        position: position,
        shielded: false,
        frozen: false
    });

    state = Unoludo.update_plane(
        state,
        player.id,
        0,
        blue_plane
    );

    render();
};

const restart_game = function () {
    Object.keys(piece_elements).forEach(function (piece_key) {
        piece_elements[piece_key].remove();
        delete piece_elements[piece_key];
    });

    if (cpu_timer !== undefined) {
        window.clearTimeout(cpu_timer);
        cpu_timer = undefined;
    }

    state = Unoludo.create_initial_state([
        "Player",
        "CPU Green",
        "CPU Red",
        "CPU Yellow"
    ], {
        shuffle: true
    });
    rendered_discard_card_id = undefined;
    winner_popup_shown = false;
    clear_selection();
    hide_winner_popup();
    action_message.textContent = "Game reset.";
    render();
};

document.getElementById("reset-demo").addEventListener("click", restart_game);
winner_restart_button.addEventListener("click", restart_game);

document.getElementById("draw-end-turn").addEventListener("click", function () {
    const next_state = Unoludo.draw_one_and_end_turn(state);

    if (next_state !== undefined) {
        state = next_state;
        clear_selection();
        action_message.textContent = "Drew one card and ended turn.";
        render();
    }
});

const cancel_action_button = document.getElementById("cancel-action");

if (cancel_action_button !== null) {
    cancel_action_button.addEventListener("click", function () {
        clear_selection();
        action_message.textContent = "Selection cancelled.";
        render();
    });
}

render();