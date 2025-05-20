import type { Cards } from "../types/game.ts";

/**
 * Generate random integer between 0 and integer
 * @param integer
 * @return randomInteger
 */
export function randomInteger(number: number) {
	return Math.floor(Math.random() * (number + 1));
}

// Fisher yates algorithm to shuffle cards
export function shuffleDeck(deck: Cards) {
	const shuffledDeck = [...deck];
	for (let i = deck.length - 1; i > 0; i--) {
		const j = randomInteger(i);
		[shuffledDeck[j], shuffledDeck[i]] = [shuffledDeck[i], shuffledDeck[j]]; // Exchange Cards
	}
	return shuffledDeck;
}
