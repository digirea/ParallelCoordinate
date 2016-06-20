
(function(global){
    'use strict';

    var sph = new SPHLoader();
    var issph = null;

    window.addEventListener('load', function(){
        window.addEventListener('resize', windowResize, false);
        windowResize();
        function windowResize(eve){}

        // util
        function zeroPadding(n, c){
            return (new Array(c + 1).join('0') + n).slice(-c);
        }

        // SPH は複数許可、CSV なら単体ファイルしか受け付けない
        // SPH の場合は包含する component の要素数を考慮して合計値が複数になれば描画
        function fileUpload(evt){
            reset();
            if(!evt.target.files && evt.target.files.length < 1){return;}
            var i;
            var fileLength = evt.target.files.length;
            var flg = [], files = [], fileNames = [], reader = [];
            data = [];
            params = [];
            targetData = null;
            dimensionTitles = {};
            colcount = 0;
            for(i = 0; i < fileLength; ++i){
                files[i] = evt.target.files[i];
                fileNames[i] = files[i].name;
                reader[i] = new FileReader();
                reader[i].onload = (function(index){
                    return function(eve){
                        data[index] = eve.target.result;
                        flg[index] = sph.isBinary(data[index]);
                        if(flg[index]){
                            reader[index].onload = (function(index){
                                return function(eve){
                                    var j, f;
                                    data[index] = eve.target.result;
                                    params[index] = sph.isSPH(data[index]);
                                    params[index].name = fileNames[index];
                                    colcount += params[index].component;
                                    if(params[index]){
                                        f = true;
                                        // load complete check
                                        for(j = 0; j < fileLength; ++j){
                                            f = f && (data[j] !== null && data[j] !== undefined && typeof data[j] === 'object');
                                        }
                                        if(f){
                                            issph = true;
                                            begin();
                                        }
                                    }else{
                                        infoArea('warn', 'csv file be single');
                                        return;
                                    }
                                };
                            })(index);
                            reader[index].readAsArrayBuffer(files[index]);
                        }else{
                            if(index === 0){
                                issph = false;
                                begin();
                            }
                        }
                    };
                })(i);
                reader[i].readAsBinaryString(files[i]);
            }
        }
    }, false);
})(this);

