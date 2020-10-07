export default {
    line: function (x, y, x2, y2) {
        let pointArr = [];

        let steep = Math.abs(y2 - y) > Math.abs(x2 - x);
        if (steep) {
            [x, y] = [y, x];
            [x2, y2] = [y2, x2];
        }
        let reverseFlag = false;
        if (x > x2) {
            [y, y2] = [y2, y];
            [x, x2] = [x2, x];
            reverseFlag = true;
        }
        let dist = {
            x: x2 - x,
            y: Math.abs(y2 - y)
        }
        let err = dist.x / 2;
        let stepY = (y < y2) ? 1 : -1;
        for (; x <= x2; x++) {
            pointArr.push([steep ? y : x, steep ? x : y]);
            err -= dist.y;
            if (err < 0) {
                y += stepY;
                err += dist.x;
            }
        }
        if (reverseFlag) pointArr.reverse();

        return pointArr;
    }
}