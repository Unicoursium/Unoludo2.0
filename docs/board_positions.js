/**
 * Board position data for Unoludo.
 *
 * Coordinates are stored as percentages of the board image.
 * x: 0 is the left edge, 100 is the right edge.
 * y: 0 is the top edge, 100 is the bottom edge.
 *
 * @namespace UnoludoBoard
 */
const UnoludoBoard = Object.create(null);

/**
 * Main track coordinates.
 *
 * Index 0 corresponds to track position 0 in unoludo.js.
 * Index 1 corresponds to track position 1, etc.
 *
 * @memberof UnoludoBoard
 * @type {Object[]}
 */
UnoludoBoard.track_positions = Object.freeze([
    Object.freeze({x: 40.04, y: 92.88}),
    Object.freeze({x: 38.78, y: 88.25}),
    Object.freeze({x: 38.78, y: 84.32}),
    Object.freeze({x: 38.92, y: 79.97}),
    Object.freeze({x: 38.78, y: 75.62}),
    Object.freeze({x: 38.78, y: 71.41}),
    Object.freeze({x: 38.78, y: 67.2}),
    Object.freeze({x: 40.32, y: 62.57}),
    Object.freeze({x: 37.37, y: 60.05}),
    Object.freeze({x: 33.02, y: 61.03}),
    Object.freeze({x: 28.82, y: 61.17}),
    Object.freeze({x: 24.61, y: 61.17}),
    Object.freeze({x: 20.4, y: 61.31}),
    Object.freeze({x: 16.05, y: 61.45}),
    Object.freeze({x: 11.84, y: 61.45}),
    Object.freeze({x: 7.63, y: 62.86}),
    Object.freeze({x: 4.82, y: 59.91}),
    Object.freeze({x: 6.09, y: 55.7}),
    Object.freeze({x: 6.09, y: 50.23}),
    Object.freeze({x: 6.37, y: 44.48}),
    Object.freeze({x: 7.35, y: 39.99}),
    Object.freeze({x: 11.98, y: 38.44}),
    Object.freeze({x: 16.19, y: 38.72}),
    Object.freeze({x: 20.26, y: 38.72}),
    Object.freeze({x: 24.47, y: 38.44}),
    Object.freeze({x: 28.96, y: 38.72}),
    Object.freeze({x: 33.45, y: 38.58}),
    Object.freeze({x: 37.09, y: 40.13}),
    Object.freeze({x: 40.04, y: 37.32}),
    Object.freeze({x: 38.64, y: 33.11}),
    Object.freeze({x: 38.64, y: 28.76}),
    Object.freeze({x: 38.5, y: 24.41}),
    Object.freeze({x: 38.36, y: 19.78}),
    Object.freeze({x: 38.5, y: 15.85}),
    Object.freeze({x: 38.64, y: 11.79}),
    Object.freeze({x: 37.23, y: 7.58}),
    Object.freeze({x: 40.46, y: 4.49}),
    Object.freeze({x: 44.25, y: 6.17}),
    Object.freeze({x: 50, y: 6.31}),
    Object.freeze({x: 55.61, y: 6.45}),
    Object.freeze({x: 60.1, y: 7.44}),
    Object.freeze({x: 61.65, y: 11.93}),
    Object.freeze({x: 61.37, y: 15.71}),
    Object.freeze({x: 61.08, y: 20.2}),
    Object.freeze({x: 61.08, y: 24.27}),
    Object.freeze({x: 61.37, y: 28.76}),
    Object.freeze({x: 61.37, y: 32.97}),
    Object.freeze({x: 59.82, y: 37.18}),
    Object.freeze({x: 63.05, y: 40.41}),
    Object.freeze({x: 67.12, y: 39}),
    Object.freeze({x: 71.47, y: 39.14}),
    Object.freeze({x: 75.96, y: 38.86}),
    Object.freeze({x: 79.89, y: 38.72}),
    Object.freeze({x: 83.67, y: 38.72}),
    Object.freeze({x: 88.3, y: 38.58}),
    Object.freeze({x: 92.09, y: 37.32}),
    Object.freeze({x: 95.18, y: 39.99}),
    Object.freeze({x: 94.06, y: 44.62}),
    Object.freeze({x: 93.92, y: 49.81}),
    Object.freeze({x: 93.78, y: 55.56}),
    Object.freeze({x: 92.37, y: 60.47}),
    Object.freeze({x: 88.02, y: 61.31}),
    Object.freeze({x: 83.67, y: 61.03}),
    Object.freeze({x: 79.32, y: 61.17}),
    Object.freeze({x: 75.26, y: 61.03}),
    Object.freeze({x: 70.91, y: 61.17}),
    Object.freeze({x: 66.84, y: 61.17}),
    Object.freeze({x: 62.91, y: 59.77}),
    Object.freeze({x: 59.68, y: 62.57}),
    Object.freeze({x: 61.23, y: 67.06}),
    Object.freeze({x: 61.08, y: 71.55}),
    Object.freeze({x: 60.8, y: 75.48}),
    Object.freeze({x: 61.37, y: 79.69}),
    Object.freeze({x: 61.08, y: 83.9}),
    Object.freeze({x: 61.23, y: 88.39}),
    Object.freeze({x: 62.49, y: 92.74}),
    Object.freeze({x: 59.54, y: 95.26}),
    Object.freeze({x: 55.61, y: 93.72}),
    Object.freeze({x: 49.86, y: 93.86}),
    Object.freeze({x: 44.25, y: 94})
]);

