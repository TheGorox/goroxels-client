export const OPCODES = {
    chunk:   0x0,
    place:   0x1,
    online:  0x2,
    canvas:  0x3,
    pixels:  0x4
}

export const STRING_OPCODES = {
    error: 'e',
    userJoin: 'u',
    userLeave: 'l',
    chatMessage: 'c',
    alert: 'a'
}

export function packPixel(x, y, col) {
    return (x << 12 | y) << 7 | col
}

export function unpackPixel(num) {
    return [
        num >>> 19,
        num >>> 7 & 0xFFF,
        num & 0b1111111
    ]
}