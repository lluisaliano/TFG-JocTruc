// index.ts: Terminal interface to play the game
// Needs 'readline-sync' to read standard input

import * as readlineSync from "readline-sync";
import { TrucMatch } from "./TrucMatch";
import type { Card, GameState } from "./types/game";
import { CFRTrainer } from "./CFR";

import fs from 'node:fs';

const CFRIterations = 110_000; // Nombre d'iteracions per entrenar el bot

async function main() {
	console.clear();
	//  Player Names
	const humanName = readlineSync.question("Nom del jugador humà: "); // Player 1
	const botName = "Bot"; // Player 2

	// Start game
	const game = new TrucMatch([humanName, botName]);
	console.log(`Benvingut ${humanName}! Juga contra ${botName}.`);
	readlineSync.question("Prem ENTER per començar...");

	// avgStrats contindrà l'estratègia mitjana que ha entrenat el bot.
	let avgStrats: Map<string, number[]>;
	// Si no existeix el fitxer 'cfr-strategy.json', entrenam el bot i guardam l'estratègia mitjana, en cas contrari la carregam.
	if (fs.existsSync('cfr-strategy.json')) {
		const raw = fs.readFileSync('cfr-strategy.json', 'utf-8');
		const obj = JSON.parse(raw) as { [key: string]: number[] };
		avgStrats = new Map(Object.entries(obj));
	} else {
		console.log("El bot no ha estat entrenat encara, començam l'entrenament...  (Pot trigar uns minuts)");
		const trainer = new CFRTrainer();
		trainer.train(CFRIterations);
		avgStrats = trainer.getAverageStrategyMap();

		// Guardem l'estratègia mitjana a un fitxer JSON
		console.log("Guardant l'estratègia mitjana a 'cfr-strategy.json'...");
		// Ho guardem en un objecte per així poder guardar-ho com a JSON
		const obj: { [key: string]: number[] } = {};
		avgStrats.forEach((value, key) => {
			obj[key] = value; 1
		});

		// Guardem com a json:
		fs.writeFileSync('cfr-strategy.json', JSON.stringify(obj));
	}


	// Main game loop
	while (!game.isMatchOver()) {
		// Check if round is over, if so, start next round
		if (game.isRoundOver()) {
			game.startNextRound();
		}

		const state = game.getState();

		displayState(state, humanName);


		// Torn del jugador actual
		if (state.currentTurn.userName === humanName) {
			const gameOptions = [
				"Trucar",
				"Acceptar Truc",
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
					console.log("No pots jugar, has d'acceptar el truc");
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
					game.applyAction(hand[idx], humanName);

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
					game.applyAction("abandonar", humanName);
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

				if (state.hasToAcceptTruc.player1) {
					console.log("No pots trucar, primer has d'acceptar el Truc");
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
						game.applyAction("truc", humanName);
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
					console.log("No pots acceptar cap truc perquè has trucat tú");
					readlineSync.question("Prem ENTER per continuar...");
					continue;
				}

				const askedTruc = state.askedTruc;

				if (askedTruc === "none") {
					console.log("No pots acceptar truc, no hi ha truc");
					readlineSync.question("Prem ENTER per continuar...");
					continue;
				}

				try {
					game.applyAction("acceptTruc", humanName);
					console.log(`Has acceptat el ${askedTruc}`);
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
			// Torn del bot
			console.log(`${botName} està pensant…`);

			// Guardem l'index del bot, en aquest cas un perquè sempre és el segon jugador
			const botID = 1;

			// Construim la clau del conjunt d'informació que tenim i obtenim la seva llista d'accions
			const infoKey = game.getInfoSetKey(botID);
			const legalActions = game.getActions(botID);

			// Obtenim la distribució (estratègia mitjana) del conjunt d'informació
			let strat = avgStrats.get(infoKey);

			// Si no existeix l'estratègia per a aquest conjunt d'informació, creem una estratègia uniforme (Totes les accions tenen la mateixa probabilitat)
			if (!strat) {
				console.log("No hi ha ha estrategia per a aquest infoset, fer uniforme");
				strat = new Array(legalActions.length).fill(1 / legalActions.length);
			}

			// Triem una acció segons les probablilitats que ens ha donat l'estratègia mitjana.
			// Per fer-ho, generem un número aleatori i veiem quina acció correspon a aquest número.
			const prob = Math.random();
			let cumul = 0;
			let chosenAction = 0;
			for (let i = 0; i < strat.length; i++) {
				cumul += strat[i];
				if (prob <= cumul) {
					chosenAction = i;
					break;
				}
			}
			const action = legalActions[chosenAction];

			// Realitzar l'acció triada pel bot
			try {
				game.applyAction(action, botName);
			} catch {
				// Si hi ha algun error (per exemple, trucar quan no toca),
				// l’ignorem i tornem a iterar el bucle.
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


/**
 * Function to display the current game state in a human-readable format.
 * @param state
 * @param humanName 
 */
function displayState(state: GameState, humanName: string) {
	console.clear();

	// Show Score
	console.log(`PUNTUACIÓ: ${state.score.player1} - ${state.score.player2}`);
	console.log("");

	// Show that round has finished # TODO: Hauriem de mostrar les cartes que han quedat i fer que lusuari apretes enter
	if (state.roundHasfinished) {
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


	// Lap State
	console.log("CARTES LLENÇADES:");

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
	// Show If player has to accept Truc
	if (state.hasToAcceptTruc.player1) {
		console.log(`EL JUGADOR T'HA DEMANAT ${state.askedTruc.toUpperCase()}, HAS D'ACCEPTAR O ABANDONAR!`);
	}
	console.log("");

	// Player with current turn
	const currentTurn = state.currentTurn;
	console.log(`TORN: ${currentTurn.userName}`);

	// 'Ma' player
	console.log(`JUGADOR MA: ${state.maPlayer.userName}`);
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
