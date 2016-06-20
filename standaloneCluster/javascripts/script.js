
(function(global){
    'use strict';

    var NS_SVG = 'http://www.w3.org/2000/svg';
    var NS = function(e){return document.createElementNS(NS_SVG, e);};

    var SVG_TEXT_BASELINE = 30;    // svg にタイトルテキスト書くときのベースラインのトップからの距離
    var SVG_TEXT_SIZE = 'medium';  // svg に書くタイトルテキストのフォントサイズ
    var SVG_SCALE_SIZE = 'small';  // svg で目盛り書くときのフォントサイズ
    var AXIS_LINE_WIDTH = 2;       // 軸の線の太さ
    var AXIS_LINE_COLOR = '#333';  // 軸の線の色
    var AXIS_SCALE_WIDTH = 3;      // 軸の目盛線の横方向に伸びる量

    var sph = new SPHLoader();
    var issph = null;

    window.addEventListener('load', function(){
        window.addEventListener('resize', windowResize, false);
        windowResize();
        function windowResize(eve){}

        var canvas = document.getElementById('canvas');
        var svgLayer = document.getElementById('svgLayer');

        var svg = setAxisAttribute(svgLayer, document.createElementNS(NS_SVG, 'svg'), 100, 'test');
        svgLayer.appendChild(svg);

        // svg util
        function setAxisAttribute(parentElement, svg, h, title){
            var path = null;
            var text = null;
            var bbox = null;
            var svgWidth = 0;
            var svgHeight = 0;
            var centerH = 0;
            if(!svg || !h || !title){return;}
            // reset svg
            svg.innerHTML = '';
            // title text
            text = NS('text');
            text.textContent = title;
            text.setAttribute('color', AXIS_LINE_COLOR);
            text.setAttribute('x', 0);
            text.setAttribute('y', SVG_TEXT_BASELINE);
            svg.appendChild(text);
            parentElement.appendChild(svg);
            // get bbox and set size
            bbox = text.getBBox();
            svgWidth = bbox.width;
            svgHeight = h;
            centerH = svgWidth / 2;
            // path
            path = NS('path');
            path.setAttribute('stroke', AXIS_LINE_COLOR);
            path.setAttribute('stroke-width', AXIS_LINE_WIDTH);
            path.setAttribute('d', 'M ' + centerH + ' ' + SVG_TEXT_BASELINE + ' v ' + (svgHeight - SVG_TEXT_BASELINE));
            svg.appendChild(path);
            return svg;
        }





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

