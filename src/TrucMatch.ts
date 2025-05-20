import type {
	Players,
	Score,
	Player,
	CallType,
	CardsOfPlayer,
	Card,
	TrucState,
	cardId,
	roundState,
	TieAndMaPlayer,
	GameState,
} from "./types/game.ts";

import { cards } from "./utils/cards.ts";
import { shuffleDeck } from "./utils/shuffleDeck.ts";
import { randomZeroOrOne } from "./utils/functions.ts";
import { Queue } from "./utils/Queue.ts";
import { InfiniteQueue } from "./utils/InfiniteQueue.ts";

/**
 * Represents a Truc match, managing all the logic and states of the game.
 *
 * Based on: https://injovemenorca.com/ca/Truc_menorqui/34773
 *
 * The game has been reduced to be only 1v1 and without the ability to 'Envit'
 *
 *
 * Key Definitions:
 * - TURN: When a player throws one card.
 * - LAP: When all players have thrown one card.
 * - ROUND: When three laps are completed, or fewer if a special case occurs.
 *
 */
export class TrucMatch {
	// Array that contains match players
	private players: Players = [];

	// Players references
	private player1: Player;
	private player2: Player;

	// Game State
	// This state changes when truc is accepted
	private trucState: TrucState = "none";

	// This states change when for truc is asked
	private askedTruc: TrucState = "none";

	// Player that asked Truc
	private playerThatAskedTruc: Player | null = null;

	// We will use this to avoid a player to throw a card if the truc has not been accepted
	private hasToAcceptTrucPlayer1 = false;

	private hasToAcceptTrucPlayer2 = false;

	private lap = 1;

	// This array will contain the player which has won the rounds
	private trucWonLaps: (Player | typeof this.TIE)[] = [];

	// Define turns with a Queue
	private turnQueue: Queue;

	// Define who has the turn in the current round
	private currentTurn: Player;

	// Player who starts the round
	private roundInfiniteQueue: InfiniteQueue;

	// Define 'ma' player of the round (The one who throws first card)
	private roundMaPlayer: Player;

	// This variable indicates if we are starting a new round, it will be set to false from the outside
	private startingNewRound = false;

	// Score
	private score: Score = {
		player1: 0,
		player2: 0,
	};

	// CONSTANTS
	// Score need to win
	private readonly WIN_SCORE = 24;

	// Constant to save ties
	private readonly TIE = "tie";

	// Truc score object
	private readonly trucScore: Record<TrucState, number> = {
		none: 1,
		truc: 3,
		retruc: 6,
		val_9: 9,
		cama: this.WIN_SCORE,
	};

	constructor(usersNames: string[]) {
		if (usersNames.length !== 2) {
			throw new Error("There must be 2 players");
		}
		// Create players with users
		for (let i = 0; i < usersNames.length; i++) {
			const player: Player = {
				userName: usersNames[i],
				thrownCards: [],
				cards: [],
			};
			this.players[i] = player;
		}

		this.player1 = this.players[0];
		this.player2 = this.players[1];

		// Assign them shuffled cards
		this.shuffleCards();

		// Get random player who will start the round and lap and save the turns in an infinite queue
		const playerPosition = randomZeroOrOne();
		this.roundInfiniteQueue = new InfiniteQueue(this.players, playerPosition);

		// We get the maPlayer without retrieving it in InfiniteQueue
		const maPlayer = this.roundInfiniteQueue.peek();
		if (!maPlayer) {
			throw new Error("No round 'ma' player available");
		}
		this.roundMaPlayer = maPlayer;

		// We create the turnQueue
		this.turnQueue = new Queue(
			this.players,
			this.getPlayerPositionInPlayersArray(this.roundMaPlayer),
		);

		// Current turn on beginning will be the player who is first on the turnQueue
		// (also this is the one who started the round turn)
		// If we have more than 0 players, this will not be null, so we assert it
		const currentTurnPlayer = this.turnQueue.getPlayer();
		if (!currentTurnPlayer) {
			throw new Error("No current turn player available");
		}
		this.currentTurn = currentTurnPlayer;
	}

	// This method will return an object with the current game status with everything, to send messages to clients
	getState(): GameState {
		const status = {
			score: this.score,
			players: this.players,
			currentTurn: this.currentTurn,
			trucState: this.trucState,
			lap: this.lap,
			maPlayer: this.roundMaPlayer,
			trucWonLaps: this.trucWonLaps,
			turnQueue: this.turnQueue,
			hasToAcceptTruc: {
				player1: this.hasToAcceptTrucPlayer1,
				player2: this.hasToAcceptTrucPlayer2,
			},
			playerThatAskedTruc: this.playerThatAskedTruc,
			startingNewRound: () => {
				const startingNewRound = this.startingNewRound;
				this.newRoundStartedAcknowledged();
				return startingNewRound;
			},
		};
		return status;
	}

