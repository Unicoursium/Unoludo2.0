/**
 * This is an integration fix, so that Ramda can be imported in the same way
 * both on server and on browser, and also not trip jslint.
 */
import * as R from "ramda";
export default R;
