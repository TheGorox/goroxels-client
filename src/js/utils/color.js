export function rgb2abgr(r, g, b) {
    return 0xff000000 | b << 16 | g << 8 | r;
}

function component2hex(c) {
    return c.toString(16).padStart(2, '0');
}

export function rgb2hex(rgb) {
    return '#' + component2hex(rgb[0]) + component2hex(rgb[1]) + component2hex(rgb[2])
}

// export function isDarkColor(r, g, b) {
//     // V value from HSV
//     return Math.max(r / 255, g / 255, b / 255) < 0.5
// }

export function applyColor(origColor, tintColor) {
    var alpha = tintColor[3] / 255;

    return [
        Math.round((1 - alpha) * origColor[0] + alpha * tintColor[0]),
        Math.round((1 - alpha) * origColor[1] + alpha * tintColor[1]),
        Math.round((1 - alpha) * origColor[2] + alpha * tintColor[2])
    ];
}

export function closestColor(rgb, palette){
    let colorId = -1;
    let score = 768; // 255 + 255 + 255

    for(let i = 0; i < palette.length; i++){
        const item = palette[i];

        let scrnow = Math.abs(rgb[0] - item[0]) + Math.abs(rgb[1] - item[1]) + Math.abs(rgb[2] - item[2]);
        if (scrnow < score) {
            score = scrnow;
            colorId = i;
        }

        if(scrnow == 0) break;
    }
    return colorId;
}

export function isDarkColor(r, g, b){
    const darkness = 1-(0.299*r + 0.587*g + 0.114*b)/255;
    return darkness > 0.5;
}