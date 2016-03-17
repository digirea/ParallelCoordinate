
function SPHLoader(){}

// argument:data => from readAsBinaryString
SPHLoader.prototype.isBinary = function(data){
    var i, j, k, l;
    k = []; l = 0;
    for(i = 0, j = data.length; i < j; ++i){
        if(i >= 10){break;}
        k.push(data.substr(i, 1).charCodeAt());
        if(k[k.length - 1] === 0){l++;}
    }
    return (l > 1);
};

// argument:data => from readAsArrayBuffer
SPHLoader.prototype.isSPH = function(data){
    var i, j, k, l;
    var dv = new DataView(data, 0, 4);
    var en = (dv.getUint32(0, true) === 8);
    i = 0;
    j = [
        'svType',
        'dType',
        'len',
        'len',
        'imax',
        'jmax',
        'kmax',
        'len',
        'xorg',
        'yorg',
        'zorg',
        'len',
        'len',
        'xpitch',
        'ypitch',
        'zpitch',
        'len',
        'len',
        'step',
        'time',
        'len'
    ];
    k = {};
    dv = new DataView(data, 4, 4 * j.length);
    for(l = 0; l < j.length; ++l){
        k[j[l]] = dv.getUint32(l * 4, en);
    }
    k.nowOffset = (j.length + 2) * 4;
    k.endian = en;

    // check values
    if(k.imax > 300 || k.jmax > 300 || k.kmax > 300){
        console.log('invalid dimension');
        return null;
    }

    // dest data
    k.dim = [k.imax, k.jmax, k.kmax];
    k.component = k.svType === 2 ? 3 : 1;
    k.origin = [k.xorg, k.yorg, k.zorg];
    k.pitch = [k.xpitch, k.ypitch, k.zpitch];
    k.grid = k.dim[0] * k.dim[1] * k.dim[2] * k.component;
    return k;
};

// return float array
SPHLoader.prototype.parse = function(data, param){
    if(data == null || param == null){return;}
    var dest = [];
    var x, y, z, e, tx, ty, tz, te, f, i;
    var dv = new DataView(data, param.nowOffset);
    f = param.endian; i = 0;
    for(z = 0, tz = param.kmax; z < tz; ++z){
        for(y = 0, ty = param.jmax; y < ty; ++y){
            for(x = 0, tx = param.imax; x < tx; ++x){
                for(e = 0, te = param.component; e < te; ++e){
                    dest.push(dv.getFloat32(i * 4, f));
                    ++i;
                }
            }
        }
    }
    return dest;
};