	// Current turn player asks for 'truc', or 'abandonar'
	playerCall(playerName: string, callType: CallType) {
		// Get player from players array
		const player = this.players.find(
			(player) => player.userName === playerName,
		) as Player;

		switch (callType) {
			case "truc":
				// If player has no turn, player cannot truc
				if (player !== this.currentTurn) {
					throw new Error("PLAYER HAS NO TURN TO TRUC");
				}

				// Assign hasToAcceptTruc to the other player
				if (player === this.player1) {
					this.hasToAcceptTrucPlayer2 = true;
				} else {
					this.hasToAcceptTrucPlayer1 = true;
				}

				// We will save the player that asked for truc
				this.playerThatAskedTruc = player;
				/**
				 * Update askedTruc depending on trucState and return askedTruc
				 */
				switch (this.trucState) {
					// If askedTruc is "cama" return null, because it cannot be asked a better truc than that
					case "cama":
						return { type: "truc", state: null };
					case "none":
						this.askedTruc = "truc";
						break;
					case "truc":
						this.askedTruc = "retruc";
						break;
					case "retruc":
						this.askedTruc = "val_9";
						break;
					case "val_9":
						this.askedTruc = "cama";
						break;
				}

				// Change turn to the other player
				this.currentTurn = this.players.filter(
					(player) => player !== this.currentTurn,
				)[0];

				return { type: "truc", state: this.askedTruc };

			case "acceptTruc":
				if (player === this.player1 && this.hasToAcceptTrucPlayer1) {
					this.hasToAcceptTrucPlayer1 = false;
				}

				if (player === this.player2 && this.hasToAcceptTrucPlayer2) {
					this.hasToAcceptTrucPlayer2 = false;
				}

				/**
				 * Assign askedTruc to trucState and return trucState
				 */
				this.trucState = this.askedTruc;

				// Change turn to the other player
				this.currentTurn = this.players.filter(
					(player) => player !== this.currentTurn,
				)[0];

				return { type: "truc", state: this.trucState };

			case "abandonar":
				// If player has no turn or truc has not been asked, he cannot abandon
				if (player !== this.currentTurn) {
					throw new Error("PLAYER HAS NO TURN TO ABANDON");
				}

				console.log(`Player ${player.userName} has abandoned the game`);

				// Update Score
				this.updateMatchScore("ABANDON");

				// Start next round
				this.startNextRound();

				return { type: "abandon", state: this.trucState };
		}
	}

	/**
	 * This method is called when a player throws his card
	 * It updates the currentTurn and check if player has the card he is throwing
	 * @param player
	 * @param card
	 * @returns
	 */
	playerPlay(playerName: string, card: Card) {
		// Get player from players array
		const player = this.players.find(
			(player) => player.userName === playerName,
		) as Player;

		if (
			(player === this.player1 && this.hasToAcceptTrucPlayer1) ||
			(player === this.player2 && this.hasToAcceptTrucPlayer2)
		) {
			throw new Error("TO THROW, TRUC MUST BE ACCEPTED OR DECLAINED");
		}

		// Check if player has turn
		if (player !== this.currentTurn) {
			throw new Error("PLAYER HAS NO TURN");
		}

		// Check if player has the card he is throwing
		const chosenCard = this.getPlayerCard(player, card.id);
		if (!chosenCard) {
			throw new Error("PLAYER DOES NOT HAVE THIS CARD");
		}

		// Change card from player cards to player thrown cards
		player.cards = player.cards.filter(
			(playerCard) => playerCard !== chosenCard,
		);
		player.thrownCards.push(chosenCard);

		// If the lap is over, next turn player will be null, so we must start next lap
		if (!this.setNextCurrentTurn()) {
			/**
			 * If startNextLap returns CURRENT_ROUND_IS_NOT_FINISHED,
			 * the round is not finished, if it returns normal,
			 * there has not been any special case that is handled by that method
			 * (SPECIAL CASE 1, SPECIAL CASE 2, SPECIAL CASE 3, SPECIAL CASE 4)
			 * otherwise, an special case has been triggered
			 */
			const roundState = this.startNextLap(
				this.updateLapTrucWinnerPlayer(this.lap),
			);
			if (roundState !== "CURRENT_ROUND_IS_NOT_FINISHED") {
				// Update Score
				this.updateMatchScore(roundState);

				this.startNextRound();
				console.log("Starting next round");
			}
		}
	}

