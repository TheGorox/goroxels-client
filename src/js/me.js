export default {
    registered: false,
    username: null,
    role: 'guest',
    update(newMe){
        this.registered = newMe.registered || false;
        this.username = newMe.username || null;
        this.role = newMe.role || 'guest';
    }
}