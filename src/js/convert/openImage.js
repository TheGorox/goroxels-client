// https://stackoverflow.com/questions/3582671/how-to-open-a-local-disk-file-with-javascript
// copied and edited

function clickElem(elem) {
    // Thx user1601638 on Stack Overflow (6/6/2018 - https://stackoverflow.com/questions/13405129/javascript-create-and-save-file )
    var eventMouse = document.createEvent("MouseEvents")
    eventMouse.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
    elem.dispatchEvent(eventMouse)
}

function openImage(callback) {
    const readFile = function (e) {
        document.body.removeChild(fileInput);

        var file = e.target.files[0];
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function () {
            callback(reader.result);
        }
        reader.readAsDataURL(file);
    }
    const fileInput = document.createElement("input");
    fileInput.type = 'file';
    fileInput.accept = 'image/png';
    fileInput.style.display = 'none';
    fileInput.onchange = readFile;
    document.body.appendChild(fileInput);
    clickElem(fileInput);
}

export default openImage