/**
 * Home lane coordinates for each plane colour.
 *
 * @memberof UnoludoBoard
 * @type {Object}
 */
UnoludoBoard.home_positions = Object.freeze({
    blue: Object.freeze([
        Object.freeze({x: 49.72, y: 88.39}),
        Object.freeze({x: 49.86, y: 84.04}),
        Object.freeze({x: 49.72, y: 79.55}),
        Object.freeze({x: 49.86, y: 75.34}),
        Object.freeze({x: 50, y: 71.13}),
        Object.freeze({x: 49.86, y: 67.2}),
        Object.freeze({x: 49.86, y: 63})
    ]),
    green: Object.freeze([
        Object.freeze({x: 11.98, y: 50.09}),
        Object.freeze({x: 16.05, y: 49.95}),
        Object.freeze({x: 20.26, y: 49.81}),
        Object.freeze({x: 24.47, y: 49.95}),
        Object.freeze({x: 28.68, y: 49.81}),
        Object.freeze({x: 33.02, y: 50.23}),
        Object.freeze({x: 37.09, y: 50.09})
    ]),
    red: Object.freeze([
        Object.freeze({x: 49.72, y: 11.79}),
        Object.freeze({x: 49.72, y: 15.99}),
        Object.freeze({x: 49.58, y: 20.06}),
        Object.freeze({x: 49.72, y: 24.55}),
        Object.freeze({x: 49.86, y: 28.76}),
        Object.freeze({x: 50, y: 32.83}),
        Object.freeze({x: 49.86, y: 37.18})
    ]),
    yellow: Object.freeze([
        Object.freeze({x: 88.16, y: 49.95}),
        Object.freeze({x: 83.81, y: 49.95}),
        Object.freeze({x: 79.6, y: 49.95}),
        Object.freeze({x: 75.54, y: 49.95}),
        Object.freeze({x: 71.19, y: 49.95}),
        Object.freeze({x: 67.12, y: 50.09}),
        Object.freeze({x: 62.49, y: 49.95})
    ])
});

/**
 * Starting base coordinates for planes not yet launched.
 *
 * @memberof UnoludoBoard
 * @type {Object}
 */
UnoludoBoard.base_positions = Object.freeze({
    blue: Object.freeze([
        Object.freeze({x: 7.5, y: 82.44}),
        Object.freeze({x: 17.5, y: 82.44}),
        Object.freeze({x: 7.5, y: 92.32}),
        Object.freeze({x: 17.5, y: 92.32})
    ]),
    green: Object.freeze([
        Object.freeze({x: 7.5, y: 7.5}),
        Object.freeze({x: 17.5, y: 7.5}),
        Object.freeze({x: 7.5, y: 17.5}),
        Object.freeze({x: 17.5, y: 17.5})
    ]),
    red: Object.freeze([
        Object.freeze({x: 82.44, y: 7.5}),
        Object.freeze({x: 92.37, y: 7.5}),
        Object.freeze({x: 82.44, y: 17.5}),
        Object.freeze({x: 92.37, y: 17.5})
    ]),
    yellow: Object.freeze([
        Object.freeze({x: 82.44, y: 82.44}),
        Object.freeze({x: 92.37, y: 82.44}),
        Object.freeze({x: 82.44, y: 92.37}),
        Object.freeze({x: 92.37, y: 92.37})
    ])
});

UnoludoBoard.launch_positions = Object.freeze({
    blue: Object.freeze({x: 26.71, y: 94.56}),
    green: Object.freeze({x: 4.82, y: 26.52}),
    red: Object.freeze({x: 73.71, y: 5.05}),
    yellow: Object.freeze({x: 95.04, y: 73.38})
});

/**
 * Get the visual coordinate for a plane.
 *
 * @memberof UnoludoBoard
 * @function
 * @param {Unoludo.Plane} plane The plane state.
 * @param {Unoludo.Colour} colour The plane colour.
 * @param {number} plane_index The plane index inside its base, usually 0.
 * @returns {(Object | undefined)} The visual coordinate.
 */
UnoludoBoard.position_for_plane = function (plane, colour, plane_index) {
    if (plane.status === "base") {
        return UnoludoBoard.base_positions[colour][plane_index];
    }

    if (plane.status === "track") {
        return UnoludoBoard.track_positions[plane.position];
    }

    if (plane.status === "home") {
        return UnoludoBoard.home_positions[colour][plane.position];
    }

    if (plane.status === "finished") {
        return {x: 50, y: 50};
    }

    return undefined;
};

export default Object.freeze(UnoludoBoard);