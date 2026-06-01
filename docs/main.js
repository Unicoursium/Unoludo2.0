//import R from "./ramda.js";
import Unoludo from "./unoludo.js";
import UnoludoBoard from "./board_positions.js";
import UnoludoAssets from "./assets.js";

/*global document, window*/

let state = undefined;
let rendered_discard_card_id = undefined;
let selected_card_id = undefined;
let combo_card_id = undefined;
let target_mode = undefined;
let cpu_timer = undefined;
let winner_popup_shown = false;
let sound_enabled = true;
let cpu_difficulty = "medium";
let audio_context = undefined;
let pending_render_effects = undefined;
let gameMode = "none";
let myPlayerIndex = 0;
let mpStateSynced = false;
let multiplayerCpuAuthorityIndex = 0;
const draw_streaks = Object.create(null);
const CPU_TURN_DELAY = 1600;
const CPU_DIFFICULTIES = Object.freeze(["easy", "medium", "hard"]);
const piece_elements = Object.create(null);
const previous_piece_snapshots = Object.create(null);
const draw_end_turn_button = document.getElementById("draw-end-turn");
const sound_toggle_button = document.getElementById("sound-toggle");

const initGameState = function (playerNames, options) {
    state = Unoludo.create_initial_state(playerNames, options || {});

    if (options !== undefined && options.playerKinds !== undefined) {
        state = Object.freeze({
            draw_pile: state.draw_pile,
            discard_pile: state.discard_pile,
            players: Object.freeze(state.players.map(function (player, index) {
                return Object.freeze({
                    id: player.id,
                    name: player.name,
                    colour: player.colour,
                    kind: options.playerKinds[index] || player.kind,
                    hand: player.hand,
                    planes: player.planes
                });
            })),
            current_player: state.current_player,
            active_colour: state.active_colour,
            winner: state.winner,
            player_moods: state.player_moods,
            log: state.log
        });
    }

    return state;
};

const audio_context_class = window.AudioContext || window.webkitAudioContext;

const audio_time = function () {
    if (!sound_enabled || audio_context_class === undefined) {
        return undefined;
    }

    if (audio_context === undefined) {
        audio_context = new audio_context_class();
    }

    if (audio_context.state === "suspended") {
        audio_context.resume();
    }

    return audio_context.currentTime;
};

const connect_to_output = function (node, gain_value, start_time, duration) {
    const gain = audio_context.createGain();

    gain.gain.setValueAtTime(0.0001, start_time);
    gain.gain.exponentialRampToValueAtTime(gain_value, start_time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start_time + duration);

    node.connect(gain);
    gain.connect(audio_context.destination);

    return gain;
};

const create_noise_source = function (duration) {
    const sample_rate = audio_context.sampleRate;
    const buffer = audio_context.createBuffer(
        1,
        Math.max(1, Math.floor(sample_rate * duration)),
        sample_rate
    );
    const data = buffer.getChannelData(0);
    const source = audio_context.createBufferSource();
    let index;

    for (index = 0; index < data.length; index += 1) {
        data[index] = Math.random() * 2 - 1;
    }

    source.buffer = buffer;
    return source;
};

const play_tone = function (frequency, duration, type, gain_value, delay) {
    const start_time = audio_time();
    let oscillator;

    if (start_time === undefined) {
        return;
    }

    oscillator = audio_context.createOscillator();
    oscillator.type = type || "sine";
    oscillator.frequency.setValueAtTime(frequency, start_time + (delay || 0));
    connect_to_output(
        oscillator,
        gain_value || 0.08,
        start_time + (delay || 0),
        duration
    );
    oscillator.start(start_time + (delay || 0));
    oscillator.stop(start_time + (delay || 0) + duration + 0.02);
};

const playCardSound = function () {
    const start_time = audio_time();
    const noise = start_time === undefined ? undefined : create_noise_source(0.055);
    let filter;

    if (noise === undefined) {
        return;
    }

    filter = audio_context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1850, start_time);
    filter.Q.setValueAtTime(7, start_time);
    noise.connect(filter);
    connect_to_output(filter, 0.16, start_time, 0.055);
    noise.start(start_time);
    noise.stop(start_time + 0.07);
};

const playMoveSound = function () {
    const start_time = audio_time();
    const noise = start_time === undefined ? undefined : create_noise_source(0.22);
    let filter;

    if (noise === undefined) {
        return;
    }

    filter = audio_context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(280, start_time);
    filter.frequency.exponentialRampToValueAtTime(1450, start_time + 0.18);
    noise.connect(filter);
    connect_to_output(filter, 0.08, start_time, 0.22);
    noise.start(start_time);
    noise.stop(start_time + 0.24);
};

const playCaptureSound = function () {
    const start_time = audio_time();
    const thump = start_time === undefined ? undefined : audio_context.createOscillator();
    const crack = start_time === undefined ? undefined : create_noise_source(0.08);
    let filter;

    if (thump === undefined || crack === undefined) {
        return;
    }

    thump.type = "sine";
    thump.frequency.setValueAtTime(110, start_time);
    thump.frequency.exponentialRampToValueAtTime(48, start_time + 0.16);
    connect_to_output(thump, 0.18, start_time, 0.18);
    thump.start(start_time);
    thump.stop(start_time + 0.2);

    filter = audio_context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(2600, start_time);
    crack.connect(filter);
    connect_to_output(filter, 0.13, start_time, 0.075);
    crack.start(start_time);
    crack.stop(start_time + 0.09);
};

const playDrawSound = function () {
    const start_time = audio_time();
    const oscillator = start_time === undefined ? undefined : audio_context.createOscillator();

    if (oscillator === undefined) {
        return;
    }

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(260, start_time);
    oscillator.frequency.exponentialRampToValueAtTime(760, start_time + 0.2);
    connect_to_output(oscillator, 0.07, start_time, 0.23);
    oscillator.start(start_time);
    oscillator.stop(start_time + 0.25);
};

const playWinSound = function () {
    [523.25, 659.25, 783.99, 1046.5].forEach(function (frequency, index) {
        play_tone(frequency, 0.22, "triangle", 0.09, index * 0.12);
    });
};

const playShieldSound = function () {
    const start_time = audio_time();
    const oscillator = start_time === undefined ? undefined : audio_context.createOscillator();

    if (oscillator === undefined) {
        return;
    }

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(1320, start_time);
    oscillator.frequency.exponentialRampToValueAtTime(2180, start_time + 0.04);
    connect_to_output(oscillator, 0.08, start_time, 0.24);
    oscillator.start(start_time);
    oscillator.stop(start_time + 0.26);
};

const playFreezeSound = function () {
    const start_time = audio_time();
    const noise = start_time === undefined ? undefined : create_noise_source(0.16);
    let filter;

    if (noise === undefined) {
        return;
    }

    filter = audio_context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(3600, start_time);
    filter.Q.setValueAtTime(5, start_time);
    noise.connect(filter);
    connect_to_output(filter, 0.09, start_time, 0.16);
    noise.start(start_time);
    noise.stop(start_time + 0.18);
};

const playTurnSound = function () {
    play_tone(880, 0.12, "sine", 0.045, 0);
};

if (sound_toggle_button !== null) {
    sound_toggle_button.addEventListener("click", function () {
        sound_enabled = !sound_enabled;
        sound_toggle_button.textContent = sound_enabled ? "Sound On" : "Sound Off";
        sound_toggle_button.setAttribute("aria-pressed", String(sound_enabled));
    });
}

