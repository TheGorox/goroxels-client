export function capitalize(str) {
    return str.replace(
      /[А-я\w]+/g,
      function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
      }
    );
  }