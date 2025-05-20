// index.ts: Terminal interface to play the game
// Needs 'readline-sync' to read standard input

import * as readlineSync from "readline-sync";
import { TrucMatch } from "./TrucMatch";
import type { Card, GameState } from "./types/game";

function displayState(state: GameState, humanName: string) {
	console.clear();

	// Show Score
	console.log(`Puntuació: ${state.score.player1} - ${state.score.player2}`);
	console.log("");

	// Show that round has finished # TODO: Hauriem de mostrar les cartes que han quedat i fer que lusuari apretes enter
	if (state.startingNewRound()) {
		console.log("Nova ronda!");
		console.log(
			"Mirar la puntuació per saber si has guanyat o perdut. (De moment no es mostra millor)",
		);
		readlineSync.question("Prem ENTER per continuar...");
	}
	console.log("");

	// Lap and Truc State
	console.log(`Volta: ${state.lap} / 3    Estat del Truc: ${state.trucState}`);
	console.log("");

	// Player that asked for Truc
	if (state.playerThatAskedTruc) {
		console.log(
			`Darrer jugador que ha demanat Truc: ${state.playerThatAskedTruc.userName}`,
		);
	} else {
		console.log("Ningú ha demanat Truc");
	}
	console.log("");

	// Lap State
	console.log("Estat de les voltes:");

	for (let i = 0; i < 3; i++) {
		const player1ThrownCard = state.players[0].thrownCards[i];
		const player2ThrownCard = state.players[1].thrownCards[i];

		let messagePlayer1 = `${state.players[0].userName} (${player1ThrownCard?.id})`;
		let messagePlayer2 = `${state.players[1].userName} (${player2ThrownCard?.id})`;
		if (!player1ThrownCard) {
			messagePlayer1 = `${state.players[0].userName} (No ha llençat carta)`;
		}

		if (!player2ThrownCard) {
			messagePlayer2 = `${state.players[1].userName} (No ha llençat carta)`;
		}

		console.log(`Volta ${i + 1}: ${messagePlayer1} vs ${messagePlayer2}`);
	}

	console.log("");

	// Player with current turn
	const currentTurn = state.currentTurn;
	console.log(`Torn de: ${currentTurn.userName}`);

	// 'Ma' player
	console.log(`Ma: ${state.maPlayer.userName}`);
	console.log("");

	// Cartes de l'humà
	const humanIdx = state.players.findIndex((p) => p.userName === humanName);
	const hand = state.players[humanIdx].cards;
	console.log(`Les teves cartes (${humanName}):`);
	hand.forEach((card: Card, idx: number) => {
		console.log(`  [${idx + 1}] ${card.id} (valor Truc: ${card.trucValue})`);
	});

	const thrownCards = state.players[humanIdx].thrownCards;
	if (thrownCards.length > 0) {
		console.log(`Cartes llençades (${humanName}):`);
		thrownCards.forEach((card: Card, idx: number) => {
			console.log(`  [${idx}] ${card.id} (valor Truc: ${card.trucValue})`);
		});
	}
	console.log("");
}