const create_cpu_difficulty_button = function () {
    const button_group = document.querySelector(".right-button-group");
    const button = document.createElement("button");

    if (button_group === null) {
        return;
    }

    button.id = "cpu-difficulty";
    button.type = "button";
    button.textContent = "CPU: Medium";
    button.setAttribute("aria-label", "CPU difficulty: medium");

    button.addEventListener("click", function () {
        const next_index = (
            CPU_DIFFICULTIES.indexOf(cpu_difficulty) + 1
        ) % CPU_DIFFICULTIES.length;

        cpu_difficulty = CPU_DIFFICULTIES[next_index];
        button.textContent = (
            "CPU: " +
            cpu_difficulty.charAt(0).toUpperCase() +
            cpu_difficulty.slice(1)
        );
        button.setAttribute("aria-label", "CPU difficulty: " + cpu_difficulty);
    });

    if (sound_toggle_button !== null) {
        sound_toggle_button.insertAdjacentElement("afterend", button);
        return;
    }

    button_group.appendChild(button);
};

create_cpu_difficulty_button();
const clear_selection = function () {
    selected_card_id = undefined;
    combo_card_id = undefined;
    target_mode = undefined;
};

const has_number_six = function (player) {
    return player.hand.some(function (card) {
        return card.type === "number" && card.value === 6;
    });
};

const increment_draw_streak = function (player_id) {
    if (draw_streaks[player_id] === undefined) {
        draw_streaks[player_id] = 0;
    }
    draw_streaks[player_id] += 1;
};

const reset_draw_streak = function (player_id) {
    draw_streaks[player_id] = 0;
};

const has_no_planes_on_track = function (player) {
    return player.planes.every(function (plane) {
        return plane.status !== "track";
    });
};

