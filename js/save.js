export class Save
{
    static save(name, data)
    {
        window.localStorage.setItem(name, data);
    }

    static load(name)
    {
        return window.localStorage.getItem(name);
    }
}
