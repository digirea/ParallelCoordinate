
(function(global){
    'use strict';

    var NS_SVG = 'http://www.w3.org/2000/svg';
    var NS = function(e){return document.createElementNS(NS_SVG, e);};
    var sph = new SPHLoader();
    var issph = null;

    var PARALLEL_PADDING = 100;    // 対象エリアのパディング
    var SVG_DEFAULT_WIDTH = 30;    // 軸のデフォルトの幅
    var SVG_TEXT_BASELINE = 30;    // svg にタイトルテキスト書くときのベースラインのトップからの距離
    var SVG_TEXT_SIZE = 'medium';  // svg に書くタイトルテキストのフォントサイズ
    var SVG_SCALE_SIZE = 'small';  // svg で目盛り書くときのフォントサイズ
    var AXIS_LINE_WIDTH = 2;       // 軸の線の太さ
    var AXIS_LINE_COLOR = '#333';  // 軸の線の色
    var AXIS_SCALE_WIDTH = 5;      // 軸の目盛線の横方向に伸びる量
    var BEZIER_DIVISION = 100;     // ベジェ曲線の分割数

    var parallel;

    // window onload and json import
    window.addEventListener('load', function(){
        // resize event
        window.addEventListener('resize', function(){
            parallel.resetAxis.bind(parallel)();
        }, false);

        // json import
        loadJSON('testdata.json', init);
    }, false);

    // global initialize
    function init(data){
        var json = JSON.parse(data);
        var i, j;

        // check the data
        if(!json || !json.hasOwnProperty('axis') || json.axis.length < 2){
            console.log('invalid data');
            console.log(json);
            return;
        }

        // parallel initialize
        parallel = new ParallelCoordinate(document.getElementById('wrap'));

        // axis initialize
        for(i = 0, j = json.axis.length; i < j; ++i){
            parallel.addAxis(json.axis[i], i);
        }
        parallel.resetAxis();

        // draw canvas
        if(!parallel.glReady){return;}
        parallel.drawCanvas();
    }

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
        this.canvas.width = this.parent.clientWidth;
        this.canvas.height = this.parent.clientHeight;
        this.canvas.style.position = 'absolute';
        this.layer = document.createElement('div');
        this.layer.style.width = '100%';
        this.layer.style.height = '100%';
        this.layer.style.position = 'relative';
        this.parent.appendChild(this.canvas);
        this.parent.appendChild(this.layer);

        // other prop
        this.gl = null;
        this.glReady = false;
        this.mat = null;
        this.qtn = null;
        this.drawRect = null;

        // canvas initialize
        this.initCanvas();
        this.resetCanvas();
        this.resetBezierCanvas();
        this.resetBezierGeometryCanvas();
        this.drawRect = this.getDrawRect();
    }
    // axis
    ParallelCoordinate.prototype.addAxis = function(axisData, index){
        this.axisArray.push(new Axis(this, index, axisData));
        this.axisCount = this.axisArray.length;
        return this;
    };
    ParallelCoordinate.prototype.resetAxis = function(){
        var i, j;
        var space = this.layer.clientWidth - PARALLEL_PADDING * 2;
        var margin = space / (this.axisCount - 1);
        for(i = 0; i < this.axisCount; ++i){
            this.axisArray[i].update();
        }
        for(i = 0; i < this.axisCount; ++i){
            j = PARALLEL_PADDING + (margin - SVG_DEFAULT_WIDTH) * i - SVG_DEFAULT_WIDTH / 2;
            this.axisArray[i].setPosition(j);
        }
        if(this.glReady){
            this.drawCanvas();
        }
        return this;
    };
    // canvas
    ParallelCoordinate.prototype.initCanvas = function(){
        this.gl = this.canvas.getContext('webgl');
        this.glReady = this.gl !== null && this.gl !== undefined;
        return this;
    };
    ParallelCoordinate.prototype.resetCanvas = function(){
        var gl = this.gl;
        var mat = this.mat;
        if(!this.glReady){return;}
        if(!this.mat){this.mat = new matIV();}
        if(!this.qtn){this.qtn = new qtnIV();}
        this.drawRect = this.getDrawRect();

        var vSource = '';
        vSource += 'attribute vec3 position;';
        vSource += 'uniform mat4 matrix;';
        vSource += 'void main(){';
        vSource += '    gl_Position = matrix * vec4(position, 1.0);';
        vSource += '}';
        var fSource = '';
        fSource += 'precision mediump float;';
        fSource += 'uniform vec4 color;';
        fSource += 'void main(){';
        fSource += '    gl_FragColor = color;';
        fSource += '}';
        var vs = create_shader(gl, vSource, gl.VERTEX_SHADER);
        var fs = create_shader(gl, fSource, gl.FRAGMENT_SHADER);
        this.prg = create_program(gl, vs, fs);
        this.attL = [gl.getAttribLocation(this.prg, 'position')];
        this.attS = [3];
        this.uniL = {
            matrix: gl.getUniformLocation(this.prg, 'matrix'),
            color:  gl.getUniformLocation(this.prg, 'color')
        };
        var position = [
            0.0, 1.0, 0.0,
            0.0, 0.0, 0.0,
            1.0, 1.0, 0.0,
            1.0, 0.0, 0.0
        ];
        var vPosition = create_vbo(gl, position);
        this.vboList = [vPosition];
        return this;
    };
    ParallelCoordinate.prototype.resetBezierCanvas = function(){
        var i, j;
        var gl = this.gl;
        var mat = this.mat;
        if(!this.glReady){return;}
        if(!this.mat){this.mat = new matIV();}
        if(!this.qtn){this.qtn = new qtnIV();}
        this.drawRect = this.getDrawRect();

        var vSource = '';
        vSource += 'attribute vec3 position;';
        vSource += 'uniform mat4 matrix;';
        vSource += 'uniform vec4 point;';
        vSource += '';
        vSource += 'vec2 bezier(float t, vec2 p0, vec2 p1, vec2 p2, vec2 p3){';
        vSource += '    float r = 1.0 - t;';
        vSource += '    return vec2(  r * r * r *     p0.x +';
        vSource += '                3.0 * r * r * t * p1.x +';
        vSource += '                3.0 * r * t * t * p2.x +';
        vSource += '                  t * t * t *     p3.x,';
        vSource += '                  r * r * r *     p0.y +';
        vSource += '                3.0 * r * r * t * p1.y +';
        vSource += '                3.0 * r * t * t * p2.y +';
        vSource += '                  t * t * t *     p3.y);';
        vSource += '}';
        vSource += '';
        vSource += 'void main(){';
        vSource += '    vec2 p0 = vec2(point.x, point.z);';
        vSource += '    vec2 p1 = vec2(point.x + (point.y - point.x) * 0.5, point.z);';
        vSource += '    vec2 p2 = vec2(point.y + (point.x - point.y) * 0.5, point.w);';
        vSource += '    vec2 p3 = vec2(point.y, point.w);';
        vSource += '    gl_Position = matrix * vec4(bezier(position.x, p0, p1, p2, p3), 0.0, 1.0);';
        vSource += '}';
        var fSource = '';
        fSource += 'precision mediump float;';
        fSource += 'uniform vec4 color;';
        fSource += 'void main(){';
        fSource += '    gl_FragColor = color;';
        fSource += '}';
        var vs = create_shader(gl, vSource, gl.VERTEX_SHADER);
        var fs = create_shader(gl, fSource, gl.FRAGMENT_SHADER);
        this.bPrg = create_program(gl, vs, fs);
        this.bAttL = [gl.getAttribLocation(this.bPrg, 'position')];
        this.bAttS = [3];
        this.bUniL = {
            matrix: gl.getUniformLocation(this.bPrg, 'matrix'),
            point:  gl.getUniformLocation(this.bPrg, 'point'),
            color:  gl.getUniformLocation(this.bPrg, 'color')
        };
        var position = [];
        j = 1.0 / BEZIER_DIVISION;
        j += j / BEZIER_DIVISION;
        for(i = 0; i < BEZIER_DIVISION; ++i){
            position.push(i * j, 0.0, 0.0);
        }
        var vPosition = create_vbo(gl, position);
        this.bVboList = [vPosition];
        return this;
    };
    ParallelCoordinate.prototype.resetBezierGeometryCanvas = function(){
        var i, j;
        var gl = this.gl;
        var mat = this.mat;
        if(!this.glReady){return;}
        if(!this.mat){this.mat = new matIV();}
        if(!this.qtn){this.qtn = new qtnIV();}
        this.drawRect = this.getDrawRect();

        var vSource = '';
        vSource += 'attribute vec3 position;';
        vSource += 'attribute float signs;';
        vSource += 'uniform mat4 matrix;';
        vSource += 'uniform vec4 point;';
        vSource += 'uniform float nextTime;';
        vSource += 'uniform float scale;';
        vSource += 'const float PI = 3.141592;';
        vSource += '';
        vSource += 'vec2 bezier(float t, vec2 p0, vec2 p1, vec2 p2, vec2 p3){';
        vSource += '    float r = 1.0 - t;';
        vSource += '    return vec2(  r * r * r *     p0.x +';
        vSource += '                3.0 * r * r * t * p1.x +';
        vSource += '                3.0 * r * t * t * p2.x +';
        vSource += '                  t * t * t *     p3.x,';
        vSource += '                  r * r * r *     p0.y +';
        vSource += '                3.0 * r * r * t * p1.y +';
        vSource += '                3.0 * r * t * t * p2.y +';
        vSource += '                  t * t * t *     p3.y);';
        vSource += '}';
        vSource += '';
        vSource += 'void main(){';
        vSource += '    float f = abs(position.x - 0.5) * 2.0;';
        vSource += '    float g = (1.0 - cos(f * PI)) * 0.75 + 1.0;';
        vSource += '    vec2 p0 = vec2(point.x, point.z);';
        vSource += '    vec2 p1 = vec2(point.x + (point.y - point.x) * 0.5, point.z);';
        vSource += '    vec2 p2 = vec2(point.y + (point.x - point.y) * 0.5, point.w);';
        vSource += '    vec2 p3 = vec2(point.y, point.w);';
        vSource += '    vec2 p  = bezier(position.x, p0, p1, p2, p3);';
        vSource += '    vec2 n  = bezier(position.x + nextTime, p0, p1, p2, p3);';
        vSource += '    vec2 r  = normalize(n - p);';
        vSource += '    gl_Position = matrix * vec4(p + (vec2(r.y, -r.x) * signs) * scale * g, 0.0, 1.0);';
        vSource += '}';
        var fSource = '';
        fSource += 'precision mediump float;';
        fSource += 'uniform vec4 color;';
        fSource += 'void main(){';
        fSource += '    gl_FragColor = color;';
        fSource += '}';
        var vs = create_shader(gl, vSource, gl.VERTEX_SHADER);
        var fs = create_shader(gl, fSource, gl.FRAGMENT_SHADER);
        this.bgPrg = create_program(gl, vs, fs);
        this.bgAttL = [
            gl.getAttribLocation(this.bgPrg, 'position'),
            gl.getAttribLocation(this.bgPrg, 'signs')
        ];
        this.bgAttS = [3, 1];
        this.bgUniL = {
            matrix:   gl.getUniformLocation(this.bgPrg, 'matrix'),
            point:    gl.getUniformLocation(this.bgPrg, 'point'),
            nextTime: gl.getUniformLocation(this.bgPrg, 'nextTime'),
            scale:    gl.getUniformLocation(this.bgPrg, 'scale'),
            color:    gl.getUniformLocation(this.bgPrg, 'color')
        };
        var position = [];
        var signs = [];
        j = 1.0 / BEZIER_DIVISION;
        j += j / BEZIER_DIVISION;
        for(i = 0; i < BEZIER_DIVISION; ++i){
            position.push(i * j, 0.0, 0.0, i * j, 0.0, 0.0);
            signs.push(1.0, -1.0);
        }
        var vPosition = create_vbo(gl, position);
        var vSigns = create_vbo(gl, signs);
        this.bgVboList = [vPosition, vSigns];
        return this;
    };
    ParallelCoordinate.prototype.drawCanvas = function(){
        var i, j, k, l;
        var p, q, r, s, t, u, v, w, x, y;
        var gl = this.gl;
        var mat = this.mat;
        var mMatrix   = mat.identity(mat.create());
        var vMatrix   = mat.identity(mat.create());
        var pMatrix   = mat.identity(mat.create());
        var vpMatrix  = mat.identity(mat.create());
        var mvpMatrix = mat.identity(mat.create());
        if(!this.glReady){return;}
        this.canvas.width = this.parent.clientWidth;
        this.canvas.height = this.parent.clientHeight;
        this.drawRect = this.getDrawRect();
        mat.lookAt(
            [0.0, 0.0, 1.0],
            [0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            vMatrix
        );
        mat.ortho(
            0,
            this.drawRect.width,
            this.drawRect.height,
            0,
            0.5,
            1.0,
            pMatrix
        );
        mat.multiply(pMatrix, vMatrix, vpMatrix);

        gl.viewport(this.drawRect.x, this.drawRect.y, this.drawRect.width, this.drawRect.height);
        gl.clearColor(1.0, 1.0, 1.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);

        var drawClusterRect = function(left, right, top, bottom, color){
            var w = right - left;
            var h = top - bottom;
            mat.identity(mMatrix);
            mat.translate(mMatrix, [left - w / 2, bottom, 0.0], mMatrix);
            mat.scale(mMatrix, [w, h, 1.0], mMatrix);
            mat.multiply(vpMatrix, mMatrix, mvpMatrix);

            gl.useProgram(this.prg);
            gl.uniformMatrix4fv(this.uniL.matrix, false, mvpMatrix);
            gl.uniform4fv(this.uniL.color, color);

            set_attribute(gl, this.vboList, this.attL, this.attS);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }.bind(this);

        var drawBeziercurve = function(left, right, first, second, color){
            gl.useProgram(this.bPrg);
            gl.uniformMatrix4fv(this.bUniL.matrix, false, vpMatrix);
            gl.uniform4fv(this.bUniL.point, [left, right, first, second]);
            gl.uniform4fv(this.bUniL.color, color);

            set_attribute(gl, this.bVboList, this.bAttL, this.bAttS);
            gl.drawArrays(gl.LINE_STRIP, 0, BEZIER_DIVISION);
        }.bind(this);

        var drawBezierGeometry = function(left, right, first, second, color){
            gl.useProgram(this.bgPrg);
            gl.uniformMatrix4fv(this.bgUniL.matrix, false, vpMatrix);
            gl.uniform4fv(this.bgUniL.point, [left, right, first, second]);
            gl.uniform1f(this.bgUniL.nextTime, 1.0 / BEZIER_DIVISION);
            gl.uniform1f(this.bgUniL.scale, 3.0);
            gl.uniform4fv(this.bgUniL.color, color);

            set_attribute(gl, this.bgVboList, this.bgAttL, this.bgAttS);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, BEZIER_DIVISION * 2);
        }.bind(this);

        if(this.axisArray.length > 1){
            // 少々冗長なのだが、軸上の矩形を確実に下に描画させるために
            for(i = 0, j = this.axisArray.length; i < j; ++i){
                q = this.axisArray[i].height - SVG_TEXT_BASELINE;         // Canvas の描画すべきエリアの高さ
                x = this.axisArray[i].getHorizontalRange();               // 対象軸の X 座標（非正規）
                for(k = 0, l = this.axisArray[i].clusters.length; k < l; ++k){
                    // axis rect
                    v = this.axisArray[i].clusters[k].getNomalizeRange(); // クラスタの上下限値（正規）
                    w = q * v.min;                                        // 高さに正規化済みのクラスタの下限値掛ける
                    y = q * v.max;                                        // 高さに正規化済みのクラスタの上限値掛ける
                    drawClusterRect(x, x + SVG_DEFAULT_WIDTH, y, w, [1.0 / j * i / 2.0 + 0.5, 1.0 / l * k, 1.0 - 1.0 / l * k, 1.0]);
                }
            }
            for(i = 0, j = this.axisArray.length; i < j; ++i){
                q = this.axisArray[i].height - SVG_TEXT_BASELINE;         // Canvas の描画すべきエリアの高さ
                x = this.axisArray[i].getHorizontalRange();               // 対象軸の X 座標（非正規）
                for(k = 0, l = this.axisArray[i].clusters.length; k < l; ++k){
                    v = this.axisArray[i].clusters[k].getNomalizeRange(); // クラスタの上下限値（正規）
                    w = q * v.min;                                        // 高さに正規化済みのクラスタの下限値掛ける
                    y = q * v.max;                                        // 高さに正規化済みのクラスタの上限値掛ける
                    // bezier curve
                    if(i !== (this.axisArray.length - 1)){                // 最終軸じゃないときだけやる
                        t = this.axisArray[i + 1].getHorizontalRange();   // 右隣の軸の X 座標（非正規）
                        u = (y - w) / 2 + w;                              // 対象クラスタの中心 Y 座標
                        for(r = 0, s = this.axisArray[i + 1].clusters.length; r < s; ++r){
                            v = this.axisArray[i + 1].clusters[r].getNomalizeRange();
                            w = q * ((v.max - v.min) / 2 + v.min);
                            p = this.axisArray[i].clusters[k].out[r]; // これが隣の各クラスタへの分配率（SUM ONE）
                            // x == 対称軸の X 座標
                            // t == 右軸の X 座標
                            // u == 対象クラスタの中心の Y 座標
                            // w == 右軸対象クラスタの中心の Y 座標
                            drawBezierGeometry(x, t, u, w, [0.2, 0.5, 1.0, p]);
                            // drawBeziercurve(x, t, u, w, [0.2, 0.5, 1.0, p]);
                        }
                    }
                }
            }
        }

        gl.flush();

        return this;
    };
    ParallelCoordinate.prototype.getDrawRect = function(){
        var w = this.parent.clientWidth - PARALLEL_PADDING * 2;
        var h = this.parent.clientHeight - PARALLEL_PADDING * 2 - SVG_TEXT_BASELINE;
        return {x: PARALLEL_PADDING, y: PARALLEL_PADDING, width: w, height: h};
    };

    // axis ===================================================================
    function Axis(parent, index, data){
        this.parent = parent;
        this.title = data.title;
        this.index = index;
        this.svg = document.createElementNS(NS_SVG, 'svg');
        this.min = 0;
        this.max = 0;
        this.width = 0;
        this.height = 0;
        this.left = 0;
        this.defaultLeft = 0;
        this.onDrag = false;
        this.centerH = 0;
        this.bbox = null;
        this.listeners = [];
        this.clusters = [];
        var i, j;
        for(i = 0, j = data.cluster.length; i < j; ++i){
            this.clusters.push(new Cluster(
                this,
                i,
                data.cluster[i].out,
                data.cluster[i].min,
                data.cluster[i].max,
                [1, 1, 1, 1]
            ));
        }
        this.getClustersMinMax();
        this.parent.layer.appendChild(this.svg);
    }
    Axis.prototype.update = function(titleString, minmax){
        var path = null;
        var text = null;
        var title = titleString;
        var funcDown = this.dragStart.bind(this);
        var funcMove = this.dragMove.bind(this);
        var funcUp   = this.dragEnd.bind(this);
        if(titleString){
            this.title = titleString;
        }else{
            title = this.title;
        }
        if(minmax && minmax.hasOwnProperty('length') && minmax.length > 0){
            this.setMinMax(minmax[0], minmax[1]);
        }
        if(this.listeners.length > 0){
            this.listeners[0].bind(this)();
            this.listeners[1].bind(this)();
            this.listeners[2].bind(this)();
            this.listeners = [];
        }
        this.svg.innerHTML = '';
        text = NS('text');
        text.addEventListener('mousedown', funcDown, false);
        this.parent.layer.addEventListener('mousemove', funcMove, false);
        this.parent.layer.addEventListener('mouseup', funcUp, false);
        this.listeners.push(
            (function(){return function(){text.removeEventListener('mousedown', funcDown, false);};}()),
            (function(){return function(){this.parent.layer.removeEventListener('mousemove', funcMove, false);};}()),
            (function(){return function(){this.parent.layer.removeEventListener('mouseup', funcUp, false);};}())
        );
        text.textContent = title;
        text.setAttribute('color', AXIS_LINE_COLOR);
        text.setAttribute('x', 0);
        text.setAttribute('y', SVG_TEXT_BASELINE - 10);
        text.style.cursor = 'pointer';
        this.svg.appendChild(text);
        this.bbox = text.getBBox();
        this.width = this.bbox.width;
        this.height = this.parent.layer.clientHeight - PARALLEL_PADDING * 2;
        this.centerH = SVG_DEFAULT_WIDTH / 2;
        text.setAttribute('x', -(this.width - SVG_DEFAULT_WIDTH) / 2);
        this.svg.style.position = 'relative';
        this.svg.style.width = SVG_DEFAULT_WIDTH;
        this.svg.style.height = this.height;
        this.svg.style.top = PARALLEL_PADDING;
        this.svg.style.left = PARALLEL_PADDING - (SVG_DEFAULT_WIDTH / 2);
        path = NS('path');
        path.setAttribute('stroke', AXIS_LINE_COLOR);
        path.setAttribute('stroke-width', AXIS_LINE_WIDTH);
        path.setAttribute(
            'd',
            'M ' + this.centerH + ' ' + SVG_TEXT_BASELINE + ' v ' + (this.height - SVG_TEXT_BASELINE)
        );
        this.svg.appendChild(path);
        this.drawScale();
    };
    Axis.prototype.setPosition = function(x){
        this.svg.style.left = x;
    };
    Axis.prototype.setMinMax = function(min, max){
        this.min = min;
        this.max = max;
    };
    Axis.prototype.drawScale = function(){
        var i, j, k, l;
        var text, path, bbox;
        var smin, smax;
        var range = this.max - this.min;
        var scale = range / 10;
        // if(this.min % scale === 0){
            smin = this.min;
        // }else{
        //     smin = this.min + scale - (this.min % scale);
        // }
        // if(this.max % scale === 0){
            smax = this.max;
        // }else{
        //     smax = this.max + (this.max % scale);
        // }
        l = this.svg.clientHeight - SVG_TEXT_BASELINE;
        for(i = this.min; i <= smax; i += scale){
            text = NS('text');
            text.style.fontSize = SVG_SCALE_SIZE;
            text.textContent = '' + formatFloat(i, 5);
            this.svg.appendChild(text);
            bbox = text.getBBox();
            j = bbox.width - (SVG_DEFAULT_WIDTH / 2) + AXIS_SCALE_WIDTH + 2;
            k = this.svg.clientHeight - ((i - this.min) / (smax - this.min)) * l;
            text.style.transform = 'translate(' + -j + 'px, ' + (k + 5) + 'px)';
            path = NS('path');
            path.setAttribute('stroke', AXIS_LINE_COLOR);
            path.setAttribute('stroke-width', AXIS_LINE_WIDTH);
            path.setAttribute(
                'd',
                'M ' + this.centerH + ' ' + k + ' h ' + -AXIS_SCALE_WIDTH
            );
            this.svg.appendChild(path);
        }
    };
    Axis.prototype.getClustersMinMax = function(){
        if(this.clusters.length === 0){return;}
        var i, j, k, l;
        k = l = 0;
        if(this.clusters.length === 1){
            k = this.clusters[0].min;
            l = this.clusters[0].max;
        }else{
            for(i = 0, j = this.clusters.length; i < j; ++i){
                k = Math.min(this.clusters[i].min, k);
                l = Math.max(this.clusters[i].max, l);
            }
        }
        this.min = k;
        this.max = l;
        return this;
    };
    Axis.prototype.getHorizontalRange = function(){
        // horizon range
        var i = parseFloat(this.svg.style.left.replace(/px$/));
        return i + (SVG_DEFAULT_WIDTH / 2) + (this.index * SVG_DEFAULT_WIDTH) - PARALLEL_PADDING;
    };
    Axis.prototype.getNomalizeHorizontalRange = function(){
        // horizon normalize range
        var i = this.getHorizontalRange();
        return i / this.parent.drawRect.width;
    };
    Axis.prototype.dragStart = function(eve){
        this.left = eve.pageX;
        this.onDrag = true;
    };
    Axis.prototype.dragMove = function(eve){
        if(!this.onDrag){return;}
        var x = eve.pageX - this.left;
        var df = parseFloat(this.svg.style.left.replace(/px$/, ''));
        var i = df + x;
        var j = this.parent.drawRect.width - ((this.index + 1) * SVG_DEFAULT_WIDTH) + (SVG_DEFAULT_WIDTH / 2) + PARALLEL_PADDING;
        var k = PARALLEL_PADDING - (this.index * SVG_DEFAULT_WIDTH) - (SVG_DEFAULT_WIDTH / 2);
        if(i > j){i = j;}
        if(i < k){i = k;}
        this.svg.style.left = i + 'px';
        this.left = eve.pageX;
        if(this.parent.glReady){
            this.parent.drawCanvas();
        }
    };
    Axis.prototype.dragEnd = function(eve){
        this.onDrag = false;
        setTimeout(this.parent.resetAxis.bind(this.parent), 300);
    };

    // cluster ================================================================
    function Cluster(axis, index, out, min, max, color){
        this.parentAxis = axis; // 自分自身が所属する軸
        this.index = index;     // 自分自身のインデックス
        this.out = out;         // 自分からの出力（配列で、全て足して1
        this.min = min;         // 自分自身の最小値
        this.max = max;         // 自分自身の最大値
        this.color = color;     // 色
        return this;
    }
    Cluster.prototype.getNomalizeRange = function(){
        // vertical normalize range
        var i = this.parentAxis.max - this.parentAxis.min;
        return {
            min: (this.min - this.parentAxis.min) / i,
            max: 1.0 - (this.parentAxis.max - this.max) / i
        };
    };

    // util ===================================================================
    function zeroPadding(n, c){
        return (new Array(c + 1).join('0') + n).slice(-c);
    }
    function formatFloat(number, n) {
        var p = Math.pow(10, n);
        return Math.round(number * p) / p;
    }
    function bezier(t, p0, p1, p2, p3){
        var x = (1 - t) * (1 - t) * (1 - t) * p0[0] +
                3 * (1 - t) * (1 - t) * t * p1[0] +
                3 * (1 - t) * t * t * p2[0] +
                t * t * t * p3[0];
        var y = (1 - t) * (1 - t) * (1 - t) * p0[1] +
                3 * (1 - t) * (1 - t) * t * p1[1] +
                3 * (1 - t) * t * t * p2[1] +
                t * t * t * p3[1];
        return [x, y];
    }
    function gauss(length, power){
        var i, r, t, w;
        var weight = [];
        t = 0.0;
        for(i = 0; i < length; i++){
            r = 1.0 + 2.0 * i;
            w = Math.exp(-0.5 * (r * r) / power);
            weight[i] = w;
            if(i > 0){w *= 2.0;}
            t += w;
        }
        for(i = 0; i < weight.length; i++){
            weight[i] /= t;
        }
        return weight;
    }

    // temp
    function loadJSON(url, callback){
        var xml = new XMLHttpRequest();
        xml.open('GET', url, true);
        xml.onload = function(){
            callback(xml.responseText);
        };
        xml.send();
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

