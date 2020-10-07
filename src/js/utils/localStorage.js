export function getOrDefault(key, defaultVal){
    // NOTE: empty strings are falsy too
    return localStorage.getItem(key) || defaultVal
}

export function get(value){
    return localStorage.getItem(value);
}

export function set(key, value){
    return localStorage.setItem(key, value)
}