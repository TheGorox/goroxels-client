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

        pointArr.reverse();

        return pointArr;
    },

    filledCircle: function (centerX, centerY, r) {
        let pixels = [];

        const squareR = r * r;

        for (let _x = -r + centerX; _x < r + centerX; _x++) {
            for (let _y = -r + centerY; _y < r + centerY; _y++) {
                if (isIn(_x, _y)) {
                    pixels.push([_x, _y])
                }
            }
        }

        function isIn(_x, _y) {
            let dx = _x - centerX,
                dy = _y - centerY;

            if (dx * dx + dy * dy <= squareR * 0.8)
                return true
            return false
        }

        return pixels
    },

    square(x1, y1, x2, y2) {
        const minX = Math.min(x1, x2),
            minY = Math.min(y1, y2),
            maxX = Math.max(x1, x2),
            maxY = Math.max(y1, y2);

        let pixels = [];
        for (let y = minY; y < maxY+1; y++) {
            for (let x = minX; x < maxX+1; x++) {
                pixels.push([x, y]);
            }
        }

        return pixels
    }
}