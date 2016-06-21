
(function(global){
    'use strict';

    var NS_SVG = 'http://www.w3.org/2000/svg';
    var NS = function(e){return document.createElementNS(NS_SVG, e);};

    var PARALLEL_PADDING = 100;    // 対象エリアのパディング
    var SVG_DEFAULT_WIDTH = 30;    // 軸のデフォルトの幅
    var SVG_TEXT_BASELINE = 30;    // svg にタイトルテキスト書くときのベースラインのトップからの距離
    var SVG_TEXT_SIZE = 'medium';  // svg に書くタイトルテキストのフォントサイズ
    var SVG_SCALE_SIZE = 'small';  // svg で目盛り書くときのフォントサイズ
    var AXIS_LINE_WIDTH = 2;       // 軸の線の太さ
    var AXIS_LINE_COLOR = '#333';  // 軸の線の色
    var AXIS_SCALE_WIDTH = 3;      // 軸の目盛線の横方向に伸びる量

    var parallel;

    var sph = new SPHLoader();
    var issph = null;

    window.addEventListener('load', function(){
        window.addEventListener('resize', windowResize, false);
        windowResize();
        function windowResize(eve){}

        parallel = new ParallelCoordinate(document.getElementById('wrap'));
        parallel.addAxis('test1')
                .addAxis('test2')
                .addAxis('test3')
                .resetAxis();
        window.addEventListener('dblclick', parallel.resetAxis.bind(parallel), false);
    }, false);

    // parallel ===============================================================
    function ParallelCoordinate(parentElement){
        this.width = 0;
        this.height = 0;
        this.padding = 0;
        this.axisCount = 0;
        this.axisArray = [];
        this.beginFlow = 'left';

        this.parent = parentElement;
        this.canvas = document.createElement('canvas');
        this.canvas.style.float = 'left';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.position = 'absolute';
        this.layer = document.createElement('div');
        this.layer.style.width = '100%';
        this.layer.style.height = '100%';
        this.layer.style.position = 'relative';
        this.parent.appendChild(this.canvas);
        this.parent.appendChild(this.layer);
    }
    ParallelCoordinate.prototype.addAxis = function(titleString){
        this.axisArray.push(new Axis(this.layer, titleString));
        this.axisCount = this.axisArray.length;
        return this;
    };
    ParallelCoordinate.prototype.resetAxis = function(){
        var i, j;
        var w = this.layer.clientWidth - PARALLEL_PADDING * 2;
        var space = w - this.axisCount * SVG_DEFAULT_WIDTH;
        var margin = space / (this.axisCount - 1);
        for(i = 0; i < this.axisCount; ++i){
            j = (SVG_DEFAULT_WIDTH / 2) + (margin) * i;
            this.axisArray[i].setPosition(PARALLEL_PADDING + j);
        }
    };
    // axis ===================================================================
    function Axis(parentElement, titleString){
        this.parent = parentElement;
        this.title = titleString;
        this.svg = document.createElementNS(NS_SVG, 'svg');
        this.parent.appendChild(this.svg);
        this.width = 0;
        this.height = 0;
        this.left = 0;
        this.onDrag = false;
        this.centerH = 0;
        this.bbox = null;
        this.reset();
    }
    Axis.prototype.reset = function(titleString){
        var path = null;
        var text = null;
        var title = titleString;
        if(!titleString){title = this.title;}
        this.svg.innerHTML = '';
        text = NS('text');
        text.addEventListener('mousedown', this.dragStart.bind(this), false);
        this.parent.addEventListener('mousemove', this.dragMove.bind(this), false);
        this.parent.addEventListener('mouseup', this.dragEnd.bind(this), false);
        text.textContent = title;
        text.setAttribute('color', AXIS_LINE_COLOR);
        text.setAttribute('x', 0);
        text.setAttribute('y', SVG_TEXT_BASELINE - 5);
        text.style.cursor = 'pointer';
        this.svg.appendChild(text);
        this.bbox = text.getBBox();
        this.width = this.bbox.width;
        this.height = this.parent.clientHeight - PARALLEL_PADDING * 2;
        this.centerH = this.width / 2;
        this.svg.style.position = 'relative';
        this.svg.style.top = PARALLEL_PADDING;
        this.svg.style.left = PARALLEL_PADDING - this.centerH + (SVG_DEFAULT_WIDTH / 2);
        this.svg.style.width = this.width;
        this.svg.style.height = this.height;
        path = NS('path');
        path.setAttribute('stroke', AXIS_LINE_COLOR);
        path.setAttribute('stroke-width', AXIS_LINE_WIDTH);
        path.setAttribute(
            'd',
            'M ' + this.centerH + ' ' + SVG_TEXT_BASELINE + ' v ' + (this.height - SVG_TEXT_BASELINE)
        );
        this.svg.appendChild(path);
    };
    Axis.prototype.setPosition = function(x){
        // x === path element left
        this.svg.style.left = x - this.centerH;
    };
    Axis.prototype.update = function(){};
    Axis.prototype.dragStart = function(eve){
        this.left = eve.pageX;
        this.onDrag = true;
    };
    Axis.prototype.dragMove = function(eve){
        if(!this.onDrag){return;}
        var x = eve.pageX - this.left;
        var df = parseFloat(this.svg.style.left.replace(/px$/, ''));
        this.svg.style.left = (df + x) + 'px';
        this.left = eve.pageX;
    };
    Axis.prototype.dragEnd = function(eve){
        this.onDrag = false;
    };
    // cluster ================================================================
    function Cluster(){
    }

    // util ===================================================================
    function zeroPadding(n, c){
        return (new Array(c + 1).join('0') + n).slice(-c);
    }

    // sph ====================================================================
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
})(this);

