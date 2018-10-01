export class Cookie
{
    static saveCookie(name, data)
    {
        var days = 30;
        var date = new Date();
        date.setTime(date.getTime()+(days*24*60*60*1000));
        var expires = "; expires="+date.toGMTString();
        document.cookie = (name + "=" + data + expires);
    }

    static loadCookie(name)
    {
        var cookie = decodeURIComponent(document.cookie);
        var idx = cookie.indexOf(name+"=");
        if (idx == -1)
        {
            return null;
        }
        var idxstart = idx + name.length;
        var idxend = cookie.indexOf(";", idxstart + 1);
        if (idxend == -1)
        {
            idxend = cookie.length;
        }
        idxend -= 1;
        var data = cookie.substr(idxstart + 1, idxend - idxstart);
        if (!data)
        {
            return null;
        }

        return data;
    }

    static saveData(name, data)
    {
        this.saveCookie(name, data);
    }

    static loadData(name)
    {
        var data = this.loadCookie(name);
        if (!data)
        {
            return null;
        }
        return data;
    }
}