const check_draw_streak_p6 = function (player_id) {
    if (draw_streaks[player_id] === 3) {
        draw_streaks[player_id] = 0;
        return true;
    }
    return false;
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
const player_status_panel = document.getElementById("player-status-panel");
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

    if (trimmed === "gate") {
        return Object.freeze({
            status: "gate",
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

if (debug_move_button !== null) {
    debug_move_button.addEventListener("click", function () {
        if (gameMode === "multi") return;
        const colour = window.prompt(
            "Choose plane colour: blue, green, red, yellow"
        );

        const plane_index_text = window.prompt(
            "Choose plane index: 0, 1, 2, or 3"
        );

        const position_text = window.prompt(
            "Enter position: number, track:number, home:number, gate, base, or finished"
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

        const next_state = Unoludo.update_plane(
            state,
            player_id,
            plane_index,
            new_plane
        );

        prepare_render_effects(state, next_state, {});
        state = next_state;
        clear_selection();
        action_message.textContent = (
            "Debug moved " + colour + " plane " + plane_index + "."
        );
        render();
    });
}

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
        normalised === "P6" ||
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

if (give_card_button !== null) {
    give_card_button.addEventListener("click", function () {
        if (gameMode === "multi") return;
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

        const before_state = state;

        give_card_to_current_player(card);
        prepare_render_effects(before_state, state, {});
        clear_selection();
        action_message.textContent = "Gave card " + code.toUpperCase() + " to current player.";
        render();
    });
}

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
    return (
        plane.status === "gate" ||
        plane.status === "track" ||
        plane.status === "home"
    );
};

const track_distance = function (from_position, to_position) {
    return (
        (to_position - from_position + Unoludo.track_length) %
        Unoludo.track_length
    );
};

const projected_track_position = function (player, from_position, steps) {
    const raw_position = (
        (from_position + steps + Unoludo.track_length) %
        Unoludo.track_length
    );
    const jump = Unoludo.jump_positions[player.colour];

    if (jump !== undefined && raw_position === jump.from) {
        return jump.to;
    }

    return raw_position;
};

const plane_progress = function (player, plane) {
    const start_position = Unoludo.start_positions[player.colour];
    const entry_position = Unoludo.home_entry_positions[player.colour];
    let entry_distance;

    if (plane.status === "finished") {
        return Unoludo.track_length + Unoludo.home_lane_length + 1;
    }

    if (plane.status === "home") {
        entry_distance = track_distance(start_position, entry_position);
        return entry_distance + 2 + plane.position;
    }

    if (plane.status === "track") {
        return track_distance(start_position, plane.position) + 1;
    }

    if (plane.status === "gate") {
        return 0;
    }

    return -1;
};

const distance_to_home = function (player, plane) {
    if (plane.status === "finished") {
        return 0;
    }

    if (plane.status === "home") {
        return Unoludo.home_lane_length - plane.position;
    }

    if (plane.status === "track") {
        return (
            1 +
            track_distance(
                plane.position,
                Unoludo.home_entry_positions[player.colour]
            ) +
            Unoludo.home_lane_length +
            1
        );
    }

    return Unoludo.track_length + Unoludo.home_lane_length;
};

const card_matches_next_colour = function (card, colour) {
    return (
        card.colour === colour ||
        card.colour === "wild"
    );
};

const count_active_planes = function (player) {
    return player.planes.filter(is_active_plane).length;
};

const can_capture_plane_with_steps = function (
    attacker,
    attacker_plane,
    target_plane,
    steps
) {
    if (
        attacker_plane.status !== "track" ||
        attacker_plane.frozen ||
        target_plane.status !== "track" ||
        target_plane.shielded
    ) {
        return false;
    }

    return projected_track_position(
        attacker,
        attacker_plane.position,
        steps
    ) === target_plane.position;
};

const player_can_capture_plane = function (
    attacker,
    target_plane
) {
    if (target_plane.status !== "track" || target_plane.shielded) {
        return false;
    }

    return attacker.hand.some(function (card) {
        let steps;

        if (card.type === "number" && card.value >= 1 && card.value <= 6) {
            steps = card.value;
        } else if (card.type === "wild") {
            steps = 6;
        } else {
            return false;
        }

        return attacker.planes.some(function (attacker_plane) {
            return can_capture_plane_with_steps(
                attacker,
                attacker_plane,
                target_plane,
                steps
            );
        });
    });
};

const plane_is_threatened = function (board_state, player_id, plane_index) {
    const player = board_state.players[player_id];
    const plane = player.planes[plane_index];

    return board_state.players.some(function (opponent) {
        if (opponent.id === player_id) {
            return false;
        }

        return player_can_capture_plane(opponent, plane);
    });
};

const opponent_near_own_plane = function (own_plane, opponent_plane) {
    if (own_plane.status !== "track" || opponent_plane.status !== "track") {
        return false;
    }

    return track_distance(opponent_plane.position, own_plane.position) <= 3;
};

const count_threatened_planes = function (board_state, player_id) {
    const player = board_state.players[player_id];

    return player.planes.filter(function (plane, plane_index) {
        return is_active_plane(plane) && plane_is_threatened(
            board_state,
            player_id,
            plane_index
        );
    }).length;
};

const capture_count_against_player = function (
    before_state,
    after_state,
    player_id
) {
    let count = 0;

    before_state.players[player_id].planes.forEach(function (before_plane, index) {
        const after_plane = after_state.players[player_id].planes[index];

        if (
            before_plane.status !== "base" &&
            before_plane.status !== "finished" &&
            after_plane.status === "base"
        ) {
            count += 1;
        }
    });

    return count;
};

const score_colour_for_cpu = function (player, colour) {
    let score = 0;

    player.hand.forEach(function (card) {
        if (card_matches_next_colour(card, colour)) {
            score += 4;
        }

        if (card.colour === colour && card.type !== "number") {
            score += 2;
        }
    });

    player.planes.forEach(function (plane) {
        if (is_active_plane(plane)) {
            score += 1;
        }
    });

    return score;
};

const choose_colour_for_cpu = function (player, board_state) {
    const counts = {
        blue: 0,
        green: 0,
        red: 0,
        yellow: 0
    };
    const colour_scores = {
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

    Object.keys(colour_scores).forEach(function (colour) {
        colour_scores[colour] = (
            score_colour_for_cpu(player, colour) +
            counts[colour]
        );

        if (board_state !== undefined) {
            board_state.players.forEach(function (opponent) {
                if (opponent.id === player.id) {
                    return;
                }

                opponent.hand.forEach(function (card) {
                    if (card_matches_next_colour(card, colour)) {
                        colour_scores[colour] -= 1.5;
                    }
                });

                opponent.planes.forEach(function (plane) {
                    if (
                        plane.status === "track" &&
                        distance_to_home(opponent, plane) <= 8
                    ) {
                        colour_scores[colour] -= 0.5;
                    }
                });
            });
        }

        if (
            colour_scores[colour] > colour_scores[best_colour] ||
            (
                colour_scores[colour] === colour_scores[best_colour] &&
                counts[colour] > counts[best_colour]
            )
        ) {
            best_colour = colour;
        }
    });

    return best_colour;
};

const move_reason_from_score = function (details) {
    if (details.finished) {
        return "finished a plane";
    }

    if (details.captures > 0) {
        return "captured an opponent plane";
    }

    if (details.shielded_threat) {
        return "shielded a threatened plane";
    }

    if (details.prevented_threat) {
        return "protected a plane from capture";
    }

    if (details.frozen_planes > 0) {
        return "froze active opponent planes";
    }

    if (details.reversed_close_plane) {
        return "pushed back a plane near home";
    }

    if (details.launched) {
        return "launched a plane";
    }

    if (details.setup_capture) {
        return "set up a capture";
    }

    if (details.draw_pressure) {
        return "built card pressure while behind";
    }

    if (details.progress > 0) {
        return "advanced toward home";
    }

    return "kept the best position";
};

const score_cpu_move = function (before_state, move) {
    const player = before_state.players[move.player_id];
    const after_player = move.state.players[move.player_id];
    const before_threats = count_threatened_planes(before_state, player.id);
    const after_threats = count_threatened_planes(move.state, player.id);
    const details = {
        captures: 0,
        frozen_planes: 0,
        progress: 0,
        draw_pressure: false,
        finished: false,
        launched: false,
        prevented_threat: after_threats < before_threats,
        reversed_close_plane: false,
        setup_capture: false,
        shielded_threat: false
    };
    let score = 0;

    before_state.players.forEach(function (target_player) {
        if (target_player.id === player.id) {
            return;
        }

        target_player.planes.forEach(function (before_plane, plane_index) {
            const after_plane = move.state
                .players[target_player.id]
                .planes[plane_index];
            const close_to_home = distance_to_home(target_player, before_plane);
            const before_progress = plane_progress(target_player, before_plane);
            const after_progress = plane_progress(target_player, after_plane);

            if (
                before_plane.status !== "base" &&
                before_plane.status !== "finished" &&
                after_plane.status === "base"
            ) {
                details.captures += 1;
                score += 15 + Math.max(0, 12 - close_to_home);
            }

            if (
                after_plane.frozen &&
                !before_plane.frozen &&
                is_active_plane(before_plane)
            ) {
                details.frozen_planes += count_active_planes(target_player);
                score += 8 * count_active_planes(target_player);
            }

            if (move.kind === "reverse" && after_progress < before_progress) {
                score += 10 + Math.max(0, 10 - close_to_home);
                if (close_to_home <= 10) {
                    details.reversed_close_plane = true;
                }
            }
        });
    });

    player.planes.forEach(function (before_plane, plane_index) {
        const after_plane = after_player.planes[plane_index];
        const before_progress = plane_progress(player, before_plane);
        const after_progress = plane_progress(player, after_plane);
        const gained = Math.max(0, after_progress - before_progress);

        if (before_plane.status === "base" && after_plane.status === "gate") {
            details.launched = true;
            score += 8;
        }

        if (before_plane.status !== "finished" && after_plane.status === "finished") {
            details.finished = true;
            score += 25;
        }

        if (before_plane.status === "home" || after_plane.status === "home") {
            score += gained * 5;
        } else {
            score += gained * 3;
        }

        details.progress += gained;

        if (
            before_plane.shielded !== true &&
            after_plane.shielded === true &&
            plane_is_threatened(before_state, player.id, plane_index)
        ) {
            details.shielded_threat = true;
            score += 22;
        }

        if (
            plane_is_threatened(before_state, player.id, plane_index) &&
            !plane_is_threatened(move.state, player.id, plane_index)
        ) {
            score += 12;
        }
    });

    if (move.kind === "zero") {
        score += 10;
    }

    if (move.kind === "draw2" && player.hand.length < 4) {
        details.draw_pressure = true;
        score += 6;
    }

    if (move.kind === "wild4" && move.option === "advance_all") {
        score -= capture_count_against_player(
            before_state,
            move.state,
            player.id
        ) * 20;
    }

    before_state.players.forEach(function (opponent) {
        if (opponent.id === player.id) {
            return;
        }

        move.state.players[opponent.id].planes.forEach(function (opponent_plane) {
            if (opponent_plane.status !== "track") {
                return;
            }

            after_player.planes.forEach(function (own_plane) {
                const has_capture_card = after_player.hand.some(function (card) {
                    return (
                        card.type === "number" &&
                        card.value >= 1 &&
                        card.value <= 6 &&
                        own_plane.status === "track" &&
                        track_distance(own_plane.position, opponent_plane.position) === card.value
                    );
                });

                if (has_capture_card) {
                    details.setup_capture = true;
                    score += 7;
                }
            });
        });
    });

    before_state.players.forEach(function (opponent) {
        if (opponent.id === player.id) {
            return;
        }

        opponent.planes.forEach(function (opponent_plane) {
            player.planes.forEach(function (own_plane) {
                if (opponent_near_own_plane(own_plane, opponent_plane)) {
                    score += (
                        move.kind === "skip" || move.kind === "reverse"
                        ? 6
                        : 0
                    );
                }
            });
        });
    });

    score += choose_colour_for_cpu(after_player, move.state) === move.chosen_colour ? 2 : 0;

    move.score = score;
    move.reason = move_reason_from_score(details);

    return move;
};

const create_cpu_move = function (before_state, player, next_state, kind, message, extra) {
    const move = Object.assign({
        player_id: player.id,
        state: next_state,
        kind: kind,
        message: message
    }, extra || {});

    return score_cpu_move(before_state, move);
};

const find_cpu_number_move = function (cpu_state, player) {
    const moves = [];

    player.hand.some(function (card) {
        if (
            !Unoludo.can_play_card(card, cpu_state) ||
            card.type !== "number" ||
            card.value < 1 ||
            card.value > 6
        ) {
            return false;
        }

        player.planes.forEach(function (plane, plane_index) {
            const next_state = Unoludo.play_number_card(
                cpu_state,
                card.id,
                plane_index
            );

            if (next_state !== undefined) {
                moves.push(create_cpu_move(
                    cpu_state,
                    player,
                    next_state,
                    "number",
                    player.name + " played a number card",
                    {card: card, plane_index: plane_index}
                ));
            }
        });

        return false;
    });

    return moves;
};

const find_cpu_zero_move = function (cpu_state, player) {
    const moves = [];

    player.hand.some(function (card) {
        if (
            !Unoludo.can_play_card(card, cpu_state) ||
            card.type !== "number" ||
            card.value !== 0
        ) {
            return false;
        }

        player.planes.forEach(function (plane, plane_index) {
            const next_state = Unoludo.play_zero_card(
                cpu_state,
                card.id,
                plane_index
            );

            if (next_state !== undefined) {
                moves.push(create_cpu_move(
                    cpu_state,
                    player,
                    next_state,
                    "zero",
                    player.name + " played a shield card",
                    {card: card, plane_index: plane_index}
                ));
            }
        });

        return false;
    });

    return moves;
};

const find_cpu_draw2_move = function (cpu_state, player) {
    const moves = [];

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
            moves.push(create_cpu_move(
                cpu_state,
                player,
                next_state,
                "draw2",
                player.name + " played +2",
                {card: card}
            ));
        }

        return false;
    });

    return moves;
};

const find_cpu_skip_move = function (cpu_state, player) {
    const moves = [];

    player.hand.some(function (card) {
        if (
            !Unoludo.can_play_card(card, cpu_state) ||
            card.type !== "skip"
        ) {
            return false;
        }

        cpu_state.players.forEach(function (target_player) {
            if (target_player.id === player.id) {
                return false;
            }

            target_player.planes.forEach(function (plane, plane_index) {
                const next_state = Unoludo.play_skip_card(
                    cpu_state,
                    card.id,
                    target_player.id,
                    plane_index
                );

                if (next_state !== undefined) {
                    moves.push(create_cpu_move(
                        cpu_state,
                        player,
                        next_state,
                        "skip",
                        player.name + " played Skip",
                        {
                            card: card,
                            target_player_id: target_player.id,
                            plane_index: plane_index
                        }
                    ));
                }
            });
        });

        return false;
    });

    return moves;
};

const find_cpu_reverse_move = function (cpu_state, player) {
    const moves = [];

    player.hand.some(function (reverse_card) {
        if (reverse_card.type !== "reverse") {
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

            cpu_state.players.forEach(function (target_player) {
                if (target_player.id === player.id) {
                    return false;
                }

                target_player.planes.forEach(function (plane, plane_index) {
                    const next_state = Unoludo.play_reverse_combo(
                        cpu_state,
                        reverse_card.id,
                        number_card.id,
                        target_player.id,
                        plane_index
                    );

                    if (next_state !== undefined) {
                        moves.push(create_cpu_move(
                            cpu_state,
                            player,
                            next_state,
                            "reverse",
                            player.name + " played Reverse combo",
                            {
                                card: reverse_card,
                                number_card: number_card,
                                target_player_id: target_player.id,
                                plane_index: plane_index
                            }
                        ));
                    }
                });
            });

            return false;
        });

        return false;
    });

    return moves;
};

const find_cpu_wild_move = function (cpu_state, player) {
    const moves = [];

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

            cpu_state.players.forEach(function (target_player) {
                target_player.planes.forEach(function (plane, plane_index) {
                    const next_state = Unoludo.play_wild_combo(
                        cpu_state,
                        wild_card.id,
                        number_card.id,
                        target_player.id,
                        plane_index
                    );

                    if (next_state !== undefined) {
                        moves.push(create_cpu_move(
                            cpu_state,
                            player,
                            next_state,
                            "wild",
                            player.name + " played Wild combo",
                            {
                                card: wild_card,
                                number_card: number_card,
                                target_player_id: target_player.id,
                                plane_index: plane_index,
                                chosen_colour: number_card.colour
                            }
                        ));
                    }
                });
            });

            return false;
        });

        return false;
    });

    return moves;
};

