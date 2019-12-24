import '../css/style.css'

import camera from './camera';
import Socket from './Socket';

const mainCanvas = document.getElementById('board');
const ctx = mainCanvas.getContext('2d');

const socket = new Socket(1488);

