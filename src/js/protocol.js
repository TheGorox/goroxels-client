// change utils/recorder if changes

export const OPCODES = {
    chunk:   0x0,
    place:   0x1,
    online:  0x2,
    canvas:  0x3,
    pixels:  0x4,
    captcha: 0x5
}

export const STRING_OPCODES = {
    error: 'e',
    userJoin: 'u',
    userLeave: 'l',
    subscribeChat: 's',
    chatMessage: 'c',
    alert: 'a',
    me: 'm',
    reload: 'r'
}

// max coords is up to 4096
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