const find_cpu_wild4_move = function (cpu_state, player) {
    const moves = [];

    player.hand.some(function (card) {
        const has_active_plane = player.planes.some(is_active_plane);
        const choices = (
            has_active_plane
            ? ["advance_all", "draw4"]
            : ["draw4"]
        );

        if (
            card.type !== "wild4" ||
            !Unoludo.can_play_card(card, cpu_state)
        ) {
            return false;
        }

        choices.forEach(function (choice) {
            const colour = choose_colour_for_cpu(player, cpu_state);
            const next_state = Unoludo.play_wild4_card(
                cpu_state,
                card.id,
                choice,
                colour
            );

            if (next_state !== undefined) {
                moves.push(create_cpu_move(
                    cpu_state,
                    player,
                    next_state,
                    "wild4",
                    player.name + " played Wild +4",
                    {card: card, option: choice, chosen_colour: colour}
                ));
            }
        });

        return false;
    });

    return moves;
};

const find_cpu_reward_move = function (cpu_state, player) {
    const moves = [];

    player.hand.some(function (card) {
        if (card.type !== "reward") {
            return false;
        }

        player.planes.forEach(function (plane, plane_index) {
            const next_state = Unoludo.play_reward_card(
                cpu_state,
                card.id,
                player.id,
                plane_index,
                choose_colour_for_cpu(player, cpu_state)
            );

            if (next_state !== undefined) {
                moves.push(create_cpu_move(
                    cpu_state,
                    player,
                    next_state,
                    "reward",
                    player.name + " played reward " + card.value,
                    {card: card, target_player_id: player.id, plane_index: plane_index}
                ));
            }
        });

        cpu_state.players.forEach(function (target_player) {
            target_player.planes.forEach(function (plane, plane_index) {
                const next_state = Unoludo.play_reward_card(
                    cpu_state,
                    card.id,
                    target_player.id,
                    plane_index,
                    choose_colour_for_cpu(player, cpu_state)
                );

                if (next_state !== undefined) {
                    moves.push(create_cpu_move(
                        cpu_state,
                        player,
                        next_state,
                        "reward",
                        player.name + " played reward " + card.value,
                        {
                            card: card,
                            target_player_id: target_player.id,
                            plane_index: plane_index
                        }
                    ));
                }
            });
        });

        return false;
    });

    return moves;
};

const all_cpu_moves = function (cpu_state, player) {
    return [].concat(
        find_cpu_reward_move(cpu_state, player),
        find_cpu_number_move(cpu_state, player),
        find_cpu_draw2_move(cpu_state, player),
        find_cpu_skip_move(cpu_state, player),
        find_cpu_reverse_move(cpu_state, player),
        find_cpu_wild_move(cpu_state, player),
        find_cpu_wild4_move(cpu_state, player),
        find_cpu_zero_move(cpu_state, player)
    );
};

const select_cpu_move = function (moves) {
    if (moves.length === 0) {
        return undefined;
    }

    if (cpu_difficulty === "easy") {
        return moves[Math.floor(Math.random() * moves.length)];
    }

    return moves.reduce(function (best_move, move) {
        const move_score = (
            cpu_difficulty === "medium"
            ? move.score * (0.8 + Math.random() * 0.4)
            : move.score
        );
        const best_score = (
            best_move.adjusted_score !== undefined
            ? best_move.adjusted_score
            : (
                cpu_difficulty === "medium"
                ? best_move.score * (0.8 + Math.random() * 0.4)
                : best_move.score
            )
        );

        move.adjusted_score = move_score;
        best_move.adjusted_score = best_score;

        return move_score > best_score ? move : best_move;
    });
};

const find_cpu_action = function (cpu_state) {
    const player = Unoludo.current_player(cpu_state);
    const move = select_cpu_move(all_cpu_moves(cpu_state, player));

    if (move === undefined) {
        return undefined;
    }

    return {
        state: move.state,
        message: move.message + " because it " + move.reason + "."
    };
};