	/**
	 * This updates the next turn
	 * if the lap is over, it returns null
	 * @returns next current turn player or null
	 */
	private setNextCurrentTurn() {
		const nextCurrentTurn = this.turnQueue.getPlayer();
		if (nextCurrentTurn) {
			this.currentTurn = nextCurrentTurn;
			return this.currentTurn;
		}
		return nextCurrentTurn;
	}

	/**
	 * Get Player thrown card in a lap, returns null if no card has been thrown in that lap
	 * @param player
	 * @param lap
	 * @returns
	 */
	private getPlayerThrownCardInLap(player: Player, lap: typeof this.lap) {
		return player.thrownCards[lap - 1];
	}

	/**
	 * Start next lap, if lap 3 has ended, we must start a new round, so this method will return null and playerPlay will handle it.
	 * Otherwise, we will return the special cases that have been triggered.   *
	 *
	 * HANDLED BY THIS METHOD:
	 * - SPECIAL CASE 1: FIRST LAP TIED -> SECOND LAP WON
	 * - SPECIAL CASE 3: FIRST LAP WON -> SECOND LAP TIED
	 * - SPECIAL CASE 4: FIRST LAP WON -> SECOND LAP WON
	 *
	 * NOT HANDLED BY THIS METHOD:
	 * - SPECIAL CASE 2: FIRST LAP TIED -> SECOND LAP TIED -> THIRD LAP WON
	 * - SPECIAL CASE 5: FIRST LAP WON -> SECOND LAP LOST -> THIRD LAP TIED
	 * - SPECIAL CASE 6: FIRST LAP TIED -> SECOND LAP TIED -> THIRD LAP TIED
	 * @param winnerPlayer The player who is ma or this.tie
	 * @returns roundState
	 */
	private startNextLap(winner: TieAndMaPlayer): roundState {
		console.log("Starting next lap");
		// If first lap has been tied, we enter here
		if (this.trucWonLaps[0] === this.TIE && this.lap > 1) {
			// SPECIAL CASE 1: FIRST LAP TIED -> SECOND LAP WON
			if (!winner.tie && this.lap === 2) {
				return "SPECIAL_CASE_1";
			}
		}

		// SPECIAL CASE 3: FIRST LAP WON -> SECOND LAP TIED
		if (this.lap === 2 && winner.tie && this.trucWonLaps[0] !== this.TIE) {
			return "SPECIAL_CASE_3";
		}

		// SPECIAL CASE 4: FIRST LAP WON -> SECOND LAP WON
		if (
			this.trucWonLaps[0] === this.trucWonLaps[1] &&
			this.trucWonLaps[0] !== this.TIE
		) {
			return "SPECIAL_CASE_4";
		}

		// If lap counter is 3, the round has been finished normally
		if (this.lap === 3) {
			return "NORMAL";
		}

		// If there has not been special cases, and the round is not finished (LAP !== 3), the winner player will start next lap.
		// If players tied on the first round, the winner player will be the Ma Player and will throw first on next lap.
		const nextLapPlayer = winner.player;
		this.turnQueue = new Queue(
			this.players,
			this.getPlayerPositionInPlayersArray(nextLapPlayer),
		);

		// This should not be null
		this.currentTurn = this.turnQueue.getPlayer() as Player;

		// INCREASE LAP COUNTER
		this.lap += 1;
		return "CURRENT_ROUND_IS_NOT_FINISHED";
	}

	private startNextRound() {
		// Before starting a new round, we must check if a player has won
		// If a player has won, return that player
		const isMatchOver = this.isMatchOver();
		if (isMatchOver) {
			return "MATCH IS OVER NOTIFICATION";
		}
		// Create new turnQueue from startRoundPlayer
		//reset lap variables
		// Reset round state and start new round
		this.lap = 1;
		this.askedTruc = "none";
		this.hasToAcceptTrucPlayer1 = false;
		this.hasToAcceptTrucPlayer2 = false;
		this.playerThatAskedTruc = null;
		this.trucState = "none";
		this.trucWonLaps = [];
		this.trucState = "none";
		this.shuffleCards();
		// Clear thrown cards
		for (const player of this.players) {
			player.thrownCards = [];
		}
		// Get player who will start next round
		const player = this.roundInfiniteQueue.getPlayer();
		// Get Ma Player/ This wont be null because we will always have more than 0 players
		const maPlayer = this.roundInfiniteQueue.peek();
		if (!maPlayer) {
			throw new Error("No round 'ma' player available");
		}
		this.roundMaPlayer = maPlayer;
		// Define turnQueue
		this.turnQueue = new Queue(
			this.players,
			this.getPlayerPositionInPlayersArray(player),
		);
		// Define Current Turn
		this.currentTurn = this.turnQueue.getPlayer() as Player;

		// Set startingNewRound to true to notify that we are starting a new round
		this.startingNewRound = true;
	}

