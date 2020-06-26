import { palette } from './config'
import Bucket from './Bucket'

export default window.player = {
    x: 0,
    y: 0,
    color: Math.random() * palette.length | 0,
    bucket: null,
    updateBucket([delay, max]) {
        this.bucket = new Bucket(delay, max);
    }
}