const cpu_take_turn = function () {
    const player = Unoludo.current_player(state);
    const action = find_cpu_action(state);

    if (player.kind !== "cpu") {
        return;
    }

    if (action !== undefined) {
        const final_state = Unoludo.end_turn(action.state);

        prepare_render_effects(
            state,
            final_state,
            prepare_card_effects_from_next_state(action.state)
        );
        state = final_state;
        clear_selection();
        action_message.textContent = action.message;
        render();
        return;
    }

    const next_state = Unoludo.draw_one_and_end_turn(state);

    prepare_render_effects(state, next_state, {});

    if (!has_number_six(player)) {
        increment_draw_streak(player.id);
    } else {
        reset_draw_streak(player.id);
    }

    if (check_draw_streak_p6(player.id) && has_no_planes_on_track(player)) {
        const p6_card = Unoludo.create_reward_card(6);
        const new_players = next_state.players.map(function (p, i) {
            if (i === player.id) {
                return Object.freeze({
                    id: p.id,
                    name: p.name,
                    colour: p.colour,
                    kind: p.kind,
                    hand: Unoludo.sorted_hand(p.hand.concat([p6_card])),
                    planes: p.planes
                });
            }
            return p;
        });

        state = Object.freeze({
            draw_pile: next_state.draw_pile,
            discard_pile: next_state.discard_pile,
            players: Object.freeze(new_players),
            current_player: next_state.current_player,
            active_colour: next_state.active_colour,
            winner: next_state.winner,
            player_moods: next_state.player_moods,
            log: Object.freeze(next_state.log.concat([
                player.name + " received a P6 reward card (6th draw streak)!"
            ]))
        });
    } else {
        state = next_state;
    }

    clear_selection();
    action_message.textContent = player.name + " drew one card and ended turn.";
    render();
};

