/**
 * GameNet Library
 * Core networking and game state management utilities
 */

import { selectSignalServer } from "./signal_server";
import { createLocalSignalServer } from "./signal_server_local";

export * from "./game_server";
export * from "./game_client";

// default signal serve
selectSignalServer(createLocalSignalServer());