async function main() {
	console.clear();
	//  Player Names
	const humanName = readlineSync.question("Nom del jugador humà: "); // Player 1
	const botName = "Bot"; // Player 2

	// Start game
	const game = new TrucMatch([humanName, botName]);
	console.log(`Benvingut ${humanName}! Juga contra ${botName}.`);
	readlineSync.question("Prem ENTER per començar...");

	// Main game loop
	while (!game.isMatchOver()) {
		const state = game.getState();

		displayState(state, humanName);

		// Torn del jugador actual
		if (state.currentTurn.userName === humanName) {
			const gameOptions = [
				"Trucar",
				"Aceptar Truc",
				"Llançar Carta",
				"Abandonar",
				"Tancar Joc",
			];
			const idx = readlineSync.keyInSelect(
				gameOptions,
				"Tria una opció, no és necessari premer ENTER",
				{ cancel: false },
			);
			const call = gameOptions[idx];

			// Throw card
			if (call === "Llançar Carta") {
				if (state.hasToAcceptTruc.player1) {
					console.log("No pots jugar, has d'accear al truc");
					readlineSync.question("Prem ENTER per continuar...");
					continue;
				}

				const hand = state.players[0].cards;
				const descriptions = hand.map((c) => `${c.id} (Truc: ${c.trucValue})`);
				const idx = readlineSync.keyInSelect(
					descriptions,
					"Tria una carta per jugar",
					{ cancel: false },
				);

				try {
					game.playerPlay(humanName, hand[idx]);
				} catch (err) {
					console.log(`Error: ${(err as Error).message}`);
					readlineSync.question("Prem ENTER per continuar...");
				}
				// Pasem al següent torn
				continue;
			}

			// Ask for Truc
			if (call === "Abandonar") {
				try {
					game.playerCall(humanName, "abandonar");
				} catch (err) {
					console.log(`Error: ${(err as Error).message}`);
					readlineSync.question("Prem ENTER per continuar...");
				}
			}

			if (call === "Trucar") {
				if (state.playerThatAskedTruc?.userName === humanName) {
					console.log("No pots trucar, ja has trucat");
					readlineSync.question("Prem ENTER per continuar...");
					continue;
				}

				const trucState = state.trucState;

				if (trucState === "cama") {
					console.log("No pots trucar, ja has jugat la cama");
					readlineSync.question("Prem ENTER per continuar...");
					continue;
				}

				let futureTrucState: string;

				switch (trucState) {
					case "none":
						futureTrucState = "Truc";
						break;
					case "truc":
						futureTrucState = "Retruc";
						break;
					case "retruc":
						futureTrucState = "Val_9";
						break;
					case "val_9":
						futureTrucState = "Cama";
						break;
				}

				const options = ["Sí", "No "];

				const idx = readlineSync.keyInSelect(
					options,
					`Vols demanar ${futureTrucState}?`,
					{ cancel: false },
				);

				// Si l'usuari vol trucar
				if (idx === 0) {
					try {
						game.playerCall(humanName, "truc");
						console.log(`Has trucat ${futureTrucState}`);
					} catch (err) {
						console.log(`Error: ${(err as Error).message}`);
						readlineSync.question("Prem ENTER per continuar...");
					}
					// Si l'usuari no vol trucar
				} else {
					console.log("No has trucat");
					readlineSync.question("Prem ENTER per continuar...");
				}
			}

			// Accept Truc
			if (call === "Acceptar Truc") {
				if (state.playerThatAskedTruc?.userName === humanName) {
					console.log("No pots aceptar cap truc perquè has trucat tú");
					readlineSync.question("Prem ENTER per continuar...");
					continue;
				}

				const trucState = state.trucState;

				if (trucState === "none") {
					console.log("No pots acceptar truc, no hi ha truc");
					readlineSync.question("Prem ENTER per continuar...");
					continue;
				}

				try {
					game.playerCall(humanName, "acceptTruc");
					console.log(`Has acceptat el ${trucState}`);
					readlineSync.question("Prem ENTER per continuar...");
				} catch (err) {
					console.log(`Error: ${(err as Error).message}`);
					readlineSync.question("Prem ENTER per continuar...");
				}
			}

			// Player wants to quit the game
			if (call === "Tancar Joc") {
				process.exit();
			}
		} else {
			// Bot Turn
			console.log(`${botName} està pensant...`);
			// Implement CFR
			try {
				// FIXME Accepct Truc for testing
				if (state.hasToAcceptTruc.player2) {
					game.playerCall(botName, "acceptTruc");
				}
				// FIXME Play first card in array
				game.playerPlay(botName, state.players[1].cards[0]);
			} catch {
				// Ignore errores
			}
		}
	}

	// Game is finished
	const winner = game.isMatchOver();
	if (!winner) {
		throw new Error("No hi ha guanyador i el bucle ha acabat");
	}
	console.log(`\nPartida finalitzada! Guanyador: ${winner.userName}`);
}

// Catch all unhandled errors and show them
main().catch((err) => console.error(err));