const schedule_cpu_if_needed = function () {
    // In multiplayer, the host is the single authority for CPU turns.
    if (gameMode === "multi") {
        const player = Unoludo.current_player(state);
        if (Unoludo.is_ended(state)) return;
        if (player.kind !== "cpu") return;
        if (myPlayerIndex !== multiplayerCpuAuthorityIndex) return;
        if (cpu_timer !== undefined) return;

        action_message.textContent = player.name + " is thinking...";
        hand_cards.classList.add("cpu-thinking");
        hand_cards.style.filter = "drop-shadow(0 0 16px " + player_colour_hex(player.colour) + ")";
        hand_cards.style.transition = "filter 220ms ease, transform 220ms ease";
        hand_cards.style.transform = "translateY(-4px)";

        cpu_timer = window.setTimeout(function () {
            cpu_timer = undefined;
            hand_cards.classList.remove("cpu-thinking");
            hand_cards.style.filter = "";
            hand_cards.style.transform = "";
            cpu_take_turn();
            // Sync the result to Firebase so the other player sees it
            sync_multiplayer_state();
        }, CPU_TURN_DELAY);
        return;
    }

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
    hand_cards.classList.add("cpu-thinking");
    hand_cards.style.filter = "drop-shadow(0 0 16px " + player_colour_hex(player.colour) + ")";
    hand_cards.style.transition = "filter 220ms ease, transform 220ms ease";
    hand_cards.style.transform = "translateY(-4px)";

    cpu_timer = window.setTimeout(function () {
        cpu_timer = undefined;
        hand_cards.classList.remove("cpu-thinking");
        hand_cards.style.filter = "";
        hand_cards.style.transform = "";
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

const game_log = document.getElementById("game-log");
const action_message = document.getElementById("action-message");
const particle_canvas = document.getElementById("particle-canvas");
const turn_indicator_label = document.querySelector(".turn-indicator-label");


const action_message_observer = new MutationObserver(function () {
    action_message.classList.remove("action-message-pop");
    action_message.style.animation = "none";

    window.requestAnimationFrame(function () {
        action_message.classList.add("action-message-pop");
        action_message.style.animation = "";
    });

    window.setTimeout(function () {
        action_message.classList.remove("action-message-pop");
    }, 1300);
});

action_message_observer.observe(action_message, {
    childList: true,
    characterData: true,
    subtree: true
});

const card_rect_for_id = function (card_id) {
    const escaped_card_id = (
        window.CSS !== undefined && window.CSS.escape !== undefined
        ? window.CSS.escape(card_id)
        : card_id.replace(/'/g, "\\'")
    );
    const card_element = hand_cards.querySelector(
        "[data-card-id='" + escaped_card_id + "']"
    );

    if (card_element === null) {
        return undefined;
    }

    return card_element.getBoundingClientRect();
};

const board_relative_rect = function (rect) {
    const board_rect = discard_layer.getBoundingClientRect();

    return {
        left: rect.left - board_rect.left,
        top: rect.top - board_rect.top,
        width: rect.width,
        height: rect.height
    };
};

const prepare_render_effects = function (before_state, after_state, options) {
    const before_top = Unoludo.top_discard(before_state);
    const after_top = Unoludo.top_discard(after_state);
    const effects = {
        card_played: after_top.id !== before_top.id,
        card_source_rect: options && options.card_source_rect,
        drew_cards: after_state.draw_pile.length < before_state.draw_pile.length,
        moved_pieces: false,
        captured_keys: Object.create(null),
        shielded: false,
        frozen: false,
        turn_changed: after_state.current_player !== before_state.current_player,
        winner_changed: after_state.winner !== before_state.winner
    };

    after_state.players.forEach(function (player, player_index) {
        player.planes.forEach(function (plane, plane_index) {
            const before_plane = before_state.players[player_index].planes[plane_index];
            const piece_key = piece_key_for(player, plane_index);

            if (
                before_plane.status !== plane.status ||
                before_plane.position !== plane.position
            ) {
                effects.moved_pieces = true;
            }

            if (
                before_plane.status !== "base" &&
                plane.status === "base"
            ) {
                effects.captured_keys[piece_key] = true;
            }

            if (!before_plane.shielded && plane.shielded) {
                effects.shielded = true;
            }

            if (!before_plane.frozen && plane.frozen) {
                effects.frozen = true;
            }
        });
    });

    pending_render_effects = effects;
};

const prepare_card_effects_from_next_state = function (next_state) {
    const played_card = Unoludo.top_discard(next_state);

    return {
        card_source_rect: card_rect_for_id(played_card.id)
    };
};

const sync_multiplayer_state = function () {
    if (gameMode !== "multi") {
        return Promise.resolve({committed: true});
    }

    return window.UnoludoMultiplayer.updateGameState(
        state,
        state.current_player
    ).then(function (result) {
        if (!result.committed) {
            if (result.remoteState !== undefined) {
                state = window.UnoludoMultiplayer.unflattenState(
                    result.remoteState
                );
                mpStateSynced = true;
                clear_selection();
                render();
            }

            action_message.textContent = (
                "Game state changed. Please try your move again."
            );
        }

        return result;
    }).catch(function () {
        action_message.textContent = "Could not sync multiplayer state.";
        return {committed: false};
    });
};

const can_take_local_turn = function () {
    return (
        gameMode !== "multi" ||
        (mpStateSynced === true &&
            window.UnoludoMultiplayer.isMyTurn(state.current_player) === true)
    );
};

const finish_successful_action = function (next_state, message, should_sync) {
    const final_state = Unoludo.end_turn(next_state);
    const player = Unoludo.current_player(state);

    reset_draw_streak(player.id);
    prepare_render_effects(
        state,
        final_state,
        prepare_card_effects_from_next_state(next_state)
    );
    state = final_state;
    clear_selection();
    action_message.textContent = message;
    if (should_sync !== false) {
        sync_multiplayer_state();
    }
    render();
    return true;
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
            "Played +2, drew two cards, and ended turn.",
            false
        );
        return true;
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

        return finish_successful_action(
            next_state,
            (
                option === "advance_all"
                ? "Played Wild +4 and advanced all active planes."
                : "Played Wild +4 and drew four cards."
            ),
            false
        );
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

    if (plane.status === "gate") {
        return player.colour + "-gate";
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

const animate_card_to_discard = function (source_rect, card) {
    const target_card = discard_layer.querySelector(".center-discard-card");
    const target_rect = (
        target_card === null
        ? discard_layer.getBoundingClientRect()
        : target_card.getBoundingClientRect()
    );
    const source = board_relative_rect(source_rect);
    const target = board_relative_rect(target_rect);
    const flying_card = document.createElement("img");

    flying_card.src = UnoludoAssets.card_image(card);
    flying_card.alt = "";
    flying_card.style.position = "absolute";
    flying_card.style.left = source.left + "px";
    flying_card.style.top = source.top + "px";
    flying_card.style.width = source.width + "px";
    flying_card.style.height = source.height + "px";
    flying_card.style.zIndex = "80";
    flying_card.style.pointerEvents = "none";
    flying_card.style.borderRadius = "8px";
    flying_card.style.filter = "drop-shadow(0 18px 24px rgba(0, 0, 0, 0.42))";
    flying_card.style.transformOrigin = "center center";
    flying_card.style.transition = "left 430ms cubic-bezier(0.22, 1, 0.36, 1), top 430ms cubic-bezier(0.22, 1, 0.36, 1), width 430ms cubic-bezier(0.22, 1, 0.36, 1), height 430ms cubic-bezier(0.22, 1, 0.36, 1), transform 430ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease 330ms";
    flying_card.style.transform = "rotate(-8deg) scale(1)";

    discard_layer.appendChild(flying_card);

    window.requestAnimationFrame(function () {
        flying_card.style.left = target.left + "px";
        flying_card.style.top = target.top + "px";
        flying_card.style.width = target.width + "px";
        flying_card.style.height = target.height + "px";
        flying_card.style.transform = "rotate(12deg) scale(1.08)";
        flying_card.style.opacity = "0";
    });

    window.setTimeout(function () {
        flying_card.remove();
    }, 560);
};

const spawn_piece_trail = function (snapshot, current_left, current_top, image_src, image_alt) {
    [0.28, 0.55, 0.78].forEach(function (step, index) {
        const trail = document.createElement("div");
        const image = document.createElement("img");
        const left = snapshot.left + (current_left - snapshot.left) * step;
        const top = snapshot.top + (current_top - snapshot.top) * step;

        trail.className = "piece";
        trail.style.left = left + "%";
        trail.style.top = top + "%";
        trail.style.opacity = "0.46";
        trail.style.pointerEvents = "none";
        trail.style.zIndex = "3";
        trail.style.transition = "opacity 400ms ease, transform 400ms ease";
        trail.style.transform = "translate(-50%, -50%) perspective(640px) rotateX(12deg) translateZ(2px) scale(" + (0.92 - index * 0.08) + ")";

        image.src = image_src;
        image.alt = image_alt;
        trail.appendChild(image);
        piece_layer.appendChild(trail);

        window.setTimeout(function () {
            trail.style.opacity = "0";
            trail.style.transform = "translate(-50%, -50%) perspective(640px) rotateX(12deg) translateZ(2px) scale(0.45)";
        }, 20 + index * 55);

        window.setTimeout(function () {
            trail.remove();
        }, 470 + index * 70);
    });
};

const spawn_confetti = function () {
    const colours = ["#4979E0", "#48DB73", "#BD2222", "#E5CA22", "#9b5cff", "#f8fafc"];
    let index;

    if (particle_canvas === null) {
        return;
    }

    for (index = 0; index < 38; index += 1) {
        const particle = document.createElement("div");
        const drift = Math.random() * 180 - 90;
        const duration = 1500 + Math.random() * 1500;
        const start_x = Math.random() * 100;
        const rotation = Math.random() * 720 - 360;

        particle.style.position = "absolute";
        particle.style.left = start_x + "%";
        particle.style.top = "-8%";
        particle.style.width = (6 + Math.random() * 8) + "px";
        particle.style.height = (8 + Math.random() * 12) + "px";
        particle.style.borderRadius = "2px";
        particle.style.background = colours[index % colours.length];
        particle.style.opacity = "0.95";
        particle.style.transform = "translate3d(0, 0, 0) rotate(0deg)";
        particle.style.transition = (
            "transform " + duration + "ms cubic-bezier(0.16, 1, 0.3, 1), " +
            "top " + duration + "ms linear, opacity 260ms ease " + (duration - 260) + "ms"
        );

        particle_canvas.appendChild(particle);

        window.setTimeout(function () {
            particle.style.top = "108%";
            particle.style.transform = (
                "translate3d(" + drift + "px, 0, 0) rotate(" + rotation + "deg)"
            );
            particle.style.opacity = "0";
        }, 20 + Math.random() * 120);

        window.setTimeout(function () {
            particle.remove();
        }, duration + 220);
    }
};

const play_pending_sounds = function (effects) {
    if (effects.card_played) {
        playCardSound();
    }

    if (effects.drew_cards) {
        window.setTimeout(playDrawSound, effects.card_played ? 120 : 0);
    }

    if (effects.moved_pieces) {
        playMoveSound();
    }

    if (Object.keys(effects.captured_keys).length > 0) {
        playCaptureSound();
    }

    if (effects.shielded) {
        playShieldSound();
    }

    if (effects.frozen) {
        playFreezeSound();
    }

    if (effects.winner_changed) {
        playWinSound();
    } else if (effects.turn_changed) {
        window.setTimeout(playTurnSound, effects.card_played || effects.drew_cards ? 240 : 0);
    }
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
        player.id !== state.current_player &&
        can_take_local_turn()
    ) {
        piece.className += " target-piece";
        piece.onclick = function () {
            play_skip_on_plane(player.id, plane_index);
        };
    } else if (
        plane.status !== "finished" &&
        target_mode === "reverse_target" &&
        player.id !== state.current_player &&
        can_take_local_turn()
    ) {
        piece.className += " target-piece";
        piece.onclick = function () {
            play_reverse_on_plane(player.id, plane_index);
        };
    } else if (
        plane.status !== "finished" &&
        target_mode === "wild_target" &&
        can_take_local_turn()
    ) {
        piece.className += " target-piece";
        piece.onclick = function () {
            play_wild_on_plane(player.id, plane_index);
        };
    } else if (
        plane.status !== "finished" &&
        target_mode === undefined &&
        player.id === state.current_player &&
        can_take_local_turn()
    ) {
        piece.className += " current-player-piece";
        piece.onclick = function () {
            play_selected_card_on_plane(plane_index);
        };
    } else if (
        plane.status !== "finished" &&
        target_mode === "reward_target" &&
        can_take_local_turn()
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

    if (
        pending_render_effects !== undefined &&
        pending_render_effects.captured_keys[piece_key] === true
    ) {
        piece.classList.add("captured");

        window.setTimeout(function () {
            piece.classList.remove("captured");
        }, 520);
    }

    if (
        previous_piece_snapshots[piece_key] !== undefined &&
        previous_piece_snapshots[piece_key].status !== "base" &&
        previous_piece_snapshots[piece_key].status !== "finished" &&
        (
            Math.abs(previous_piece_snapshots[piece_key].left - (position.x + offset.x)) > 0.01 ||
            Math.abs(previous_piece_snapshots[piece_key].top - (position.y + offset.y)) > 0.01
        )
    ) {
        spawn_piece_trail(
            previous_piece_snapshots[piece_key],
            position.x + offset.x,
            position.y + offset.y,
            image_src,
            image_alt
        );
    }

    previous_piece_snapshots[piece_key] = {
        left: position.x + offset.x,
        top: position.y + offset.y,
        status: plane.status
    };
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

    if (
        pending_render_effects !== undefined &&
        pending_render_effects.card_played &&
        pending_render_effects.card_source_rect !== undefined
    ) {
        animate_card_to_discard(pending_render_effects.card_source_rect, top_card);
    }
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
            delete previous_piece_snapshots[piece_key];
        }
    });
};

const render_hand = function () {
    const player = (gameMode === "multi")
        ? state.players[myPlayerIndex]
        : Unoludo.current_player(state);

    hand_cards.replaceChildren();

    if (gameMode !== "multi" && player.kind === "cpu") {
        const hidden_notice = document.createElement("div");
        const swatch = document.createElement("span");
        const name = document.createElement("span");

        hidden_notice.className = "hidden-hand-notice";
        swatch.className = "hidden-hand-swatch";
        swatch.style.background = player_colour_hex(player.colour);
        name.className = "hidden-hand-name";
        name.textContent = player.name + " is choosing a move";

        hidden_notice.appendChild(swatch);
        hidden_notice.appendChild(name);
        hand_cards.appendChild(hidden_notice);
        return;
    }

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
        image.dataset.cardId = card.id;

        image.addEventListener("click", function () {
            if (!can_take_local_turn()) {
                return;
            }

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
                play_selected_card_without_plane().then(function (did_update) {
                    if (did_update) {
                        sync_multiplayer_state();
                    }
                    render();
                });
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
                play_selected_card_without_plane().then(function (did_update) {
                    if (did_update) {
                        sync_multiplayer_state();
                    }
                    render();
                });
                render();
                return;
            }

            clear_selection();
            selected_card_id = card.id;
            play_selected_card_without_plane().then(function (did_update) {
                if (did_update) {
                    sync_multiplayer_state();
                }
                render();
            });
            render();
        });

        hand_cards.appendChild(image);
    });

    if (player.kind !== "cpu") {
        const draw_image = document.createElement("img");

        draw_image.className = "card-image draw-card-button";
        draw_image.src = UnoludoAssets.draw_card;
        draw_image.alt = "Draw and end turn";

        draw_image.addEventListener("click", function () {
            if (!can_take_local_turn()) {
                return;
            }

            const next_state = Unoludo.draw_one_and_end_turn(state);

            if (next_state !== undefined) {
                prepare_render_effects(state, next_state, {});

                if (!has_number_six(player)) {
                    increment_draw_streak(player.id);
                } else {
                    reset_draw_streak(player.id);
                }

                if (check_draw_streak_p6(player.id) && has_no_planes_on_track(player)) {
                    const p6_card = Unoludo.create_reward_card(6);
                    const new_players = next_state.players.map(function (p, i) {
                        if (i === player.id) {
                            return Object.freeze({
                                id: p.id,
                                name: p.name,
                                colour: p.colour,
                                kind: p.kind,
                                hand: Unoludo.sorted_hand(p.hand.concat([p6_card])),
                                planes: p.planes
                            });
                        }
                        return p;
                    });

                    state = Object.freeze({
                        draw_pile: next_state.draw_pile,
                        discard_pile: next_state.discard_pile,
                        players: Object.freeze(new_players),
                        current_player: next_state.current_player,
                        active_colour: next_state.active_colour,
                        winner: next_state.winner,
                        player_moods: next_state.player_moods,
                        log: Object.freeze(next_state.log.concat([
                            player.name + " received a P6 reward card (6th draw streak)!"
                        ]))
                    });
                } else {
                    state = next_state;
                }

                clear_selection();
                action_message.textContent = "Drew one card and ended turn.";
                sync_multiplayer_state();
                render();
            }
        });

        hand_cards.appendChild(draw_image);
    }
};

