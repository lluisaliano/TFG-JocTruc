/**
 * Regret-matching: retorna una estratègia (vector de probabilitats)
 * donats els regrets acumulats per a cada acció. Si la suma de regrets positius
 * és zero, retorna una estrategia uniforme (Cada acció te la mateixa porbabilitat).
 */
export function regretMatching(regretSum: number[]): number[] {
    const n = regretSum.length;
    const strategy: number[] = new Array(n).fill(0);
    let sumPositive = 0;

    for (let i = 0; i < n; i++) {
        strategy[i] = regretSum[i] > 0 ? regretSum[i] : 0;
        sumPositive += strategy[i];
    }

    if (sumPositive > 0) {
        for (let i = 0; i < n; i++) {
            strategy[i] /= sumPositive;
        }
    } else {
        for (let i = 0; i < n; i++) {
            strategy[i] = 1 / n;
        }
    }

    return strategy;
}

/**
 * Calcula l'estratègia mitjana a partir dels valors acumulats de strategySum.
 * Si la suma és zero, retorna uniformitat.
 */
export function getAverageStrategy(strategySum: number[]): number[] {
    const n = strategySum.length;
    const avgStrategy: number[] = new Array(n).fill(0);
    const total = strategySum.reduce((a, b) => a + b, 0);

    if (total > 0) {
        for (let i = 0; i < n; i++) {
            avgStrategy[i] = strategySum[i] / total;
        }
    } else {
        for (let i = 0; i < n; i++) {
            avgStrategy[i] = 1 / n;
        }
    }

    return avgStrategy;
}
