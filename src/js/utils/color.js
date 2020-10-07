export function rgb2abgr(r, g, b) {
    return 0xff000000 | b << 16 | g << 8 | r;
}

function component2hex(c) {
    return c.toString(16).padStart(2, '0');
}

export function rgb2hex(rgb) {
    return '#' + component2hex(rgb[0]) + component2hex(rgb[1]) + component2hex(rgb[2])
}

export function isDarkColor(r, g, b) {
    // V value from HSV
    return Math.max(r / 255, g / 255, b / 255) < 0.5
}