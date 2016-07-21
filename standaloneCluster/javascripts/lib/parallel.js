/* ****************************************************************************
 * parentElement === target dom node
 * options[optional] === {
 *     padding         : <number> Canvas 内部に設ける描画領域のパディング
 *     svg: {
 *         defaultwidth: <number> クラスタとして描かれる軸周辺の矩形の幅
 *         textbaseline: <number> 軸名描画領域の高さを決めるためのベースライン
 *         textsize    : <string> 軸タイトルのフォントサイズ
 *         scalesize   : <string> 軸目盛のフォントサイズ
 *     },
 *     axis: {
 *         linewidth   : <number> 軸の線の幅
 *         linecolor   : <string> 軸の色
 *         scalewidth  : <number> 軸の目盛線の横方向への伸び幅
 *     },
 *     bezier: {
 *         division    : <number> ベジェ曲線ポリゴンの分割数
 *         linescale   : <number> ベジェ曲線ポリゴンの厚み（高さ）係数
 *     }
 * }
 * ************************************************************************* */

function ParallelCoordinate(parentElement, option){
    this.width = 0;
    this.height = 0;
    this.padding = 0;
    this.axisCount = 0;      // 自身に含まれる列の数
    this.axisArray = [];     // 列（Axis インスタンス）格納する配列
    this.beginFlow = 'left'; // どちらが始点となりデータが流れていくか（未使用）

    this.parent = parentElement;                    // 自身を格納している親エレメント
    this.canvas = document.createElement('canvas'); // canvas は動的に生成
    this.canvas.style.float = 'left';
    this.canvas.width = this.parent.clientWidth;
    this.canvas.height = this.parent.clientHeight;
    this.canvas.style.position = 'absolute';
    this.layer = document.createElement('div');     // canvas の上に乗るレイヤ（SVG などが入る）も動的生成
    this.layer.style.width = '100%';
    this.layer.style.height = '100%';
    this.layer.style.position = 'relative';
    this.parent.appendChild(this.canvas);
    this.parent.appendChild(this.layer);

    this.gl = null;
    this.glReady = false;
    this.mat = null;
    this.qtn = null;
    this.drawRect = null;

    this.NS_SVG = 'http://www.w3.org/2000/svg';
    this.NS = function(e){return document.createElementNS(this.NS_SVG, e);}.bind(this);

    this.PARALLEL_PADDING = 30;
    this.SVG_DEFAULT_WIDTH = 10;
    this.SVG_TEXT_BASELINE = 30;
    this.SVG_TEXT_SIZE = 'medium';
    this.SVG_SCALE_SIZE = 'small';
    this.AXIS_LINE_WIDTH = 2;
    this.AXIS_LINE_COLOR = '#333';
    this.AXIS_SCALE_WIDTH = 5;
    this.BEZIER_DIVISION = 100;
    this.BEZIER_LINE_SCALE = 3.0;

    // binding
    this.setOption = this.setOption.bind(this);
    this.checkOption = this.checkOption.bind(this);

    // option setting
    this.setOption(option);

    this.initCanvas();                  // canvas の WebGL 関連初期化
    this.resetCanvas();                 // 初期化以降にリセットする場合
    this.resetBezierCanvas();           // ベジェ曲線モードでリセット
    this.resetBezierGeometryCanvas();   // ベジェ曲線ポリゴンジオメトリモード
    this.drawRect = this.getDrawRect(); // 描画対象の矩形領域
}
// オプションをセットする
ParallelCoordinate.prototype.setOption = function(option){
    if(!option){return false;}
    var s = 'padding';
    if(this.checkOption(option, s)){this.PARALLEL_PADDING = option[s];}
    if(this.checkOption(option, 'svg')){
        s = 'defaultwidth';
        if(this.checkOption(option.svg, s)){this.SVG_DEFAULT_WIDTH = option.svg[s];}
        s = 'textbaseline';
        if(this.checkOption(option.svg, s)){this.SVG_TEXT_BASELINE = option.svg[s];}
        s = 'textsize';
        if(this.checkOption(option.svg, s)){this.SVG_TEXT_SIZE = option.svg[s];}
        s = 'scalesize';
        if(this.checkOption(option.svg, s)){this.SVG_SCALE_SIZE = option.svg[s];}
    }
    if(this.checkOption(option, 'axis')){
        s = 'linewidth';
        if(this.checkOption(option.axis, s)){this.AXIS_LINE_WIDTH = option.axis[s];}
        s = 'linecolor';
        if(this.checkOption(option.axis, s)){this.AXIS_LINE_COLOR = option.axis[s];}
        s = 'scalewidth';
        if(this.checkOption(option.axis, s)){this.AXIS_SCALE_WIDTH = option.axis[s];}
    }
    if(this.checkOption(option, 'bezier')){
        s = 'division';
        if(this.checkOption(option.bezier, s)){this.BEZIER_DIVISION = option.bezier[s];}
        s = 'linescale';
        if(this.checkOption(option.bezier, s)){this.BEZIER_LINE_SCALE = option.bezier[s];}
    }
};
ParallelCoordinate.prototype.checkOption = function(option, name){
    return (
        option.hasOwnProperty(name) &&
        option[name] !== null &&
        option[name] !== undefined &&
        option[name] !== '' &&
        option[name] !== 0
    );
};
// 列追加
ParallelCoordinate.prototype.addAxis = function(axisData, index){
    this.axisArray.push(new Axis(this, index, axisData));
    this.axisCount = this.axisArray.length;
    return this;
};
// 列の配置をリセットして可能なら canvas を再描画する
ParallelCoordinate.prototype.resetAxis = function(){
    var i, j;
    var space = this.layer.clientWidth - this.PARALLEL_PADDING * 2;
    var margin = space / (this.axisCount - 1);
    for(i = 0; i < this.axisCount; ++i){
        this.axisArray[i].update();
    }
    for(i = 0; i < this.axisCount; ++i){
        j = this.PARALLEL_PADDING + (margin - this.SVG_DEFAULT_WIDTH) * i - this.SVG_DEFAULT_WIDTH / 2;
        this.axisArray[i].setPosition(j);
    }
    if(this.glReady){
        this.drawCanvas();
    }
    return this;
};
// WebGL コンテキストなどの初期化
ParallelCoordinate.prototype.initCanvas = function(){
    this.gl = this.canvas.getContext('webgl');
    this.glReady = this.gl !== null && this.gl !== undefined;
    return this;
};
// canvas に矩形とか描けるやーつ
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
// ベジェ曲線をラインで描く
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
    j = 1.0 / this.BEZIER_DIVISION;
    j += j / this.BEZIER_DIVISION;
    for(i = 0; i < this.BEZIER_DIVISION; ++i){
        position.push(i * j, 0.0, 0.0);
    }
    var vPosition = create_vbo(gl, position);
    this.bVboList = [vPosition];
    return this;
};
// ベジェ曲線をジオメトリとして描く
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
    j = 1.0 / this.BEZIER_DIVISION;
    j += j / this.BEZIER_DIVISION;
    for(i = 0; i < this.BEZIER_DIVISION; ++i){
        position.push(i * j, 0.0, 0.0, i * j, 0.0, 0.0);
        signs.push(1.0, -1.0);
    }
    var vPosition = create_vbo(gl, position);
    var vSigns = create_vbo(gl, signs);
    this.bgVboList = [vPosition, vSigns];
    return this;
};
// 初期化などが全て終わっている前提の描画実行部分
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
        gl.drawArrays(gl.LINE_STRIP, 0, this.BEZIER_DIVISION);
    }.bind(this);

    var drawBezierGeometry = function(left, right, first, second, color){
        gl.useProgram(this.bgPrg);
        gl.uniformMatrix4fv(this.bgUniL.matrix, false, vpMatrix);
        gl.uniform4fv(this.bgUniL.point, [left, right, first, second]);
        gl.uniform1f(this.bgUniL.nextTime, 1.0 / this.BEZIER_DIVISION);
        gl.uniform1f(this.bgUniL.scale, this.BEZIER_LINE_SCALE);
        gl.uniform4fv(this.bgUniL.color, color);

        set_attribute(gl, this.bgVboList, this.bgAttL, this.bgAttS);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.BEZIER_DIVISION * 2);
    }.bind(this);

    if(this.axisArray.length > 1){
        // 少々冗長なのだが、軸上の矩形を確実に下に描画させるために
        for(i = 0, j = this.axisArray.length; i < j; ++i){
            q = this.axisArray[i].height - this.SVG_TEXT_BASELINE;         // Canvas の描画すべきエリアの高さ
            x = this.axisArray[i].getHorizontalRange();               // 対象軸の X 座標（非正規）
            for(k = 0, l = this.axisArray[i].clusters.length; k < l; ++k){
                // axis rect
                v = this.axisArray[i].clusters[k].getNomalizeRange(); // クラスタの上下限値（正規）
                w = q * v.min;                                        // 高さに正規化済みのクラスタの下限値掛ける
                y = q * v.max;                                        // 高さに正規化済みのクラスタの上限値掛ける
                drawClusterRect(x, x + this.SVG_DEFAULT_WIDTH, y, w, [1.0 / j * i / 2.0 + 0.5, 1.0 / l * k, 1.0 - 1.0 / l * k, 1.0]);
            }
        }
        for(i = 0, j = this.axisArray.length; i < j; ++i){
            q = this.axisArray[i].height - this.SVG_TEXT_BASELINE;         // Canvas の描画すべきエリアの高さ
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
// 描画対象となる矩形を得る
ParallelCoordinate.prototype.getDrawRect = function(){
    var w = this.parent.clientWidth - this.PARALLEL_PADDING * 2;
    var h = this.parent.clientHeight - this.PARALLEL_PADDING * 2 - this.SVG_TEXT_BASELINE;
    return {x: this.PARALLEL_PADDING, y: this.PARALLEL_PADDING, width: w, height: h};
};

// axis ===================================================================
function Axis(parent, index, data){
    this.parent = parent;    // 親となる ParallelCoordinate インスタンス
    this.title = data.title; // 列のラベル
    this.index = index;      // インデックス（通常左から読み込んだ順に配置）
    this.svg = this.parent.NS('svg');    // SVG エレメント
    this.min = 0;            // min
    this.max = 0;            // max
    this.width = 0;
    this.height = 0;
    this.left = 0;
    this.onDrag = false;     // ドラッグされているかどうかのフラグ
    this.centerH = 0;        // 軸の中心が矩形の左から何ピクセル目にあるか
    this.bbox = null;        // svg.getBBox の結果
    this.listeners = [];     // リスナを殺すためにキャッシュするので配列を用意
    this.clusters = [];      // 自身に格納しているクラスタ
    var i, j;
    for(i = 0, j = data.cluster.length; i < j; ++i){
        this.clusters.push(new Cluster(
            this,
            i,
            data.cluster[i].out,
            data.cluster[i].min,
            data.cluster[i].max,
            [1, 1, 1, 1]         // ここは将来的に色が入る可能性がある
        ));
    }
    this.getClustersMinMax();    // クラスタの minmax とってきて自身に適用
    this.svg.style.position = 'relative';
    this.svg.style.overflow = 'visible';
    this.parent.layer.appendChild(this.svg);
}
// 軸を設定して SVG を生成して描画する
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
    text = this.parent.NS('text');
    text.addEventListener('mousedown', funcDown, false);
    this.parent.layer.addEventListener('mousemove', funcMove, false);
    this.parent.layer.addEventListener('mouseup', funcUp, false);
    this.listeners.push(
        (function(){return function(){text.removeEventListener('mousedown', funcDown, false);};}()),
        (function(){return function(){this.parent.layer.removeEventListener('mousemove', funcMove, false);};}()),
        (function(){return function(){this.parent.layer.removeEventListener('mouseup', funcUp, false);};}())
    );
    text.textContent = title;
    text.style.fontSize = this.parent.SVG_TEXT_SIZE;
    text.setAttribute('color', this.parent.AXIS_LINE_COLOR);
    text.setAttribute('x', 0);
    text.setAttribute('y', this.parent.SVG_TEXT_BASELINE - 10);
    text.style.cursor = 'pointer';
    this.svg.appendChild(text);
    this.bbox = text.getBBox();
    this.width = this.bbox.width;
    this.height = this.parent.layer.clientHeight - this.parent.PARALLEL_PADDING * 2;
    this.centerH = this.parent.SVG_DEFAULT_WIDTH / 2;
    text.setAttribute('x', -(this.width - this.parent.SVG_DEFAULT_WIDTH) / 2);
    this.svg.style.position = 'relative';
    this.svg.style.width = this.parent.SVG_DEFAULT_WIDTH;
    this.svg.style.height = this.height;
    this.svg.style.top = this.parent.PARALLEL_PADDING;
    this.svg.style.left = this.parent.PARALLEL_PADDING - (this.parent.SVG_DEFAULT_WIDTH / 2);
    path = this.parent.NS('path');
    path.setAttribute('stroke', this.parent.AXIS_LINE_COLOR);
    path.setAttribute('stroke-width', this.parent.AXIS_LINE_WIDTH);
    path.setAttribute(
        'd',
        'M ' + this.centerH + ' ' + this.parent.SVG_TEXT_BASELINE + ' v ' + (this.height - this.parent.SVG_TEXT_BASELINE)
    );
    this.svg.appendChild(path);
    this.drawScale();
};
// 軸を描画している実行部分
// 現状は軸を minmax の差分を用いて 10 分割している
// つまり、最小値も最大値も、きれいに軸の両端にぴったりと配置される
Axis.prototype.drawScale = function(){
    var i, j, k, l;
    var text, path, bbox, dummy;
    var smin, smax;
    var range = this.max - this.min;
    var scale = range / 10;
    smin = this.min;
    smax = this.max;
    l = this.svg.clientHeight - this.parent.SVG_TEXT_BASELINE;
    dummy = this.parent.NS('text');
    dummy.style.position = 'relative';
    dummy.style.fontSize = this.parent.SVG_SCALE_SIZE;
    dummy.style.visibility = 'hidden';
    this.svg.appendChild(dummy);
    for(i = this.min; i <= smax; i += scale){
        text = this.parent.NS('text');
        text.style.position = 'relative';
        text.style.overflow = 'visible';
        text.style.fontSize = this.parent.SVG_SCALE_SIZE;
        text.textContent = '' + this.formatFloat(i, 5);
        dummy.textContent = '' + this.formatFloat(i, 5);
        bbox = dummy.getBBox();
        j = bbox.width - (this.parent.SVG_DEFAULT_WIDTH / 2) + this.parent.AXIS_SCALE_WIDTH + 2;
        k = this.svg.clientHeight - ((i - this.min) / (smax - this.min)) * l;
        text.style.transform = 'translate(' + -j + 'px, ' + (k + 5) + 'px)';
        this.svg.appendChild(text);
        path = this.parent.NS('path');
        path.setAttribute('stroke', this.parent.AXIS_LINE_COLOR);
        path.setAttribute('stroke-width', this.parent.AXIS_LINE_WIDTH);
        path.setAttribute(
            'd',
            'M ' + this.centerH + ' ' + k + ' h ' + -this.parent.AXIS_SCALE_WIDTH
        );
        this.svg.appendChild(path);
    }
};
// 軸のスタイルを変更して直接横位置を設定する（非推奨）
Axis.prototype.setPosition = function(x){
    this.svg.style.left = x;
};
// 自身の minmax プロパティを直接設定する（非推奨）
Axis.prototype.setMinMax = function(min, max){
    this.min = min;
    this.max = max;
};
// 自身に格納しているクラスタの内容から minmax を求めて自身に設定する
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
// 正規化していない軸の Left（ピクセル単位、0 始点）
Axis.prototype.getHorizontalRange = function(){
    // horizon range
    var i = parseFloat(this.svg.style.left.replace(/px$/));
    return i + (this.parent.SVG_DEFAULT_WIDTH / 2) + (this.index * this.parent.SVG_DEFAULT_WIDTH) - this.parent.PARALLEL_PADDING;
};
// 正規化した軸の横位置（0 ~ 1）
Axis.prototype.getNomalizeHorizontalRange = function(){
    // horizon normalize range
    var i = this.getHorizontalRange();
    return i / this.parent.drawRect.width;
};
// 軸のドラッグ開始イベント
Axis.prototype.dragStart = function(eve){
    this.left = eve.pageX;
    this.onDrag = true;
};
// 軸のドラッグイベント
Axis.prototype.dragMove = function(eve){
    if(!this.onDrag){return;}
    var x = eve.pageX - this.left;
    var df = parseFloat(this.svg.style.left.replace(/px$/, ''));
    var i = df + x;
    var j = this.parent.drawRect.width - ((this.index + 1) * this.parent.SVG_DEFAULT_WIDTH) + (this.parent.SVG_DEFAULT_WIDTH / 2) + this.parent.PARALLEL_PADDING;
    var k = this.parent.PARALLEL_PADDING - (this.index * this.parent.SVG_DEFAULT_WIDTH) - (this.parent.SVG_DEFAULT_WIDTH / 2);
    if(i > j){i = j;}
    if(i < k){i = k;}
    this.svg.style.left = i + 'px';
    this.left = eve.pageX;
    if(this.parent.glReady){
        this.parent.drawCanvas();
    }
};
// 軸のドラッグ終了イベント
Axis.prototype.dragEnd = function(eve){
    this.onDrag = false;
    // 時間差で軸リセットを呼ぶ
    setTimeout(this.parent.resetAxis.bind(this.parent), 300);
};
Axis.prototype.formatFloat = function(number, n){
    var p = Math.pow(10, n);
    return Math.round(number * p) / p;
};

// cluster ================================================================
function Cluster(axis, index, out, min, max, color){
    this.parentAxis = axis; // 自分自身が所属する軸インスタンス
    this.index = index;     // 自分自身のインデックス
    this.out = out;         // 自分からの出力（配列で、全て足して1
    this.min = min;         // 自分自身の最小値
    this.max = max;         // 自分自身の最大値
    this.color = color;     // 色
    return this;
}
// 正規化された、クラスタの縦方向の位置の上辺と下辺
Cluster.prototype.getNomalizeRange = function(){
    // vertical normalize range
    var i = this.parentAxis.max - this.parentAxis.min;
    return {
        min: (this.min - this.parentAxis.min) / i,
        max: 1.0 - (this.parentAxis.max - this.max) / i
    };
};

// util ===================================================================
// json ロードするやーつ
function loadJSON(url, callback){
    var xml = new XMLHttpRequest();
    xml.open('GET', url, true);
    xml.onload = function(){
        callback(xml.responseText);
    };
    xml.send();
}