const render_player_status_panel = function () {
    if (player_status_panel === null) {
        return;
    }

    player_status_panel.replaceChildren();

    state.players.forEach(function (player) {
        const row = document.createElement("div");
        const swatch = document.createElement("span");
        const name = document.createElement("span");
        const emoji = document.createElement("span");
        const is_current = player.id === state.current_player;
        const mood = (
            state.player_moods === undefined
            ? undefined
            : state.player_moods[player.id]
        );
        const emoji_text = (
            is_current
            ? "🤔"
            : (
                mood === "smug"
                ? "🤭"
                : (
                    mood === "angry"
                    ? "😡"
                    : "⏳"
                )
            )
        );

        row.className = (
            is_current
            ? "player-status-row is-thinking"
            : "player-status-row"
        );

        swatch.className = "player-status-swatch";
        swatch.style.background = player_colour_hex(player.colour);
        swatch.style.boxShadow = (
            "0 0 18px " + player_colour_hex(player.colour)
        );

        name.className = "player-status-name";
        name.textContent = player.name;

        emoji.className = "player-status-emoji";
        emoji.textContent = emoji_text;
        emoji.setAttribute(
            "aria-label",
            (
                is_current
                ? "Thinking"
                : (
                    mood === "smug"
                    ? "Disrupted another player"
                    : (
                        mood === "angry"
                        ? "Disrupted by another player"
                        : "Waiting"
                    )
                )
            )
        );

        row.appendChild(swatch);
        row.appendChild(name);
        row.appendChild(emoji);
        player_status_panel.appendChild(row);
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

    render_player_status_panel();

    if (state.winner !== undefined) {
        winner = state.players[state.winner];
        action_message.textContent = winner.name + " wins the game!";
    }

    if (state.log.length === 1) {
        played_card_title.textContent = "First card:";
    } else {
        // "drew" log is second-to-last because end_turn always appends after it
        var last_log = state.log[state.log.length - 2] || "";
        var last_action_is_draw = last_log.indexOf(" drew ") !== -1;
        if (last_action_is_draw) {
            played_card_title.textContent = previous_player.name + " drew:";
        } else {
            played_card_title.textContent = previous_player.name + " played:";
        }
    }

    var last_log_for_image = state.log[state.log.length - 2] || "";
    if (last_log_for_image.indexOf(" drew ") !== -1) {
        played_card_image.src = UnoludoAssets.draw_card;
        played_card_image.alt = "Draw card";
    } else {
        played_card_image.src = UnoludoAssets.card_image(top_card);
        played_card_image.alt = "Last played card: " + top_card.id;
    }

    if (turn_indicator_label !== null) {
        turn_indicator_label.textContent = current_player.name + "'s turn";
    }



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

const apply_multiplayer_turn_controls = function () {
    const can_play = can_take_local_turn();

    if (gameMode !== "multi") {
        if (draw_end_turn_button !== null) {
            draw_end_turn_button.disabled = false;
        }
        return;
    }

    hand_cards.querySelectorAll(".card-image").forEach(function (card_image) {
        card_image.style.pointerEvents = can_play ? "" : "none";
        card_image.style.opacity = can_play ? "" : "0.48";
        card_image.setAttribute("aria-disabled", String(!can_play));
    });

    if (draw_end_turn_button !== null) {
        draw_end_turn_button.disabled = !can_play;
    }
};

const render = function () {
    const effects = pending_render_effects;

    render_top_discard_on_board();
    render_pieces();
    render_hand();
    render_info();
    apply_multiplayer_turn_controls();

    if (effects !== undefined) {
        if (effects.winner_changed) {
            spawn_confetti();
        }

        play_pending_sounds(effects);
        pending_render_effects = undefined;
    }

    schedule_cpu_if_needed();
};

const update_mode_controls = function () {
    const restart_button = document.getElementById("reset-demo");

    if (restart_button !== null) {
        restart_button.hidden = gameMode === "multi";
    }

    if (debug_move_button !== null) {
        debug_move_button.hidden = gameMode === "multi";
    }

    if (give_card_button !== null) {
        give_card_button.hidden = gameMode === "multi";
    }
};

const set_demo_plane = function (status, position) {
    const player = state.players[0];

    const blue_plane = Object.freeze({
        status: status,
        position: position,
        shielded: false,
        frozen: false
    });

    const next_state = Unoludo.update_plane(
        state,
        player.id,
        0,
        blue_plane
    );

    prepare_render_effects(state, next_state, {});
    state = next_state;
    render();
};

const restart_game = function () {
    if (gameMode === "multi") {
        action_message.textContent = "Restart is disabled in multiplayer games.";
        return;
    }

    Object.keys(piece_elements).forEach(function (piece_key) {
        piece_elements[piece_key].remove();
        delete piece_elements[piece_key];
        delete previous_piece_snapshots[piece_key];
    });

    if (cpu_timer !== undefined) {
        window.clearTimeout(cpu_timer);
        cpu_timer = undefined;
    }

    hand_cards.classList.remove("cpu-thinking");
    hand_cards.style.filter = "";
    hand_cards.style.transform = "";

    initGameState([
        "Player",
        "CPU Green",
        "CPU Red",
        "CPU Yellow"
    ], {
        shuffle: true
    });
    rendered_discard_card_id = undefined;
    pending_render_effects = undefined;
    winner_popup_shown = false;
    Object.keys(draw_streaks).forEach(function (key) {
        draw_streaks[key] = 0;
    });
    if (particle_canvas !== null) {
        particle_canvas.replaceChildren();
    }
    clear_selection();
    hide_winner_popup();
    action_message.textContent = "Game reset.";
    render();
};

document.getElementById("reset-demo").addEventListener("click", restart_game);
winner_restart_button.addEventListener("click", restart_game);

document.getElementById("draw-end-turn").addEventListener("click", function () {
    if (!can_take_local_turn()) {
        return;
    }

    const next_state = Unoludo.draw_one_and_end_turn(state);

    if (next_state !== undefined) {
        const player = Unoludo.current_player(state);

        prepare_render_effects(state, next_state, {});

        if (!has_number_six(player)) {
            increment_draw_streak(player.id);
        } else {
            reset_draw_streak(player.id);
        }

        if (check_draw_streak_p6(player.id) && has_no_planes_on_track(player)) {
            const p6_card = Unoludo.create_reward_card(6);
            const new_players = next_state.players.map(function (p, i) {
                if (i === player.id) {
                    return Object.freeze({
                        id: p.id,
                        name: p.name,
                        colour: p.colour,
                        kind: p.kind,
                        hand: Unoludo.sorted_hand(p.hand.concat([p6_card])),
                        planes: p.planes
                    });
                }
                return p;
            });

            state = Object.freeze({
                draw_pile: next_state.draw_pile,
                discard_pile: next_state.discard_pile,
                players: Object.freeze(new_players),
                current_player: next_state.current_player,
                active_colour: next_state.active_colour,
                winner: next_state.winner,
                player_moods: next_state.player_moods,
                log: Object.freeze(next_state.log.concat([
                    player.name + " received a P6 reward card (6th draw streak)!"
                ]))
            });
        } else {
            state = next_state;
        }

        clear_selection();
        action_message.textContent = "Drew one card and ended turn.";
        sync_multiplayer_state();
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

const multiplayer_player_names = Object.freeze([
    "Player 1",
    "Player 2",
    "Player 3",
    "Player 4"
]);

const single_player_names = Object.freeze([
    "Player",
    "CPU Green",
    "CPU Red",
    "CPU Yellow"
]);

const reset_local_runtime_state = function () {
    Object.keys(piece_elements).forEach(function (piece_key) {
        piece_elements[piece_key].remove();
        delete piece_elements[piece_key];
        delete previous_piece_snapshots[piece_key];
    });

    if (cpu_timer !== undefined) {
        window.clearTimeout(cpu_timer);
        cpu_timer = undefined;
    }

    hand_cards.classList.remove("cpu-thinking");
    hand_cards.style.filter = "";
    hand_cards.style.transform = "";
    rendered_discard_card_id = undefined;
    pending_render_effects = undefined;
    winner_popup_shown = false;
    Object.keys(draw_streaks).forEach(function (key) {
        draw_streaks[key] = 0;
    });
    if (particle_canvas !== null) {
        particle_canvas.replaceChildren();
    }
    clear_selection();
    hide_winner_popup();
};

window.UnoludoApp = {
    startSinglePlayer: function () {
        gameMode = "single";
        update_mode_controls();
        myPlayerIndex = 0;
        multiplayerCpuAuthorityIndex = 0;
        mpStateSynced = false;
        reset_local_runtime_state();
        initGameState(single_player_names, {
            shuffle: true
        });
        action_message.textContent = "Game started.";
        render();
    },

    startMultiPlayer: function (roomId, playerIndex, playerKinds, playerNames) {
        gameMode = "multi";
        update_mode_controls();
        myPlayerIndex = playerIndex;
        multiplayerCpuAuthorityIndex = (
            window.UnoludoLobby !== undefined &&
            window.UnoludoLobby.getCurrentHostIndex !== undefined
            ? window.UnoludoLobby.getCurrentHostIndex()
            : 0
        );
        mpStateSynced = false;
        reset_local_runtime_state();

        // Use the definitive playerKinds from the lobby (all clients get the same array)
        // Empty slots default to "cpu" so the game cycles through all 4 players
        var kinds = playerKinds || ["human", "human", "human", "human"];
        var names = playerNames || multiplayer_player_names;
        console.log("[MultiPlayer] playerKinds:", kinds, "myIndex:", playerIndex);

        initGameState(names, {
            shuffle: true,
            playerKinds: kinds
        });

        window.UnoludoMultiplayer.onStateChange(function (remote_state) {
            state = window.UnoludoMultiplayer.unflattenState(remote_state);
            mpStateSynced = true;
            clear_selection();
            render();
        });

        window.UnoludoMultiplayer.init(roomId, playerIndex);

        if (playerIndex === 0) {
            window.UnoludoMultiplayer.setInitialState(state);
        }

        render();
    }
};

if (window.UnoludoLobby !== undefined) {
    window.UnoludoLobby.onGameStart(function (
        roomId,
        playerIndex,
        playerKinds,
        playerNames
    ) {
        window.UnoludoLobby.showScreen(window.UnoludoLobby.getGameScreen());
        window.UnoludoApp.startMultiPlayer(
            roomId,
            playerIndex,
            playerKinds,
            playerNames
        );
    });
}

initGameState(single_player_names, {
    shuffle: true
});
update_mode_controls();
render();
