export default {
    get: function(value){
        return localStorage.getItem(value);
    },

    set: function(key, value){
        return localStorage.setItem(key, value)
    }
}