	/**
	 * This method will update match score depending on how the round has ended
	 *
	 * @param roundState The state of the round
	 *
	 * TRUC
	 * SPECIAL CASE 1
	 * Happens when the first lap has been tied, but the second has been won by a player.
	 * In this case, the player that won the second lap should win the game. (player 1 wins)
	 * FIRST LAP TIED -> SECOND LAP WON
	 *
	 * SPECIAL CASE 3
	 * Happens when a player wins the first lap, but the second is tied. In this case, wins the player
	 * that won the first lap. (player 1 wins)
	 * FIRST LAP WON -> SECOND LAP TIED
	 *
	 * SPECIAL CASE 4
	 * Happens when a player wins both the first and second lap.
	 * In this case, that player wins the game. (player 1 wins)
	 * FIRST LAP WON -> SECOND LAP WON
	 *
	 * This method handles the special cases 1, 3 and 4, because they all require three laps completed.
	 *
	 * SPECIAL CASE 2
	 * Happens when the first and second laps have been tied. In this case, wins the player
	 * that won the third lap. (player 1 wins)
	 * FIRST LAP TIED -> SECOND LAP TIED -> THIRD LAP WON
	 *
	 * SPECIAL CASE 5
	 * Hapeens win the first lap is won by a player, the second lap is lost by the same player, and the third lap is tied.
	 * and the third lap is a tie.
	 * Wins the player that won first lap. (player 1 wins)
	 * FIRST LAP WON -> SECOND LAP LOST -> THIRD LAP TIED
	 *
	 * SPECIAL CASE 6
	 * There is a tie on three laps. Wins the player who has the player who is ma.
	 * FIRST LAP TIED -> SECOND LAP TIED -> THIRD LAP TIED (Ma wins)
	 */
	private updateMatchScore(roundState: roundState) {
		// GET TRUC WINNER
		// This variable will have the winnerPlayer
		let winnerPlayer: Player | null = null;
		/**
		 * SPECIAL CASE 1
		 * We just need to check the winner of the trucWinner of the second lap
		 */
		if (roundState === "SPECIAL_CASE_1") {
			winnerPlayer = this.trucWonLaps[1] as Player; // If we are here, we will always have a player not a tie
		}

		/**
		 * SPECIAL CASE 3 and SPECIAL CASE 4
		 * To get the winner, we will check the winner of the first lap for SPECIAL CASE 3
		 * To get the winner for SPECIA CASEL 4, we have to do the same (we could also check winner of second round)
		 */
		if (roundState === "SPECIAL_CASE_3" || roundState === "SPECIAL_CASE_4") {
			winnerPlayer = this.trucWonLaps[0] as Player; // If we are here, we will always have a player not a tie
		}

		// "NORMAL" roundState - When 3 laps have been completed
		if (roundState === "NORMAL") {
			// Get won laps per player
			const cardWinnedLapsPlayer1 = this.trucWonLaps.filter(
				(player) => this.player1 === player,
			).length;

			const cardWinnedLapsPlayer2 = this.trucWonLaps.filter(
				(player) => this.player2 === player,
			).length;

			/**
			 * NORMAL GAME
			 * SPECIAL CASE 2 is also handled here, because the player that won third lap, will be assigned
			 * as winner.
			 * FIRST LAP TIED -> SECOND LAP TIED -> THIRD LAP WON
			 */
			if (cardWinnedLapsPlayer1 > cardWinnedLapsPlayer2) {
				winnerPlayer = this.player1;
			} else if (cardWinnedLapsPlayer1 < cardWinnedLapsPlayer2) {
				winnerPlayer = this.player2;
			} else {
				/**
				 * SPECIAL CASE 5: If cardWinnedLaps of one of each player is bigger than 0
				 * (meaning that the other player also won more than 0 rounds because if we are here cardWinnedLapsplayer1 == cardWinedLapsplayer2),
				 * we have to check if the third lap has a tie. If it has, the winner will be the player which won the first lap.
				 * In this case, there will always be a tie on the third lap, otherwise, we would not be inside this condition.
				 */
				if (cardWinnedLapsPlayer1 > 0) {
					winnerPlayer = this.trucWonLaps[0] as Player;
				} else {
					/**
					 * SPECIAL CASE 6: If cardWinnedLaps of both players is 0, we will be in this case.
					 * The winner player will be the player of the player who is 'mà'
					 * If we are in this condition, we just need to return the player of the player who is 'mà',
					 * because if the cardWinnedLaps of both players is different than 0, we would be on another condition
					 */
					winnerPlayer = this.roundMaPlayer;
				}
			}
		}

		// If a player abandon, give victory to other player
		if (roundState === "ABANDON") {
			// Player who called Abandon will be on the this.currenTurn variable.
			const player = this.currentTurn;
			// Save on winnerPlayer the player that did not abandon(If player 1 is in currentTurn, save plyaer 2, otherwise save player 1)
			winnerPlayer = player === this.player1 ? this.player2 : this.player1;
		}
		// If there is not a winnerPlayer, we will have an error, because a player should be assigned always
		if (!winnerPlayer) {
			throw new Error("THERE IS NO WINNER PLAYER TO UPDATE MATCH SCORE");
		}

		// Finally, we update matchScore
		const trucPoints: number = this.trucScore[this.trucState];
		if (winnerPlayer === this.player1) {
			this.score.player1 = this.score.player1 + trucPoints;
		} else {
			this.score.player2 = this.score.player2 + trucPoints;
		}
	}

