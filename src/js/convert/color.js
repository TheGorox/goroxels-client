// Честно спизжено у уже известного автора
// Используется исключительно для конверта в lab
var colorManip = {
    // Turn a hex color string (without leading '#') into an RGB color array.
    hex2rgb(hex) {
        return [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
    },

    // Bitshift-encode a color (RGB array)
    rgb2enc(rgb) {
        return rgb[0] << 16 | rgb[1] << 8 | rgb[2];
    },

    // Turn an RGB color array into a hex color string (without leading '#')
    rgb2hex(rgb) {
        // const rgbHex = rgb[2] | rgb[1] << 8 | rgb[0] << 16;

        return (0x1000000 + colorManip.rgb2enc(rgb)).toString(16).slice(1);
    },

    // as short-hand, from RGB to L*a*b*
    rgb2lab(col) {
        const rgb = colorManip.srgb2rgb(col);
        const xyz = colorManip.rgb2xyz(rgb);
        const lab = colorManip.xyz2lab(xyz);

        return lab;
    },

    // convert an rgb color to an srgb color
    rgb2srgb(col) {
        const rp = col[0] / 255;
        const gp = col[1] / 255;
        const bp = col[2] / 255;
        const r = (rp < 0.0031308 ? rp * 12.92 : 1.055 * Math.pow(rp, 1 / 2.4) - 0.055) * 255;
        const g = (gp < 0.0031308 ? gp * 12.92 : 1.055 * Math.pow(gp, 1 / 2.4) - 0.055) * 255;
        const b = (bp < 0.0031308 ? bp * 12.92 : 1.055 * Math.pow(bp, 1 / 2.4) - 0.055) * 255;

        return [r, g, b];
    },

    // from rgb to CIE XYZ
    rgb2xyz(col) {
        // D65 / 2&#65533;
        const r = col[0] / 255;
        const g = col[1] / 255;
        const b = col[2] / 255;

        const x = r * 41.2453 + g * 35.7580 + b * 18.0423;
        const y = r * 21.2671 + g * 71.5160 + b * 7.2169;
        const z = r * 1.9334 + g * 11.9193 + b * 95.0227;

        return [x, y, z];
    },

    // convert an srgb color to an rgb color
    srgb2rgb(col) {
        const r = col[0] / 255;
        const g = col[1] / 255;
        const b = col[2] / 255;

        const rp = (r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92) * 255;
        const gp = (g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92) * 255;
        const bp = (b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92) * 255;

        return [rp, gp, bp];
    },

    // from CIE CYZ to CIE L*a*b*
    xyz2lab(xyz) {
        // D65 / 2&#65533; | L*a*b*
        let x = xyz[0] / 95.047;
        let y = xyz[1] / 100.000;
        let z = xyz[2] / 108.883;

        x = x > 0.008856451586 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
        y = y > 0.008856451586 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
        z = z > 0.008856451586 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

        const l = 116 * y - 16;
        const a = 500 * (x - y);
        const b = 200 * (y - z);

        return [l, a, b];
    },

    // from CIE L*a*b* to DIN99-space (an improved perceptually uniform color space)
    lab2din99(lab) {
        // for graphics work, these are set to 1 and are ignored / substituted
        // const kCH = 1;
        // const kE = 1;
        const phi = 26 / 180 * Math.PI;
        const cosPhi = Math.cos(phi);
        const sinPhi = Math.sin(phi);
        const factor = 100 / Math.log(139 / 100);

        // const l = factor / kE * Math.log(1 + 0.0039 * lab[0]); // non-substituted
        const l = factor * Math.log(1 + 0.0039 * lab[0]);
        if (lab[1] === 0 && lab[2] === 0) {
            return [l, 0, 0];
        }
        const e = color.a * cosPhi + color.b * sinPhi;
        const f = 0.83 * (color.b * cosPhi - color.a * sinPhi);
        const G = Math.sqrt(e * e + f * f);
        // const c = Math.log(1 + 0.075 * G) / (0.0435 * kCH * kE); // non-substituted
        const c = Math.log(1 + 0.075 * G) / 0.0435;
        const h = (Math.atan2(f, e) + Phi) / Math.PI * 180;

        return [l, c * Math.cos(h / 180 * Math.PI), c * Math.sin(h / 180 * Math.PI)];
    },

    // Mix two colors, with basic SRGB conversion in mind
    mixColors(col1, col2) {
        let mix = [0, 0, 0];
        const col1p = colorManip.srgb2rgb(col1);
        const col2p = colorManip.srgb2rgb(col2);
        for (let i = 2; i >= 0; i -= 1) {
            mix[i] = (col1p[i] + col2p[i]) / 2;
        }
        mix = colorManip.rgb2srgb(mix);

        // no amount of floating points is ever enough to prevent degradation
        // so we'll just round to 3 digits here, which is still more than enough for color conversions.
        mix[0] = Math.round(mix[0] * 1000) / 1000;
        mix[1] = Math.round(mix[1] * 1000) / 1000;
        mix[2] = Math.round(mix[2] * 1000) / 1000;

        return mix;
    },

    // Let's set up a Look-up table for mapping colors, so we can skip the relatively expensive mapping functions if we've already mapped a given color.
    // See further code comments for how this works.
    mapLUT: [],
    mappedColors: 0,

    // (modified) CIE DE2000 - the best Delta E (color difference) equation-function-thing yet (but only because a few others dropped the ball,
    // these things take forever to make it mainstream, and the mp3 effect; it's 'good enough' and people are hesitant to move to new methods).
    //
    // It works in L*a*b* space which was supposed to be perceptually uniform
    // (so moving a little bit from one color to another color would have that color be 'as different' as if you moved the same amount from any other color)
    // but, surprise, surprise, wasn't quite.
    //
    // So instead of making a new perceptually uniform color space (I mean, L*a*b* does get pretty close without being really obnoxious to transform into,
    // and they *have* been trying - boy have they ever been trying with no less than 12 since the CIEDE2000 proposal up to 2008 alone; and I'm writing this in 2017, so...)
    // color difference functions have just been stretching and warping the CIE L*a*b* color space, and re-interpreting its components, to be more perceptually uniform instead.
    //
    // To paraphrase Shizhe Shen's thesis (see below): "We do not fully understand these phenomena with which we are so familiar - as usual."
    //
    // But as with all these Delta E functions, they are intended for *small* differences,
    // which may not apply when mapping full color images to rather limited pixel art palettes.
    // Example of extreme:
    //   ciede2000([0,0,106], [143 255 0]) >= 119.45710395236401
    //   ciede2000([0,0,106], [142 255 0]) <= 102.44521098432386
    // also, look at the size of this thing and the heavy reliance on square roots and exponentializing.. ew! slow!  This doesn't even count the SRGB > RGB > XYZ > L*a*b* conversion steps.
    // (one of the main reasons people were working on different color spaces so we can just go back to euclidian distances)
    // to make it a bit more speedy, pre-convert colors to L*a*b so it doesn't have to be done repeatedly for each palette entry.
    //
    // And just because CIEDE2000 is such a freakin' nightmare, have some light reading material:
    // CIE 142-2001 - IMPROVEMENT TO INDUSTRIAL COLOUR-DIFFERENCE EVALUATION, technical report.  Draft retrieved from: http://cie.mogi.bme.hu/cie_arch/kee/div1/tc147.pdf
    // ( note: The final paper is behind paywalls and it is, along with many other standards-bodies specifications, heavily policed on the internet.  Information wants to  be ~~free~~ **commercialized**, folks. )
    // The Development of the CIE 2000 Colour-Difference Formula: CIEDE2000.  Paper retrieved from: http://onlinelibrary.wiley.com/doi/10.1002/col.1049/abstract
    // New formula for the Computation of CIE 1976 Hue Difference.  Paper retrieved from: http://onlinelibrary.wiley.com/doi/10.1002/col.5080160311/abstract
    // The CIEDE2000 Color-Difference Formula: Implementation Notes [...].  Paper retrieved from: http://www.ece.rochester.edu/~gsharma/ciede2000/ciede2000noteCRNA.pdf
    // Relative significance of the terms in the CIEDE2000 and CIE94 color-difference formulas.  Paper retrieved from: https://www.osapublishing.org/josaa/ViewMedia.cfm?uri=josaa-21-12-2269
    // Modification of CIEDE2000 for Assessing Color Quality of Image Archives.  Paper retrieved from: https://www.rit.edu/cos/colorscience/mellon/Publications/Berns_SL=1_Archiving_2016.pdf
    // Color difference formula and unfiform color space modeling and evaluation.  Thesis (gj, Shizhe Shen!) retrieved from: http://scholarworks.rit.edu/cgi/viewcontent.cgi?article=5577&context=theses
    //
    // The implementation here is my own (CtrlZ's) based on my own earlier implemention in VB of all things, with modifications to make it run in js, simplification, and added comments.
    // This includes the modification recommended by Berns (this guy colors) to do away with the SL adjustment, which led to the 'm' prefix, just in case anybody decides to copy/paste this, the 'm' in front should make them do some reading.
    //
    // maximum Delta E value <= 120
    // symmetric: true
    mciede2000lab(Lab1, Lab2) {
        const rad = 180 / Math.PI; // this is just for javascript being all about them rads, while the CIEDE2000 function uses degrees.

        // notes on variable names:
        // dX = deltaX, difference between some value in Lab1 and Lab2 or derived values thereof.
        // Xavg = average, average between some value in Lab1 and Lab2 or derived values thereof.
        // Xp = prime ('), as used in the original tech report.

        // Weighting factors.  They're all used as multipliers or divisors, and they're all 1.  So &#65533;\_(&#12484;)_/&#65533;
        // const kL = 1;
        // const kC = 1;
        // const kH = 1;

        // Get the L*, a* and b* values of both input colors.
        const L1 = Lab1[0];
        const a1 = Lab1[1];
        const b1 = Lab1[2];

        const L2 = Lab2[0];
        const a2 = Lab2[1];
        const b2 = Lab2[2];

        // Luminance is fine and needs no modification, so let's get the Luminance difference, and the Luminance average here.
        const dL = L2 - L1;
        // const Lavg = (L1 + L2) / 2.0;

        // We ~~do~~ *don't, see below* need to modify the average though, based on an assumption that the colors of interest to be seen with a surrounding background of L* = 50.
        // const Lavgp = (Lavg - 50.0)*(Lavg - 50.0);
        // In fact, the following parameters are actually set:
        // D65 lighting source at 1000 lux
        // Sample sizes should cover 4&#65533; of the observer's vision (they also need to not be )color) blind; huh.)
        // The two samples should be side-by-side with no space between them, and should be superduperflat and non-reflective (matte, but without texture)

        // Get the 'C' values using the euclidian distance between values on the the a* (red-green) and b* (blue-yellow) axes.
        // This is the same C-for-chroma as in the L*C*h&#65533; color model, very similar to saturation, but actually 'greyness'.
        const C1 = Math.sqrt(a1 * a1 + b1 * b1);
        const C2 = Math.sqrt(a2 * a2 + b2 * b2);

        // Here the a* terms are getting modified.  The reason for this is that where the colors are 'neutral', the differences in the b* term are more readily apparent than in a*.
        // If plotted on a cartesian graph a*/b*, this basically means that areas of 'sameness' in the neutral region appear as ellipses, rather than circles.
        // So why not use an ellipse formula to squash things together into a nice circular shape?  Why not indeed, and that's what's going on here.
        // How much squashing was needed, and how rapidly so depending on Chroma, was determined via fitting, so just roll with the numbers they got.

        // Get the Chroma average.  We're gonna need this to see just how much the squashing needs to be scaled.
        const Cavg = (C1 + C2) / 2.0;

        // const f = 6103515625 // Magic number?  No, just a pre-calculation of Math.pow(25,7).  But seeing as that's a fixed number, why bother with a variable?
        const G = 0.5 * (1 - Math.sqrt(Math.pow(Cavg, 7) / (Math.pow(Cavg, 7) + 6103515625))) + 1; // note: because the paper adds 1 before multiplying with the a* terms, this has been folded in here.
        const a1p = G * a1; // (1 + G) * a1
        const a2p = G * a2; // (1 + G) * a2

        // The b* term is left alone.  The papers 'suggest' this as a new variable b' anyway, but I'm skipping it.
        // const b1p = b1;
        // const b2p = b2;

        // Now that we have the modified a* as a', let's re-do the Chroma calculations.  This is a *modified* Chroma term, so C'.
        const C1p = Math.sqrt(a1p * a1p + b1 * b1); // b1p
        const C2p = Math.sqrt(a2p * a2p + b2 * b2); // b2p
        // And as with the Luminance, we can get their difference and their average, good to go.
        const dCp = C2p - C1p;
        const Cpavg = (C1p + C2p) / 2.0;

        // Now let's figure out the hue angle term.  If you read through the original tech report, this part probably gave you a head-ache.
        // The reason being that they don't mention caveats until later (2.5.1 and 2.6.1) in the report, and provide no formula where this is originally introduced (2.3).
        // See the 'Implementation Notes' paper instead; it's superior for this purpose.
        // This 'h' is the same hue as in L*C*h* as well.  Note that this is 'h' (angle), not 'H' (position in space) - we'll get H later.
        // note: because we didn't make new variables b', presume b1/b2 below to be b1p/b2p from the paper.
        let h1p = -1;
        if (a1p === 0 && b1 === 0) {
            h1p = 0; // if there's no color, then hue is defined as being 0 ('red')
        } else if (b1 >= 0) {
            h1p = Math.atan2(b1, a1p) * rad; // if the b* term is more yellow, take the angle directly
        } else {
            h1p = Math.atan2(b1, a1p) * rad + 360; // but if it's more blue, add 360 degrees so we don't end up with negative angles.  This won't make much sense here, but it will once we start getting the hue *difference* later on.
        }
        // Do the same for the second color.
        let h2p = -1;
        if (a2p === 0 && b2 === 0) {
            h2p = 0;
        } else if (b2 >= 0) {
            h2p = Math.atan2(b2, a2p) * rad;
        } else {
            h2p = Math.atan2(b2, a2p) * rad + 360;
        }
        // So now we basically have our values in L*C*h space, but with a modified C' term, so L*C'h*
        // You might be tempted to think that "L*a'b*" consitutes a color space.  Don't.
        // This is *only* for color difference calculation, and the modification to a* distorts the color space in wonky ways that aren't good for anything much else.

        // Now figure out the diference between these two values.  We're down to equation 2.10 in the draft tech report here.
        // We really want the values to just be -180&#65533; through 180&#65533; around 0 so later calculations involving sin/cos don't freak out.
        let dhp = h2p - h1p;
        if (dhp > 180) {
            dhp -= 360; // so if we ended up with a value that's too big, subtract 360&#65533;
        } else if (dhp < -180) {
            dhp += 360; // and if we ended up with a value that's too small, add 360&#65533;
        }

        // Now for the average hue angle, and a quick refresher in mathematical notations and code interpretation.
        // If you look at the implementation notes paper, you'll see this expressed in mathematical terms as follows using our existing variables and a reminder:
        //
        //         , (h1p+h2p)/2       IF   |h1p-h2p|<=180; C1pC2p != 0
        // hpavg = | (h1p+h2p+360)/2   IF   |h1p-h2p|>180; (h1p+h2p) < 360; C1pC2p != 0
        //         | (h1p+h2p-360)/2   IF   |h1p-h2p|>180; (h1p+h2p) >= 360; C1pC2p != 0
        //         ` (h1p+h2p)         IF   C1pC2p == 0
        //
        // The 'IF' isn't in there, but that's basically what it means.  hpavg is set equal to one of the four values on the left based on the condition on the right being true.
        // Because the first 3 outcomes depend on the condition for the last outcome to NOT be true, might as well start with that one instead.
        let hpavg = -1;
        if (C1p * C2p === 0) { // C1pC2p in the paper omits the multiplication sign as mathematicans often do, but multiplication between those two variables is what is meant.
            hpavg = h1p + h2p;
            // Because 2 of the other outcomes depend on the condition for the first outcome to NOT be true (|h1p-h2p|&#8804;180 == false), might as well use that as the next condition
        } else if (Math.abs(h2p - h1p) <= 180) {
            hpavg = (h1p + h2p) / 2;
            // That leaves us with two options.. either h2p+h1p is less than 360, which will be our next option...
        } else if (h2p + h1p < 360) {
            hpavg = (h1p + h2p + 360) / 2;
            // or it'll be greater than or equal to 360.  No need to specify this, as the previous directly infers it.
        } else {
            hpavg = (h1p + h2p - 360) / 2;
        }

        // So now for some fun further non-uniformity stuff, based on experiments, mostly a factor of the 'color' (chroma&hue) of the colors.
        // SL is a compensation for luma differences.  There's a bit of controversy here, as further research showed that this number may have come into being as the result of a bias toward a single test set (the 'Leeds' set). Gasp.
        // The researchers found that the easiest solution for removing this bias is to simply eliminate the term altogether, by setting S'L to 1.

        // Which, combined with the weighting k'L being set to 1, means that p just ends up equaling dL (Luma difference) - so let's skip that one, too
        // which also means we can skup Lavgp up there, so if you were wondering why that got commented out - now you know.
        // const SL = 1 + (0.015 * Lavgp / Math.sqrt(20 + Lavgp));
        // const p = dL / SL / kL;

        // SC is a compensation for chroma differences.  This is the same one as used in CIE'94, an earlier color difference formula.
        // Nothing out of the ordinary here, sverbatim from the original tech report .. minus the kC weight, seeing as that's just 1.0 anyway.
        const SC = 1 + 0.045 * Cpavg;
        const q = dCp / SC; // dCp / SC/ kC;

        // Told you we'd get H later.  Sort of anyway - since we only care about H positional difference, we can just use the hue *angle* difference directly.
        // From S&#65533;ve's work:
        const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp / rad / 2);

        // SH is a compensation for hue differences.
        // Again, while this looks complex, it's only because this a derived best fit to test samples - thus a lot of magic numbers.
        const T = 1 - 0.17 * Math.cos((hpavg - 30) / rad) + 0.24 * Math.cos(2 * hpavg / rad) + 0.32 * Math.cos((3 * hpavg + 6) / rad) - 0.2 * Math.cos((4 * hpavg - 63) / rad);
        const SH = 1 + 0.015 * Cpavg * T;
        // kH weight is 1, so ignore.
        const r = dHp / SH; // dHp / SH / kH

        // Specific compensation for weird stuff happening in the blue color region.
        // Specifically, the ellipses end up being rotated counter-clockwise.  Not for any particularly good reason, but because human vision.
        // So we'll have to rotate 'm back.. but only in the blue color region, thus here's delta Theta which focuses on the blue region.
        const dTheta = 30 * Math.exp(-1 * ((hpavg - 275) / 25.0) * ((hpavg - 275) / 25.0));
        // Here's another elliptical formula thing focusing on the Chromaticity.
        const RpC = 2 * Math.sqrt(Math.pow(Cpavg, 7) / (Math.pow(Cpavg, 7) + 6103515625));
        // and finally a rotation term (RT in the paper) that combines both into a weighting.
        const RpT = -Math.sin(2 * dTheta / rad) * RpC;

        // Now for the piece the resistance, a good ol' euclidian distance based on the Luma difference, a weighted Chroma difference, a weighted Hue difference, and the rotation term applies to Chroma and Hue.
        const deltaE = Math.sqrt(dL * dL + q * q + r * r + RpT * q * r); // p*P + q*q + r*r + RpT * q * r

        // And that's the color difference.  Hurrah!
        return deltaE;
    },

    // just in case RGB values did need to be compared, inline the RGB to L*a*b* conversion
    mciede2000(col1, col2) {
        return colorManip.mciede2000lab(colorManip.rgb2lab(col1), colorManip.rgb2lab(col2));
    },

    // and just because things are funky in this particular use case...
    // - the palette is pre-converted to L*a*b*
    // - the input image's pixels are in RGB
    // ...offer a mixed version where the first color is rgb and the second is lab
    mciede2000mix(col1rgb, col2lab) {
        return colorManip.mciede2000lab(colorManip.rgb2lab(col1rgb), col2lab);
    },

    // Because CIEDE2000 is relatively slow, we have this one, too.  It's not nearly as accurate,
    // but it does give 'okay' results with much less processing.
    // It also readily beats CIE'94 in both speed and performance when it comes to mapping to limited palettes.
    // This just biases the color differences with their apparent luminance - quick and dirty; Luma-weighted RGB
    // maximum Delta E value <= 1.75
    // symmetric: true
    lwrgbde(col1, col2) {
        const r1 = col1[0];
        const r2 = col2[0];
        const dr = (r1 - r2) / 255;
        const g1 = col1[1];
        const g2 = col2[1];
        const dg = (g1 - g2) / 255;
        const b1 = col1[2];
        const b2 = col2[2];
        const db = (b1 - b2) / 255;
        const l1 = (r1 * 0.299 + g1 * 0.587 + b1 * 0.114) / 255.0;
        const l2 = (r2 * 0.299 + g2 * 0.587 + b2 * 0.114) / 255.0;
        const dl = l1 - l2;

        return (dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114) * 0.75 + dl * dl;
    },

    // and because 'why not', let's follow that up with a few other delta E methods that are not nearly as common for computer graphics, or just plain unsuitable (but when has that ever stopped anyone?)
    // Euclidean distance.  Input color values may be any one of RGB, XYZ, LAB
    // Side note: coldist(lab1,lab2) is equal to CIEDE1976, which is was a legit color difference formula before the realized LAB space really wasn't as perceptually uniform as they'd hoped.
    coldist(col1, col2) {
        return Math.sqrt((col2[0] - col1[0]) ** 2 + (col2[1] - col1[1]) ** 2 + (col2[2] - col1[2]) ** 2)
    },
    // Total shade difference.  Input color values may be any one of RGB, XYZ, LAB
    coldiff(col1, col2) {
        return (Math.abs(col2[0] - col1[0]) + Math.abs(col2[1] - col1[1]) + Math.abs(col2[2] - col1[2]));
    },
    // Euclidean distance for HSV / HSL, where the Hue component wraps around
    hsvdist(col1, col2) {
        let distH = Math.abs(col2[0] - col1[0]);
        if (distH > 0.5) {
            distH = 1.0 - distH;
        }
        colA = [...col1]; // make copies so we don't inadvertently change a palette array element
        colB = [...col2];
        colA[0] = 0;
        colB[0] = colH;
        return coldist(colA, colB);
    },
    // Total shade differennce for HSV / HSL, where the Hue component wraps around
    hsvdiff(col1, col2) {
        let diffH = Math.abs(col2[0] - col1[0]);
        if (diffH > 0.5) {
            diffH = 1.0 - distH;
        }
        colA = [...col1]; // make copies so we don't inadvertently change a palette array element
        colB = [...col2];
        colA[0] = 0;
        colB[0] = colH;
        return coldiff(colA, colB);
    },

    mciede1994mix(rgb1, lab2) {
        console.log(1994)
        if (window.suck) {
            return colorManip.ciede1994(lab2, colorManip.rgb2lab(rgb1))
        } else {
            return colorManip.ciede1994(colorManip.rgb2lab(rgb1), lab2)
        }

    },

    // the first improvement over CIEDE1976, CIEDE1994.  Expects [L,A,B],[L,A,B], but internally works on LCH space.
    // note: non-symmetrical.  Reference color should come first, sample color second.
    ciede1994(lab1, lab2) {
        const L1 = lab1[0],
            a1 = lab1[1],
            b1 = lab1[2];
        const L2 = lab2[0],
            a2 = lab2[1],
            b2 = lab2[2];

        // These constants are defined for "graphic arts".  Values for textiles given in comments
        // const KL = 1; // 2
        const K1 = 0.045; // 0.048
        const K2 = 0.015; // 0.014

        // Whereas these are typically unity (i.e. 1; so why have them? very industry-specific use.)
        /*
        const KC = 1;
        const KH = 1;
        const SL = 1;
        */

        // get the LAB difference between the two colors
        const dL = L1 - L2;
        const da = a1 - a2;
        const db = b1 - b2;

        // get the distance between the A and B pairs
        const C1 = Math.sqrt(a1 ** 2 + b1 ** 2)
        const C2 = Math.sqrt(a2 ** 2 + b2 ** 2)
        // and get their difference to find the Chroma difference
        const dC = C1 - C2;

        // and the funky distance between differences to find the Hue component
        const dH = sqrt(da ^ 2 + db ^ 2 - dC ^ 2);

        // industry specific adjustments (see above)
        const SC = 1 + K1 * C1;
        const SH = 1 + K2 * C1;

        // Because some of the constants above are just 1, and multiplying or dividing by 1 does nothing, we can ignore those and substitute in the main formula.
        // ( which is essentially a form of euclidian distance in adjusted LCH space)
        // const dE = Math.sqrt((dL/(KL*SL))**2 + (dC/(KC*SC))**2 + (dH/(KH*SH))**2); // non-substituted form
        const dE = Math.sqrt(dL ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2); // substituted form

        return dE
    },

    // The strangest of common color difference formulas, CMC I:c.  Expects [L,A,B],[L,A,B], but internally works on LCH space.
    // Strangest primarily because it's not symmetrical.  cmcic(col1,col2) gives a different result from cmcic(col2,col1).
    // 'Correct' usage is to set the reference color as the first element, and the sample color as the second element.
    // This formula normally takes 'l' and 'c' weighting elements, but for graphics work these are set to 1, and are thus ignored/substituted.
    // l:1 c:1 = (
    cmcicMix(rgb1, lab2) {
        return colorManip.cmcic(colorManip.rgb2lab(rgb1), lab2)
    },

    cmcic(lab1, lab2) {
        const L1 = lab1[0],
            a1 = lab1[1],
            b1 = lab1[2];
        const L2 = lab2[0],
            a2 = lab2[1],
            b2 = lab2[2];

        const C1 = Math.sqrt(a1 * a1 + b1 * b1);
        let H = Math.atan2(b1, a1);
        H = H + 2 * Math.PI * (H < 0);

        const C2 = Math.sqrt(a2 * a2 + b2 * b2);

        const dL = (L1 - L2) ** 2;
        const dC = (C1 - C2) ** 2;
        const dH = (a1 - a2) ** 2 + (b1 - b2) ** 2 - dC;

        const F = Math.sqrt(Math.pow(C1, 4) / (Math.pow(C1, 4) + 1900));
        const rad = 180 * Math.PI;
        const T = H >= (164 / rad) && H <= (345 / rad) ? 0.56 + Math.abs(0.2 * Math.cos(H + 168 / rad)) : 0.36 + Math.abs(0.4 * Math.cos(H + 35 / rad));

        const Sl = L1 < 16 ? 0.511 : ((0.040975 * L1) / (1 + 0.01765 * L1));
        const Sc = 0.0638 * C1 / (1 + 0.0131 * C1) + 0.638;
        const Sh = Sc * (F * T + 1 - F);

        // dE = Math.sqrt(dL / (l * Sl)**2 +  dC / (c * Sc)**2 + dH / Sh**2); non-substituted
        dE = Math.sqrt(dL / Sl ** 2 + dC / Sc ** 2 + dH / Sh ** 2);

        return dE
    },

    // As mentioned in the comments for ciede2000, its internal results should not be interpreted as a new color space, as they are only useful for color differences.
    // DIN99o (a, b, c, d, ...) actually does turn things around by defining a new pereceptually uniform color space that outperforms LAB.
    // After colors have been transformed, a simple euclidean distance will do.
    // As such, there's no specific formula code here, and coldist() can be called instead.


    euclidian(rgb0, rgb1) {
        var rd = rgb1[0] - rgb0[0],
            gd = rgb1[1] - rgb0[1],
            bd = rgb1[2] - rgb0[2];

        return Math.sqrt(.2126 * rd ** 2 + .7152 * gd ** 2 + .0722 * bd ** 2) / 255;
    },


    // Map a given color to the closest color in a given palette, using a given color difference (Delta E) function.
    mapcolor(col, map, deFunction) {
        // if there were a lot (thousands upon thousands) of colors in the map, slow color difference functions could be sped up a little:
        // get the euclidean distance in LAB space between the color and the map (CIE76)
        // sort that from smallest to largest
        // run the actual intended color difference function on the first N elements of that list
        // this essentially gets a rough color difference first, then refines it using the more expensive color difference function.
        // the lowest value of that second pass ends up being the actual match, which may differ from that of the rough match.
        // because palettes are very limited in number of colors, performing the above steps first actually makes it slower.

        // very simple, just loop over all of the palette colors
        let bestMatch = -1;
        let bestMatchDE = 1e6;
        const mapLength = map.length;
        for (let i = 0; i < mapLength; i += 1) {
            const de = deFunction(col, map[i]); // get the color difference
            if (de < bestMatchDE) { // and if it's smaller, make that palette color the new best match.
                bestMatchDE = de;
                bestMatch = i;
            }
        }

        return bestMatch;
    },
    getColorIndex(col, palette) {
        let result = -1;
        const paletteLength = palette.length;
        for (let i = paletteLength - 1; i >= 0; i -= 1) {
            if (col[0] === palette[i][0] && col[1] === palette[i][1] && col[2] === palette[i][2]) {
                result = i;
                break;
            }
        }

        return result;
    },
    rgb2uint32(rgb) {
        let int = 255 << 24 | rgb[2] << 16 | rgb[1] << 8 | rgb[0];
        // i love js
        int >>>= 0;

        return int
    },
    uint32toRGB(int) {
        return [
            (int & 0xff),
            (int & 0xff00) >> 8,
            (int & 0xff0000) >> 16,
        ]
    },

    // this is not actually gamma correction
    // just +contrast and -brightness
    // hope it will help to convert problematic pictures
    adjustGamma(imageData, contrast, brightness) {
        const data = imageData.data;

        const contrastLUT = new Uint8Array(256);

        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

        for (let j = 0; j < 256; j++) {
            let col = j;

            col = factor * (col - 128) + 128;

            col = Math.max(0, Math.min(255, col));

            contrastLUT[j] = col;
        }

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;

            let R = data[i],
                G = data[i + 1],
                B = data[i + 2];

            // adjusting contrast

            R = contrastLUT[R];
            G = contrastLUT[G];
            B = contrastLUT[B];

            // adjusting brightness
            R = Math.max(0, Math.min(255, R + brightness));
            G = Math.max(0, Math.min(255, G + brightness));
            B = Math.max(0, Math.min(255, B + brightness));

            data[i] = R;
            data[i + 1] = G;
            data[i + 2] = B;
        }

        return imageData
    }
};

module.exports = colorManip