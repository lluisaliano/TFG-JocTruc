// CFR.ts

import { TrucMatch } from "./TrucMatch";
import type { Card, CallType } from "./types/game";
import { regretMatching, getAverageStrategy } from "./RegretMatching";

/**
 * Representa un node d'informació pel CFR:
 * actions: llista d'accions en aquest conjunt d'informació
 * regretSum: vector de regrets acumulats (un per acció)
 * strategySum: vector d'estratègia acumulada (per calcular l'average strategy)
 */
interface InfoSetNode {
	actions: Array<Card | CallType>;
	regretSum: number[];
	strategySum: number[];
}

export class CFRTrainer {
	private nodeMap: Map<string, InfoSetNode> = new Map();

	/**
	 * Inicia l'entrenament CFR durant el nombre indicat de iteracions.
	 * Per cada iteració, es crea un nou TrucMatch (ronda 1v1) i es fa cfr(...) amb les probabilitats acumulades 1,1.
	 */
	train(iterations: number): void {
		for (let i = 0; i < iterations; i++) {
			if (iterations > 10000 && i % 10000 === 0) {
				console.log(`Iteration ${i}/${iterations}`);
			}
			const game = new TrucMatch(["player1", "player2"]);
			this.cfr(game, 1, 1);
		}
	}


	/**
	 * Retorna l'estrategia mitjana de cada conjunt d'informació després de l'entrenament.
	 * Cada entrada del map té la clau infoSetKey i el vector de probabilitats corresponent.
	 */
	getAverageStrategyMap(): Map<string, number[]> {
		const avgMap: Map<string, number[]> = new Map();
		this.nodeMap.forEach((node, key) => {
			const avgStrat = getAverageStrategy(node.strategySum);
			avgMap.set(key, avgStrat);
		});
		return avgMap;
	}

	/**
	 * Recursió principal de l'algorisme CFR.
	 * state: l'estat actual de la ronda (TrucMatch)
	 * p0: probabilitat acumulada per al jugador 0
	 * p1: probabilitat acumulada per al jugador 1
	 * Retorna l'utilitat des de la perspectiva del jugador 0.
	 */
	private cfr(state: TrucMatch, p0: number, p1: number): number {
		// Si l'estat és terminal, retornem l'utilitat per al jugador 0.
		if (state.isTerminal()) {
			return state.utility(0);
		}

		// Identifiquem quin jugador ha de moure en aquest torn
		const currentPlayer = state.currentPlayerIndex();
		const infoKey = state.getInfoSetKey(currentPlayer);

		// Obtenim el conjunt de informació corresponent
		let node = this.nodeMap.get(infoKey);
		const legalActions = state.getActions(currentPlayer);

		if (!node) {
			// Primera vegada que veiem aquest conjunt d'informació: inicialitzem vectors a zero
			node = {
				actions: legalActions.slice(), // Copiem la llista d'accions
				regretSum: new Array(legalActions.length).fill(0),
				strategySum: new Array(legalActions.length).fill(0),
			};
			this.nodeMap.set(infoKey, node);
		}

		// Calculem l'estratègia actual amb l'algorisme de regret matching
		const strategy = regretMatching(node.regretSum);

		// Acumulem la contribució de l'estrategia al strategySum
		const reachProb = currentPlayer === 0 ? p0 : p1;
		for (let i = 0; i < strategy.length; i++) {
			node.strategySum[i] += reachProb * strategy[i];
		}

		// Per a cada acció, simulem la següent ronda i calculem utilitats
		const util: number[] = new Array(node.actions.length).fill(0);
		let nodeUtil = 0;

		for (let i = 0; i < node.actions.length; i++) {
			const action = node.actions[i];
			const nextState = state.clone();

			// Apliquem l'acció a la còpia de l'estat
			this.applyAction(nextState, currentPlayer, action);

			// Recalculem CFR en el següent estat
			let actionUtil: number;
			if (currentPlayer === 0) {
				actionUtil = this.cfr(nextState, p0 * strategy[i], p1);
			} else {
				actionUtil = this.cfr(nextState, p0, p1 * strategy[i]);
				// Negatiu perquè zero-sum
				actionUtil = -actionUtil;
			}

			util[i] = actionUtil;
			nodeUtil += strategy[i] * actionUtil;
		}

		// Actualitzem regrets acumulats
		for (let i = 0; i < node.actions.length; i++) {
			const regret = util[i] - nodeUtil;
			if (currentPlayer === 0) {
				// Contribució contrafactual: p1 * regret
				node.regretSum[i] += p1 * regret;
			} else {
				// Contribució contrafactual: p0 * regret (i = 1)
				node.regretSum[i] += p0 * regret;
			}
		}

		return nodeUtil;
	}

	/**
	 * Realitzem una acció (Tirar Carta o Trucar) sobre l'estat de TrucMatch.
	 * playerIdx: 0 o 1 (índex de jugador)
	 * action: si és string, és un CallType; sinó, és un objecte Card.
	 */
	private applyAction(
		state: TrucMatch,
		playerIdx: number,
		action: Card | CallType
	) {
		const playerName = state.getState().players[playerIdx].userName
		state.applyAction(action, playerName);
	}
}
