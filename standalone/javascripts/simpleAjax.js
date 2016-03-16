function SimpleAjax(callBackFunction){
    // private scope variable -------------------------------------------------
    var response = '';
    var tmp = this;

    // property ---------------------------------------------------------------
    this.h;

    // method -----------------------------------------------------------------
    // initialize for xmlhttprequest
    this.initialize = function(){
        if(window.XMLHttpRequest){
            this.h = new XMLHttpRequest();
        }
        if(this.h){
            response = '';
            return true;
        }else{
            return false;
        }
    };
    // callback function
    if(callBackFunction != null){
        this.callBack = function(){
            if(this.readyState === 4){
                if(tmp.h.status === 200 || tmp.h.status === 201){
                    response = this.responseText;
                    callBackFunction();
                }
            }
        };
    }else{
        this.callBack = undefined;
    }
    // send as get method
    this.requestGet = function(url){
        if(!this.h){
            return false;
        }
        this.h.abort();
        this.h.open('get', url, true);
        if(this.callBack != null){
            this.h.onreadystatechange = this.callBack;
        }
        this.h.send(null);
    };
    // send as post method
    this.requestPost = function(url, param){
        var s = '';
        if(!this.h){return false;}
        if(param){s = this.convertParam(param);}
        this.h.abort();
        this.h.open('post', url, true);
        if(this.callBack != null){
            this.h.onreadystatechange = this.callBack;
        }
        this.h.setRequestHeader('X-From', location.href);
        this.h.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        this.h.send(s);
    };
    // location path get
    // arg fullPath is location.href : example => http://test.com/test.php => http://test.com/
    this.getPath = function(fullPath){
        if(!fullPath){return false;}
        var s = fullPath.split('/');
        s.pop();
        return s.join('/') + '/';
    };
    // return responstext
    this.getResponse = function(){
        return response;
    };
    // parameter to convert a encodeuri
    this.convertParam = function(paramObject){
        var param = new Array();
        for(var v in paramObject){
            var s = encodeURIComponent(v).replace(/%20/g, '+');
            s += '=' + encodeURIComponent(paramObject[v]).replace(/%20/g, '+');
            param.push(s);
        }
        return param.join('&');
    };
}
