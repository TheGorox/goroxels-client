export function mod(n, m) {
    return ((n % m) + m) % m;
}

export function dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1)
}

export function avrg(...values) {
    return values.reduce((a, b) => a + b) / values.length
}
