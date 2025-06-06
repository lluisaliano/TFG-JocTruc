import type { Player, Players } from "../types/game.ts";
import { Queue } from "./Queue.ts";

/**
 * Represents an infinite queue that cycles through players indefinitely.
 * Extends the base `Queue` class and modifies its behavior to create a circular linked list.
 *
 * @class InfiniteQueue
 * @extends Queue
 *
 */
export class InfiniteQueue extends Queue {
	private length: number;
	constructor(players: Players, startPlayerPos: number) {
		super(players, startPlayerPos);
		// Do an infinite Queue
		const first = this.getFirstNode();
		const last = this.getLastNode();
		this.length = players.length;

		if (!last || !first) {
			throw new Error("Queue must be initialized with at least one player");
		}

		last.next = first;
	}

	getPlayer(): Player {
		const node = this.getFirstNode();
		if (!node || !node.next) {
			throw new Error("Invalid infinite queue state");
		}
		this.setFirstNode(node.next);
		this.setLastNode(node);
		return node.player;
	}

	peek(): Player {
		const node = this.getFirstNode();
		if (!node) {
			throw new Error("Queue is empty");
		}
		return node.player;
	}

	private buildPlayerPositionMap(): Map<string, number> {
		const map = new Map<string, number>();
		let pointer = this.getFirstNode();
		let position = 0;
		for (let i = 0; i < this.length; i++) {
			if (!pointer) {
				break;
			}
			map.set(pointer.player.userName, position);
			pointer = pointer.next;
			position++;
		}
		return map;
	}

	/**
	 * Retrieves the earliest player based on their position in the queue.
	 * For infiniteQueue, it retrieves from the real time queue, for Queue, it retrieves from the original queue.
	 *
	 * @param players - A collection of players to evaluate.
	 * @param returnPlayer - A boolean indicating whether to return the player object
	 *                       or their position in the queue.
	 * @returns The earliest player object if `returnPlayer` is true, otherwise the
	 *          position of the earliest player in the queue.
	 */
	getEarliestPlayer(players: Players, returnPlayer: boolean) {
		interface AuxInterface {
			player: null | Player;
			pos: number;
		}
		let firstPlayer: AuxInterface = {
			player: null,
			pos: Number.MAX_SAFE_INTEGER,
		};

		let bestPos = Number.MAX_SAFE_INTEGER;
		const positionMap = this.buildPlayerPositionMap();

		for (const player of players) {
			const pos = positionMap.get(player.userName);
			if (pos !== undefined && pos < bestPos) {
				bestPos = pos;
				firstPlayer = { player, pos: bestPos };
			}
		}
		if (firstPlayer.player === null) {
			return bestPos;
		}
		return returnPlayer ? firstPlayer.player : bestPos;
	}
}
