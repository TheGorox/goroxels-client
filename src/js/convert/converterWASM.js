import { converter } from "../../../lib/converter/bin/converter"
import wasmConverter from "../../../lib/converter/bin/converter.wasm"

// Since webpack will change the name and potentially the path of the
// `.wasm` file, we have to provide a `locateFile()` hook to redirect
// to the appropriate URL.
// More details: https://kripken.github.io/emscripten-site/docs/api_reference/module.html
const wasm = converter({
  locateFile(path) {
    if (path.endsWith(`.wasm`)) {
      return wasmConverter
    }
    return path
  },
})

export default wasm