	// Returns the truc value of the player thorwn card on a lap
	private getPlayerTrucValueOnLap(player: Player, lap: typeof this.lap) {
		return player.thrownCards[lap - 1].trucValue;
	}

	/**
	 * update truc winner player on a lap and assign it to this.trucWonLaps, if there is a tie, we will push tie constant
	 * @param lap
	 * @returns The player who won the round
	 */
	private updateLapTrucWinnerPlayer(lap: typeof this.lap) {
		interface ThrownCardAndPlayer {
			thrownCardValue: number;
			player: Player;
		}

		let winner: TieAndMaPlayer;

		// In case we only have one player, we assign him as winner
		if (this.players.length === 1) {
			winner = { tie: false, player: this.player1 };
		}

		const player1andTrucValueOnLap = {
			cardValue: this.getPlayerTrucValueOnLap(this.player1, lap),
			player: this.player1,
		};

		const player2andTrucValueOnLap = {
			cardValue: this.getPlayerTrucValueOnLap(this.player2, lap),
			player: this.player2,
		};

		// Check which player is winning or if there is a tie
		if (
			player1andTrucValueOnLap.cardValue === player2andTrucValueOnLap.cardValue
		) {
			// If we have a tie, we will return the player who throw first of the players that tied
			const firstPlayerToThrow = this.turnQueue.getEarliestPlayer(
				[player1andTrucValueOnLap.player, player2andTrucValueOnLap.player],
				true,
			) as Player;
			winner = { tie: true, player: firstPlayerToThrow };
		} else if (
			player1andTrucValueOnLap.cardValue > player2andTrucValueOnLap.cardValue
		) {
			winner = { tie: false, player: player1andTrucValueOnLap.player };
		} else {
			winner = { tie: false, player: player2andTrucValueOnLap.player };
		}

		// Assign the player that won the round or this.TIE to won laps array
		if (winner.tie) {
			this.trucWonLaps[lap - 1] = this.TIE;
		} else {
			this.trucWonLaps[lap - 1] = winner.player;
		}

		// Return the winner
		return winner;
	}

	/**
	 * Check if a player has won, if so, return that player, otherwise return false
	 * @returns player or false
	 */
	isMatchOver() {
		if (this.score.player1 === this.WIN_SCORE) {
			return this.player1;
		}
		if (this.score.player2 === this.WIN_SCORE) {
			return this.player2;
		}
		return false;
	}

	private getPlayerCard(player: Player, cardId: cardId) {
		return player.cards.find((matchCard) => matchCard.id === cardId);
	}

	// Shuffle players cards
	private shuffleCards() {
		// Shuffle cards
		const shuffledDeck = shuffleDeck(cards);

		let playerCards: CardsOfPlayer = [];
		// Get 3 cards from shuffledDeck

		// Assign Cards to player
		for (const player of this.players) {
			for (let i = 0; i <= 2; i++) {
				const card = shuffledDeck.pop();
				if (!card) {
					throw new Error("Deck is empty");
				}
				playerCards.push(card);
			}
			player.cards = playerCards;
			playerCards = [];
		}
	}

	private getPlayerPositionInPlayersArray(player: Player) {
		return this.players.findIndex((p) => p === player);
	}

	private newRoundStartedAcknowledged() {
		this.startingNewRound = false;
	}
}
