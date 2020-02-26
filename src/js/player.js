import {palette} from './config'

export default window.player = {
    x: 0,
    y: 0,
    color: Math.random() * palette.length | 0
}